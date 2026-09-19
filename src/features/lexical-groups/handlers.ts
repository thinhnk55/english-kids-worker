import { parsePagination } from '../../utils/pagination.ts';
import { deleteLexicalGroupAssets } from '../../utils/r2-presign.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

type Json = Record<string, unknown>;
interface GroupRow { id: string; topic_id: number; name: string; description: string | null; image: string | null; audio: string | null; translations: string }
interface LexicalRow { id: string; text: string; translations: string }
interface GroupInput { topicId: number; name: string; description: string | null; translations: Json }

function isResponse(value: unknown): value is Response { return value instanceof Response; }
function object(value: unknown): Json | null { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Json : null; }
function parseObject(value: string): Json { try { return object(JSON.parse(value)) ?? {}; } catch { return {}; } }
function group(row: GroupRow) { return { ...row, translations: parseObject(row.translations) }; }
function lexical(row: LexicalRow) { return { ...row, translations: parseObject(row.translations) }; }

async function body(request: Request, origin: string): Promise<Json | Response> {
  try { return object(await request.json()) ?? errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu phải là JSON object', origin); } catch { return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin); }
}

function topicId(value: unknown, origin: string): number | Response {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : errorResponse(400, 'VALIDATION_ERROR', 'topic_id phải là số nguyên dương', origin);
}

function optionalText(value: unknown, field: string, origin: string): string | null | Response {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value.trim() || null : errorResponse(400, 'VALIDATION_ERROR', `${field} phải là chuỗi hoặc null`, origin);
}

async function input(request: Request, origin: string): Promise<GroupInput | Response> {
  const value = await body(request, origin); if (isResponse(value)) return value;
  const resolvedTopicId = topicId(value.topic_id, origin); if (isResponse(resolvedTopicId)) return resolvedTopicId;
  if (typeof value.name !== 'string' || !value.name.trim()) return errorResponse(400, 'VALIDATION_ERROR', 'name không được để trống', origin);
  const description = optionalText(value.description, 'description', origin); if (isResponse(description)) return description;
  const translations = value.translations === undefined ? {} : object(value.translations); if (!translations) return errorResponse(400, 'VALIDATION_ERROR', 'translations phải là JSON object', origin);
  return { topicId: resolvedTopicId, name: value.name.trim(), description, translations };
}

async function find(env: Env, id: string): Promise<GroupRow | null> {
  return env.DB.prepare('SELECT id, topic_id, name, description, image, audio, translations FROM lexical_groups WHERE id = ?').bind(id).first<GroupRow>();
}
async function topicExists(env: Env, id: number): Promise<boolean> { return Boolean(await env.DB.prepare('SELECT id FROM english_kid_topic WHERE id = ?').bind(id).first()); }
async function detail(env: Env, row: GroupRow) {
  const lexicals = await env.DB.prepare(`SELECT lexicals.id, lexicals.text, lexicals.translations FROM lexical_group_lexicals JOIN lexicals ON lexicals.id = lexical_group_lexicals.lexical_id WHERE lexical_group_lexicals.lexical_group_id = ? ORDER BY lexicals.text COLLATE NOCASE`).bind(row.id).all<LexicalRow>();
  return { ...group(row), lexicals: lexicals.results.map(lexical) };
}

export async function listLexicalGroups(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const url = new URL(request.url); const rawTopicId = url.searchParams.get('topic_id'); const selectedTopicId = topicId(rawTopicId === null ? undefined : Number(rawTopicId), origin); if (isResponse(selectedTopicId)) return selectedTopicId;
    const { page, size, offset } = parsePagination(url); const q = url.searchParams.get('q')?.trim() ?? ''; const where = q ? 'WHERE lexical_groups.topic_id = ? AND lexical_groups.name LIKE ?' : 'WHERE lexical_groups.topic_id = ?'; const binds = q ? [selectedTopicId, `%${q}%`] : [selectedTopicId];
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM lexical_groups ${where}`).bind(...binds).first<{ total: number }>();
    const rows = await env.DB.prepare(`SELECT lexical_groups.id, lexical_groups.topic_id, lexical_groups.name, lexical_groups.description, lexical_groups.image, lexical_groups.audio, lexical_groups.translations FROM lexical_groups ${where} ORDER BY lexical_groups.id DESC LIMIT ? OFFSET ?`).bind(...binds, size, offset).all<GroupRow>();
    return successResponse(200, 'SUCCESS', rows.results.map(group), origin, { page, size, total: count?.total ?? 0 });
  } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin); }
}

export async function getLexicalGroup(env: Env, origin: string, id: string): Promise<Response> { try { const row = await find(env, id); return row ? successResponse(200, 'SUCCESS', await detail(env, row), origin) : errorResponse(404, 'NOT_FOUND', 'Không tìm thấy nhóm từ', origin); } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin); } }

export async function createLexicalGroup(request: Request, env: Env, origin: string): Promise<Response> {
  const value = await input(request, origin); if (isResponse(value)) return value;
  try { if (!await topicExists(env, value.topicId)) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin); const id = generateUUIDv7(); await env.DB.prepare('INSERT INTO lexical_groups (id, topic_id, name, description, translations) VALUES (?, ?, ?, ?, ?)').bind(id, value.topicId, value.name, value.description, JSON.stringify(value.translations)).run(); return getLexicalGroup(env, origin, id); } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin); }
}

export async function updateLexicalGroup(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const value = await input(request, origin); if (isResponse(value)) return value;
  try { if (!await find(env, id)) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy nhóm từ', origin); if (!await topicExists(env, value.topicId)) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin); await env.DB.prepare('UPDATE lexical_groups SET topic_id = ?, name = ?, description = ?, translations = ? WHERE id = ?').bind(value.topicId, value.name, value.description, JSON.stringify(value.translations), id).run(); return getLexicalGroup(env, origin, id); } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin); }
}

export async function replaceGroupLexicals(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const value = await body(request, origin); if (isResponse(value)) return value;
  if (!Array.isArray(value.lexical_ids) || value.lexical_ids.some((item) => typeof item !== 'string' || !item.trim())) return errorResponse(400, 'VALIDATION_ERROR', 'lexical_ids phải là mảng id', origin);
  const ids = [...new Set(value.lexical_ids.map((item) => item.trim()))];
  try {
    if (!await find(env, id)) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy nhóm từ', origin);
    if (ids.length) { const found = await env.DB.prepare(`SELECT id FROM lexicals WHERE id IN (${ids.map(() => '?').join(', ')})`).bind(...ids).all<{ id: string }>(); if (found.results.length !== ids.length) return errorResponse(400, 'VALIDATION_ERROR', 'Có lexical không tồn tại', origin); }
    const statements = [env.DB.prepare('DELETE FROM lexical_group_lexicals WHERE lexical_group_id = ?').bind(id), ...ids.map((lexicalId) => env.DB.prepare('INSERT INTO lexical_group_lexicals (lexical_group_id, lexical_id) VALUES (?, ?)').bind(id, lexicalId))]; await env.DB.batch(statements); return getLexicalGroup(env, origin, id);
  } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin); }
}

export async function deleteLexicalGroup(env: Env, origin: string, id: string): Promise<Response> { try { const row = await find(env, id); if (!row) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy nhóm từ', origin); await deleteLexicalGroupAssets(env, id, row.image, row.audio); await env.DB.prepare('DELETE FROM lexical_groups WHERE id = ?').bind(id).run(); return successResponse(200, 'DELETED', undefined, origin); } catch (error) { return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin); } }
