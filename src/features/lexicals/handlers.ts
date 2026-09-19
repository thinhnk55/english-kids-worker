import { parsePagination } from '../../utils/pagination.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

type Json = Record<string, unknown>;
interface LexicalRow { id: string; text: string; tokens: string; pronunciation: string | null; translations: string; audio_count?: number; image_count?: number; video_count?: number }
interface Token { text: string; phonemes: string; graphemes: string }
interface Input { text: string; tokens: Token[]; pronunciation: string | null; translations: Json }
const audio = 'lexicals_audio';
const image = 'lexicals_image';
const video = 'lexicals_video';

function response(value: unknown): value is Response { return value instanceof Response }
function object(value: unknown): Json | null { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Json : null }
function parsed(value: string): Json { try { return object(JSON.parse(value)) ?? {} } catch { return {} } }
function lexical(row: LexicalRow) { return { ...row, tokens: JSON.parse(row.tokens), translations: parsed(row.translations) } }
async function body(request: Request, origin: string): Promise<Json | Response> {
  try { const value = object(await request.json()); return value ?? errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu phải là JSON object', origin) } catch { return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin) }
}
function tokens(value: unknown, origin: string): Token[] | Response {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return errorResponse(400, 'VALIDATION_ERROR', 'tokens phải là mảng', origin);
  const output: Token[] = [];
  for (const raw of value) {
    const item = object(raw);
    if (!item || typeof item.text !== 'string' || !item.text.trim() || typeof item.phonemes !== 'string' || !item.phonemes.trim() || typeof item.graphemes !== 'string' || !item.graphemes.trim()) return errorResponse(400, 'VALIDATION_ERROR', 'Mỗi token cần text, phonemes và graphemes', origin);
    output.push({ text: item.text.trim(), phonemes: item.phonemes.trim(), graphemes: item.graphemes.trim() });
  }
  return output;
}
function inputValue(value: Json, origin: string): Input | Response {
  if (typeof value.text !== 'string' || !value.text.trim()) return errorResponse(400, 'VALIDATION_ERROR', 'text không được để trống', origin);
  const tokenList = tokens(value.tokens, origin); if (response(tokenList)) return tokenList;
  const translations = value.translations === undefined ? {} : object(value.translations);
  if (!translations) return errorResponse(400, 'VALIDATION_ERROR', 'translations phải là JSON object', origin);
  if (value.pronunciation !== undefined && value.pronunciation !== null && typeof value.pronunciation !== 'string') return errorResponse(400, 'VALIDATION_ERROR', 'pronunciation phải là chuỗi hoặc null', origin);
  return { text: value.text.trim(), tokens: tokenList, pronunciation: typeof value.pronunciation === 'string' ? value.pronunciation.trim() || null : null, translations };
}
async function input(request: Request, origin: string): Promise<Input | Response> { const value = await body(request, origin); return response(value) ? value : inputValue(value, origin); }
async function find(env: Env, id: string): Promise<LexicalRow | null> { return env.DB.prepare('SELECT id, text, tokens, pronunciation, translations FROM lexicals WHERE id = ?').bind(id).first<LexicalRow>() }
async function detail(env: Env, row: LexicalRow) {
  const [audios, images, videos] = await Promise.all([env.DB.prepare(`SELECT id, url, voice_id FROM ${audio} WHERE lexical_id = ?`).bind(row.id).all(), env.DB.prepare(`SELECT id, url, purpose FROM ${image} WHERE lexical_id = ?`).bind(row.id).all(), env.DB.prepare(`SELECT id, url, purpose FROM ${video} WHERE lexical_id = ?`).bind(row.id).all()]);
  return { ...lexical(row), audio: audios.results, image: images.results, video: videos.results };
}
export async function listLexicals(request: Request, env: Env, origin: string): Promise<Response> {
  try { const url = new URL(request.url); const { page, size, offset } = parsePagination(url); const q = url.searchParams.get('q')?.trim() ?? ''; const where = q ? 'WHERE text LIKE ?' : ''; const bind = q ? [`%${q}%`] : []; const count = await env.DB.prepare(`SELECT COUNT(*) total FROM lexicals ${where}`).bind(...bind).first<{ total: number }>(); const rows = await env.DB.prepare(`SELECT lexicals.id, lexicals.text, lexicals.tokens, lexicals.pronunciation, lexicals.translations, (SELECT COUNT(*) FROM ${audio} WHERE lexical_id = lexicals.id) AS audio_count, (SELECT COUNT(*) FROM ${image} WHERE lexical_id = lexicals.id) AS image_count, (SELECT COUNT(*) FROM ${video} WHERE lexical_id = lexicals.id) AS video_count FROM lexicals ${where} ORDER BY lexicals.id DESC LIMIT ? OFFSET ?`).bind(...bind, size, offset).all<LexicalRow>(); return successResponse(200, 'SUCCESS', rows.results.map(lexical), origin, { page, size, total: count?.total ?? 0 }) } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin) }
}
export async function checkLexicalDuplicates(request: Request, env: Env, origin: string): Promise<Response> {
  const value = await body(request, origin); if (response(value)) return value;
  if (!Array.isArray(value.texts) || value.texts.some((item) => typeof item !== 'string')) return errorResponse(400, 'VALIDATION_ERROR', 'texts phải là mảng chuỗi', origin);
  const texts = [...new Set(value.texts.map((item) => item.trim()).filter(Boolean))];
  if (!texts.length) return successResponse(200, 'SUCCESS', [], origin);
  if (texts.length > 100) return errorResponse(400, 'VALIDATION_ERROR', 'Tối đa 100 lexical mỗi lần kiểm tra', origin);
  try {
    const rows = await env.DB.prepare(`SELECT id, text, tokens, pronunciation, translations FROM lexicals WHERE lower(text) IN (${texts.map(() => 'lower(?)').join(', ')})`).bind(...texts).all<LexicalRow>();
    return successResponse(200, 'SUCCESS', rows.results.map(lexical), origin);
  } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin); }
}
export async function batchCreateLexicals(request: Request, env: Env, origin: string): Promise<Response> {
  const value = await body(request, origin); if (response(value)) return value;
  if (!Array.isArray(value.items) || !value.items.length || value.items.length > 100) return errorResponse(400, 'VALIDATION_ERROR', 'items phải có từ 1 đến 100 lexical', origin);
  const items: Input[] = []
  for (const raw of value.items) { const parsedInput = object(raw); if (!parsedInput) return errorResponse(400, 'VALIDATION_ERROR', 'Mỗi lexical phải là JSON object', origin); const item = inputValue(parsedInput, origin); if (response(item)) return item; items.push(item); }
  try {
    const created = items.map((item) => ({ id: generateUUIDv7(), ...item }))
    await env.DB.batch(created.map((item) => env.DB.prepare('INSERT INTO lexicals (id, text, tokens, pronunciation, translations) VALUES (?, ?, ?, ?, ?)').bind(item.id, item.text, JSON.stringify(item.tokens), item.pronunciation, JSON.stringify(item.translations))))
    return successResponse(201, 'CREATED', created.map((item) => ({ ...item, audio: [], image: [], video: [] })), origin)
  } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin) }
}
export async function getLexical(env: Env, origin: string, id: string): Promise<Response> { try { const row = await find(env, id); return row ? successResponse(200, 'SUCCESS', await detail(env, row), origin) : errorResponse(404, 'NOT_FOUND', 'Không tìm thấy lexical', origin) } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin) } }
export async function createLexical(request: Request, env: Env, origin: string): Promise<Response> { const value = await input(request, origin); if (response(value)) return value; try { const id = generateUUIDv7(); await env.DB.prepare('INSERT INTO lexicals (id, text, tokens, pronunciation, translations) VALUES (?, ?, ?, ?, ?)').bind(id, value.text, JSON.stringify(value.tokens), value.pronunciation, JSON.stringify(value.translations)).run(); return getLexical(env, origin, id) } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin) } }
export async function updateLexical(request: Request, env: Env, origin: string, id: string): Promise<Response> { const value = await input(request, origin); if (response(value)) return value; try { if (!await find(env, id)) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy lexical', origin); await env.DB.prepare('UPDATE lexicals SET text = ?, tokens = ?, pronunciation = ?, translations = ? WHERE id = ?').bind(value.text, JSON.stringify(value.tokens), value.pronunciation, JSON.stringify(value.translations), id).run(); return getLexical(env, origin, id) } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin) } }
type RemoveResult = 'missing' | 'in-use' | 'removed';
async function remove(env: Env, id: string): Promise<RemoveResult> { const row = await find(env, id); if (!row) return 'missing'; const usage = await env.DB.prepare('SELECT 1 FROM lexical_group_lexicals WHERE lexical_id = ? LIMIT 1').bind(id).first(); if (usage) return 'in-use'; const media = await env.DB.prepare(`SELECT url FROM ${audio} WHERE lexical_id = ? UNION ALL SELECT url FROM ${image} WHERE lexical_id = ? UNION ALL SELECT url FROM ${video} WHERE lexical_id = ?`).bind(id, id, id).all<{ url: string }>(); const base = env.ASSET_BASE_URL.replace(/\/$/u, ''); await Promise.all(media.results.filter(item => item.url.startsWith(`${base}/`)).map(item => env.ASSETS.delete(item.url.slice(base.length + 1)))); await env.DB.batch([env.DB.prepare(`DELETE FROM ${audio} WHERE lexical_id = ?`).bind(id), env.DB.prepare(`DELETE FROM ${image} WHERE lexical_id = ?`).bind(id), env.DB.prepare(`DELETE FROM ${video} WHERE lexical_id = ?`).bind(id), env.DB.prepare('DELETE FROM lexicals WHERE id = ?').bind(id)]); return 'removed' }
export async function deleteLexical(env: Env, origin: string, id: string): Promise<Response> { try { const result = await remove(env, id); if (result === 'removed') return successResponse(200, 'DELETED', undefined, origin); if (result === 'in-use') return errorResponse(409, 'CONFLICT', 'Lexical đang được dùng trong nhóm từ, không thể xóa', origin); return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy lexical', origin) } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin) } }
export async function batchDeleteLexicals(request: Request, env: Env, origin: string): Promise<Response> { const value = await body(request, origin); if (response(value) || !Array.isArray(value.ids)) return response(value) ? value : errorResponse(400, 'VALIDATION_ERROR', 'ids phải là mảng', origin); const ids = value.ids.filter((id): id is string => typeof id === 'string' && Boolean(id)); const results = await Promise.all(ids.map(id => remove(env, id))); return successResponse(200, 'DELETED', { count: results.filter(result => result === 'removed').length, blocked: results.filter(result => result === 'in-use').length }, origin) }
export async function duplicateLexical(env: Env, origin: string, id: string): Promise<Response> { const row = await find(env, id); if (!row) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy lexical', origin); const next = generateUUIDv7(); await env.DB.prepare('INSERT INTO lexicals (id, text, tokens, pronunciation, translations) VALUES (?, ?, ?, ?, ?)').bind(next, row.text, row.tokens, row.pronunciation, row.translations).run(); return getLexical(env, origin, next) }
