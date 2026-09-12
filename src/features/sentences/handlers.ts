import { parsePagination } from '../../utils/pagination.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

type JsonObject = Record<string, unknown>;

export interface SentenceRow {
  id: string;
  text: string;
  phonemes: string | null;
  tokens: string;
  translations: string;
}

export interface SentenceAudioRow {
  id: string;
  sentence_id: string;
  voice: string;
  url: string;
}

export interface SentenceMediaRow {
  id: string;
  sentence_id: string;
  url: string;
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function isConstraint(error: unknown): boolean {
  return error instanceof Error && /constraint|unique|foreign key/i.test(error.message);
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as JsonObject : {};
  } catch {
    return {};
  }
}

export function parseSentence(row: SentenceRow) {
  return {
    ...row,
    tokens: parseJsonArray(row.tokens),
    translations: parseJsonObject(row.translations),
  };
}

export async function readBody(request: Request, origin: string): Promise<JsonObject | Response> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu phải là một JSON object', origin);
    }
    return body as JsonObject;
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin);
  }
}

export async function getSentenceById(env: Env, id: string): Promise<SentenceRow | null> {
  return env.DB.prepare(`
    SELECT id, text, phonemes, tokens, translations
    FROM sentences
    WHERE id = ?
  `).bind(id).first<SentenceRow>();
}

export async function getSentenceDetails(env: Env, sentenceId: string) {
  const sentenceRow = await getSentenceById(env, sentenceId);
  if (!sentenceRow) return null;

  const [audios, mappedLexicals] = await Promise.all([
    env.DB.prepare('SELECT id, voice, url FROM sentence_audio WHERE sentence_id = ?').bind(sentenceId).all<SentenceAudioRow>(),
    env.DB.prepare(`
      SELECT
        sl.id AS mapping_id,
        sl.lexical_id,
        sl.token_indexes,
        sl.position AS display_order,
        l.text,
        l.type,
        l.phonemes,
        l.translations
      FROM sentence_lexicals sl
      JOIN lexicals l ON l.id = sl.lexical_id
      WHERE sl.sentence_id = ?
      ORDER BY sl.position ASC, sl.id ASC
    `).bind(sentenceId).all<{
      mapping_id: string;
      lexical_id: string;
      token_indexes: string;
      display_order: number;
      text: string;
      type: string;
      phonemes: string | null;
      translations: string;
    }>(),
  ]);

  return {
    ...parseSentence(sentenceRow),
    media: {
      audios: audios.results,
      images: [],
      videos: [],
    },
    lexicals: mappedLexicals.results.map(row => ({
      mapping_id: row.mapping_id,
      lexical_id: row.lexical_id,
      text: row.text,
      type: row.type,
      phonemes: row.phonemes,
      translations: parseJsonObject(row.translations),
      token_indexes: parseJsonArray(row.token_indexes),
      display_order: row.display_order,
    })),
  };
}

