import { parsePagination } from '../../utils/pagination.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { normalizeTokens, parseTokens } from '../../utils/tokens.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

type JsonObject = Record<string, unknown>;

export interface LexicalRow {
  id: string;
  text: string;
  tokens: string;
  translations: string;
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function isConstraint(error: unknown): boolean {
  return error instanceof Error && /constraint|unique|foreign key/i.test(error.message);
}

function parseJsonObject(value: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as JsonObject : {};
  } catch {
    return {};
  }
}

export function parseLexical(row: LexicalRow) {
  return {
    ...row,
    tokens: parseTokens(row.tokens),
    translations: parseJsonObject(row.translations),
  };
}

function readLexicalTokens(value: unknown, text: string, origin: string) {
  const tokens = normalizeTokens(value, text);
  const words = text.split(/\s+/);
  const hasMatchingWords = tokens.length === words.length
    && tokens.every((token, index) => token.text.toLowerCase() === words[index].toLowerCase());
  if (!hasMatchingWords) {
    return errorResponse(400, 'VALIDATION_ERROR', 'tokens phải khớp đúng thứ tự các từ trong lexical', origin);
  }
  return tokens;
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

export async function getLexicalById(env: Env, id: string): Promise<LexicalRow | null> {
  return env.DB.prepare(`
    SELECT id, text, tokens, translations
    FROM lexicals
    WHERE id = ?
  `).bind(id).first<LexicalRow>();
}

export async function getLexicalDetails(env: Env, lexicalId: string) {
  const lexicalRow = await getLexicalById(env, lexicalId);
  if (!lexicalRow) return null;
  return parseLexical(lexicalRow);
}

export async function handleListLexicals(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { page, size, offset } = parsePagination(url);
    const query = url.searchParams.get('q')?.trim() ?? '';
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (query) {
      conditions.push('LOWER(l.text) LIKE ?');
      params.push(`%${query.toLowerCase()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM lexicals l ${whereClause}`;
    const dataSql = `
      SELECT l.id, l.text, l.tokens, l.translations
      FROM lexicals l
      ${whereClause}
      ORDER BY l.id DESC
      LIMIT ? OFFSET ?
    `;

    const countResult = await env.DB.prepare(countSql).bind(...params).first<{ total: number }>();
    const dataResult = await env.DB.prepare(dataSql).bind(...params, size, offset).all<LexicalRow>();

    const items = dataResult.results.map((row) => parseLexical(row));

    return successResponse(200, 'SUCCESS', items, origin, {
      page,
      size,
      total: countResult?.total ?? 0,
    });
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleGetLexical(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const details = await getLexicalDetails(env, id);
    if (!details) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy lexical', origin);
    return successResponse(200, 'SUCCESS', details, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCreateLexical(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;

  const textStr = typeof body.text === 'string' ? body.text.trim().toLowerCase() : '';
  if (!textStr) return errorResponse(400, 'VALIDATION_ERROR', 'text không được để trống', origin);

  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : generateUUIDv7();
  const tokens = readLexicalTokens(body.tokens, textStr, origin);
  if (isResponse(tokens)) return tokens;

  const translations = typeof body.translations === 'object' && body.translations !== null && !Array.isArray(body.translations)
    ? body.translations
    : {};

  try {
    await env.DB.prepare(`
      INSERT INTO lexicals (id, text, tokens, translations)
      VALUES (?, ?, ?, ?)
    `).bind(id, textStr, JSON.stringify(tokens), JSON.stringify(translations)).run();

    const details = await getLexicalDetails(env, id);
    return successResponse(201, 'CREATED', details, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', 'id đã tồn tại hoặc dữ liệu không hợp lệ', origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateLexical(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const existing = await getLexicalById(env, id);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Lexical không tồn tại', origin);

  const body = await readBody(request, origin);
  if (isResponse(body)) return body;

  const textStr = typeof body.text === 'string' ? body.text.trim().toLowerCase() : existing.text.toLowerCase();
  const tokens = readLexicalTokens(
    Array.isArray(body.tokens)
      ? body.tokens
      : textStr === existing.text ? parseTokens(existing.tokens) : undefined,
    textStr,
    origin,
  );
  if (isResponse(tokens)) return tokens;

  const translations = typeof body.translations === 'object' && body.translations !== null && !Array.isArray(body.translations)
    ? body.translations
    : parseJsonObject(existing.translations);

  try {
    await env.DB.prepare(`
      UPDATE lexicals
      SET text = ?, tokens = ?, translations = ?
      WHERE id = ?
    `).bind(textStr, JSON.stringify(tokens), JSON.stringify(translations), id).run();

    const details = await getLexicalDetails(env, id);
    return successResponse(200, 'UPDATED', details, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', error instanceof Error ? error.message : undefined, origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteLexical(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const existing = await getLexicalById(env, id);
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Lexical không tồn tại', origin);

    await env.DB.prepare('DELETE FROM lexicals WHERE id = ?').bind(id).run();
    return successResponse(200, 'DELETED', undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleBatchDeleteLexicals(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const ids = Array.isArray(body.ids) ? body.ids.map(id => String(id).trim()).filter(Boolean) : [];
  if (ids.length === 0) return errorResponse(400, 'VALIDATION_ERROR', 'Danh sách ids không được để trống', origin);

  try {
    const placeholders = ids.map(() => '?').join(', ');
    const res = await env.DB.prepare(`DELETE FROM lexicals WHERE id IN (${placeholders})`).bind(...ids).run();
    return successResponse(200, 'DELETED', { count: res.meta.changes }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
