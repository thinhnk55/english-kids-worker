import { parsePagination } from '../../utils/pagination.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';
import { getTextTerms } from '../classification/handlers.ts';

type JsonObject = Record<string, unknown>;

export interface TextRow {
  id: string;
  text: string;
  phonemes: string | null;
  tokens: string;
  translations: string;
}

export interface TextAudioRow {
  id: string;
  texts_id: string;
  voice: string;
  url: string;
}

export interface TextMediaRow {
  id: string;
  texts_id: string;
  url: string;
}

export interface SentenceLexicalRow {
  id: string;
  sentence_id: string;
  lexical_id: string;
  token_indexes: string;
  display_order: number;
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

export function parseText(row: TextRow) {
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

export async function getTextById(env: Env, id: string): Promise<TextRow | null> {
  return env.DB.prepare(`
    SELECT id, text, phonemes, tokens, translations
    FROM texts
    WHERE id = ?
  `).bind(id).first<TextRow>();
}

export async function getTextDetails(env: Env, textId: string) {
  const textRow = await getTextById(env, textId);
  if (!textRow) return null;

  const [terms, audios, images, videos, mappedLexicals, mappedSentences] = await Promise.all([
    getTextTerms(env, textId),
    env.DB.prepare('SELECT id, voice, url FROM text_audio WHERE texts_id = ?').bind(textId).all<TextAudioRow>(),
    env.DB.prepare('SELECT id, url FROM text_image WHERE texts_id = ?').bind(textId).all<TextMediaRow>(),
    env.DB.prepare('SELECT id, url FROM text_video WHERE texts_id = ?').bind(textId).all<TextMediaRow>(),
    env.DB.prepare(`
      SELECT
        sl.id AS mapping_id,
        sl.lexical_id,
        sl.token_indexes,
        sl.display_order,
        t.text,
        t.phonemes,
        t.tokens,
        t.translations
      FROM sentence_lexical sl
      JOIN texts t ON t.id = sl.lexical_id
      WHERE sl.sentence_id = ?
      ORDER BY sl.display_order ASC, sl.id ASC
    `).bind(textId).all<{
      mapping_id: string;
      lexical_id: string;
      token_indexes: string;
      display_order: number;
      text: string;
      phonemes: string | null;
      tokens: string;
      translations: string;
    }>(),
    env.DB.prepare(`
      SELECT
        sl.id AS mapping_id,
        sl.sentence_id,
        sl.token_indexes,
        sl.display_order,
        t.text,
        t.phonemes,
        t.tokens,
        t.translations
      FROM sentence_lexical sl
      JOIN texts t ON t.id = sl.sentence_id
      WHERE sl.lexical_id = ?
      ORDER BY sl.sentence_id ASC, sl.display_order ASC
    `).bind(textId).all<{
      mapping_id: string;
      sentence_id: string;
      token_indexes: string;
      display_order: number;
      text: string;
      phonemes: string | null;
      tokens: string;
      translations: string;
    }>(),
  ]);

  return {
    ...parseText(textRow),
    terms,
    media: {
      audios: audios.results,
      images: images.results,
      videos: videos.results,
    },
    lexicals: mappedLexicals.results.map(row => ({
      mapping_id: row.mapping_id,
      lexical_id: row.lexical_id,
      text: row.text,
      phonemes: row.phonemes,
      tokens: parseJsonArray(row.tokens),
      translations: parseJsonObject(row.translations),
      token_indexes: parseJsonArray(row.token_indexes),
      display_order: row.display_order,
    })),
    sentences: mappedSentences.results.map(row => ({
      mapping_id: row.mapping_id,
      sentence_id: row.sentence_id,
      text: row.text,
      phonemes: row.phonemes,
      tokens: parseJsonArray(row.tokens),
      translations: parseJsonObject(row.translations),
      token_indexes: parseJsonArray(row.token_indexes),
      display_order: row.display_order,
    })),
  };
}

export async function handleListTexts(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { page, size, offset } = parsePagination(url);
    const query = url.searchParams.get('q')?.trim() ?? '';
    
    // Support term_ids via multiple searchParams or comma-separated
    const termIdsRaw = url.searchParams.getAll('term_id').concat(url.searchParams.get('term_ids')?.split(',') ?? []);
    const termIds = Array.from(new Set(termIdsRaw.map(id => id.trim()).filter(Boolean)));

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (query) {
      conditions.push('t.text LIKE ?');
      params.push(`%${query}%`);
    }

    if (termIds.length > 0) {
      const placeholders = termIds.map(() => '?').join(', ');
      conditions.push(`
        t.id IN (
          SELECT text_id
          FROM text_terms
          WHERE term_id IN (${placeholders})
          GROUP BY text_id
          HAVING COUNT(DISTINCT term_id) = ?
        )
      `);
      params.push(...termIds, termIds.length);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM texts t ${whereClause}`;
    const dataSql = `
      SELECT t.id, t.text, t.phonemes, t.tokens, t.translations
      FROM texts t
      ${whereClause}
      ORDER BY t.id DESC
      LIMIT ? OFFSET ?
    `;

    const countResult = await env.DB.prepare(countSql).bind(...params).first<{ total: number }>();
    const dataResult = await env.DB.prepare(dataSql).bind(...params, size, offset).all<TextRow>();

    const items = await Promise.all(dataResult.results.map(row => getTextDetails(env, row.id)));

    return successResponse(200, 'SUCCESS', items, origin, {
      page,
      size,
      total: countResult?.total ?? 0,
    });
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleGetText(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const details = await getTextDetails(env, id);
    if (!details) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy text', origin);
    return successResponse(200, 'SUCCESS', details, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCreateText(request: Request, env: Env, origin: string): Promise<Response> {
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
      INSERT INTO texts (id, text, phonemes, tokens, translations)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, textStr, phonemes, JSON.stringify(tokens), JSON.stringify(translations)).run();

    // Assign term_ids if provided
    if (Array.isArray(body.term_ids) && body.term_ids.length > 0) {
      const termIds = body.term_ids.map(t => String(t).trim()).filter(Boolean);
      for (const termId of termIds) {
        await env.DB.prepare('INSERT OR IGNORE INTO text_terms (text_id, term_id) VALUES (?, ?)').bind(id, termId).run();
      }
    }

    const details = await getTextDetails(env, id);
    return successResponse(201, 'CREATED', details, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', 'id đã tồn tại hoặc dữ liệu không hợp lệ', origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateText(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const existing = await getTextById(env, id);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Text không tồn tại', origin);

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
      UPDATE texts
      SET text = ?, phonemes = ?, tokens = ?, translations = ?
      WHERE id = ?
    `).bind(textStr, phonemes, JSON.stringify(tokens), JSON.stringify(translations), id).run();

    if (Array.isArray(body.term_ids)) {
      const termIds = body.term_ids.map(t => String(t).trim()).filter(Boolean);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM text_terms WHERE text_id = ?').bind(id),
        ...termIds.map(termId => env.DB.prepare('INSERT OR IGNORE INTO text_terms (text_id, term_id) VALUES (?, ?)').bind(id, termId)),
      ]);
    }

    const details = await getTextDetails(env, id);
    return successResponse(200, 'UPDATED', details, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', error instanceof Error ? error.message : undefined, origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteText(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const existing = await getTextById(env, id);
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Text không tồn tại', origin);

    await env.DB.prepare('DELETE FROM texts WHERE id = ?').bind(id).run();
    return successResponse(200, 'DELETED', undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