export async function handleListSentences(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { page, size, offset } = parsePagination(url);
    const query = url.searchParams.get('q')?.trim() ?? '';

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (query) {
      conditions.push('s.text LIKE ?');
      params.push(`%${query}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM sentences s ${whereClause}`;
    const dataSql = `
      SELECT s.id, s.text, s.phonemes, s.tokens, s.translations
      FROM sentences s
      ${whereClause}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `;

    const countResult = await env.DB.prepare(countSql).bind(...params).first<{ total: number }>();
    const dataResult = await env.DB.prepare(dataSql).bind(...params, size, offset).all<SentenceRow>();

    const items = dataResult.results.map((row) => parseSentence(row));

    return successResponse(200, 'SUCCESS', items, origin, {
      page,
      size,
      total: countResult?.total ?? 0,
    });
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleGetSentence(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const details = await getSentenceDetails(env, id);
    if (!details) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy sentence', origin);
    return successResponse(200, 'SUCCESS', details, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCreateSentence(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;

  const textStr = typeof body.text === 'string' ? body.text.trim() : '';
  if (!textStr) return errorResponse(400, 'VALIDATION_ERROR', 'text không được để trống', origin);

  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : generateUUIDv7();
  const phonemes = typeof body.phonemes === 'string' && body.phonemes.trim() ? body.phonemes.trim() : null;

  let tokens: string[];
  if (Array.isArray(body.tokens)) {
    tokens = body.tokens.map(t => String(t).trim()).filter(Boolean);
  } else {
    tokens = textStr.split(/\s+/).filter(Boolean);
  }

  const translations = typeof body.translations === 'object' && body.translations !== null && !Array.isArray(body.translations)
    ? body.translations
    : {};

  try {
    await env.DB.prepare(`
      INSERT INTO sentences (id, text, phonemes, tokens, translations)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, textStr, phonemes, JSON.stringify(tokens), JSON.stringify(translations)).run();

    const details = await getSentenceDetails(env, id);
    return successResponse(201, 'CREATED', details, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', 'id đã tồn tại hoặc dữ liệu không hợp lệ', origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateSentence(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const existing = await getSentenceById(env, id);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Sentence không tồn tại', origin);

  const body = await readBody(request, origin);
  if (isResponse(body)) return body;

  const textStr = typeof body.text === 'string' ? body.text.trim() : existing.text;
  const phonemes = body.phonemes === null
    ? null
    : typeof body.phonemes === 'string' ? body.phonemes.trim() || null : existing.phonemes;

  let tokens: string[];
  if (Array.isArray(body.tokens)) {
    tokens = body.tokens.map(t => String(t).trim()).filter(Boolean);
  } else {
    tokens = parseJsonArray(existing.tokens) as string[];
  }

  const translations = typeof body.translations === 'object' && body.translations !== null && !Array.isArray(body.translations)
    ? body.translations
    : parseJsonObject(existing.translations);

  try {
    await env.DB.prepare(`
      UPDATE sentences
      SET text = ?, phonemes = ?, tokens = ?, translations = ?
      WHERE id = ?
    `).bind(textStr, phonemes, JSON.stringify(tokens), JSON.stringify(translations), id).run();

    const details = await getSentenceDetails(env, id);
    return successResponse(200, 'UPDATED', details, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', error instanceof Error ? error.message : undefined, origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteSentence(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const existing = await getSentenceById(env, id);
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Sentence không tồn tại', origin);

    await env.DB.prepare('DELETE FROM sentences WHERE id = ?').bind(id).run();
    return successResponse(200, 'DELETED', undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateSentenceLexicals(request: Request, env: Env, origin: string, sentenceId: string): Promise<Response> {
  const existing = await getSentenceById(env, sentenceId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Sentence không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const lexicals = Array.isArray(body.lexicals) ? body.lexicals : [];

  try {
    const statements: D1PreparedStatement[] = [
      env.DB.prepare('DELETE FROM sentence_lexicals WHERE sentence_id = ?').bind(sentenceId),
    ];

    for (const item of lexicals) {
      if (typeof item === 'object' && item !== null) {
        const lexicalId = typeof item.lexical_id === 'string' ? item.lexical_id.trim() : '';
        const tokenIndexes = Array.isArray(item.token_indexes)
          ? item.token_indexes.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0)
          : [];
        const displayOrder = Number.isInteger(item.display_order) ? Number(item.display_order) : 0;

        if (lexicalId && tokenIndexes.length > 0) {
          const mappingId = generateUUIDv7();
          statements.push(
            env.DB.prepare(`
              INSERT INTO sentence_lexicals (id, sentence_id, lexical_id, position, token_indexes)
              VALUES (?, ?, ?, ?, ?)
            `).bind(mappingId, sentenceId, lexicalId, displayOrder, JSON.stringify(tokenIndexes))
          );
        }
      }
    }

    await env.DB.batch(statements);
    return successResponse(200, 'UPDATED', { updated: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleBatchDeleteSentences(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const ids = Array.isArray(body.ids) ? body.ids.map(id => String(id).trim()).filter(Boolean) : [];
  if (ids.length === 0) return errorResponse(400, 'VALIDATION_ERROR', 'Danh sách ids không được để trống', origin);

  try {
    const placeholders = ids.map(() => '?').join(', ');
    const res = await env.DB.prepare(`DELETE FROM sentences WHERE id IN (${placeholders})`).bind(...ids).run();
    return successResponse(200, 'DELETED', { count: res.meta.changes }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
