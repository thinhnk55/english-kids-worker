import { errorResponse, successResponse } from '../../utils/response.ts';

type JsonObject = Record<string, unknown>;

interface TopicRow {
  id: number;
  name: string;
  description: string | null;
  translations: string;
}

interface TopicInput {
  name: string;
  description: string | null;
  translations: Record<string, { name?: string; description?: string }>;
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function parseTranslations(value: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as JsonObject : {};
  } catch {
    return {};
  }
}

function parseTopic(row: TopicRow) {
  return { ...row, translations: parseTranslations(row.translations) };
}

async function readBody(request: Request, origin: string): Promise<JsonObject | Response> {
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

function readRequiredText(value: unknown, field: string, origin: string): string | Response {
  if (typeof value !== 'string' || !value.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', `${field} không được để trống`, origin);
  }
  return value.trim();
}

function readTranslations(value: unknown, origin: string): TopicInput['translations'] | Response {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'translations phải là một JSON object', origin);
  }
  const translations: TopicInput['translations'] = {};
  for (const [locale, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== 'object' || rawValue === null || Array.isArray(rawValue)) {
      return errorResponse(400, 'VALIDATION_ERROR', `translations.${locale} không hợp lệ`, origin);
    }
    const translation = rawValue as JsonObject;
    if (translation.name !== undefined && typeof translation.name !== 'string') {
      return errorResponse(400, 'VALIDATION_ERROR', `translations.${locale}.name phải là chuỗi`, origin);
    }
    if (translation.description !== undefined && typeof translation.description !== 'string') {
      return errorResponse(400, 'VALIDATION_ERROR', `translations.${locale}.description phải là chuỗi`, origin);
    }
    translations[locale] = {
      ...(typeof translation.name === 'string' ? { name: translation.name.trim() } : {}),
      ...(typeof translation.description === 'string' ? { description: translation.description.trim() } : {}),
    };
  }
  return translations;
}

async function readTopicInput(request: Request, origin: string): Promise<TopicInput | Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;
  const name = readRequiredText(body.name, 'name', origin);
  if (isResponse(name)) return name;
  const description = body.description === undefined || body.description === null
    ? null
    : typeof body.description === 'string' ? body.description.trim() || null : undefined;
  if (description === undefined) return errorResponse(400, 'VALIDATION_ERROR', 'description phải là chuỗi hoặc null', origin);
  const translations = readTranslations(body.translations, origin);
  if (isResponse(translations)) return translations;
  return { name, description, translations };
}

function parseTopicId(value: string, origin: string): number | Response {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) return errorResponse(400, 'VALIDATION_ERROR', 'id chủ đề phải là số nguyên dương', origin);
  return id;
}

async function getTopic(env: Env, id: number): Promise<TopicRow | null> {
  return env.DB.prepare(`
    SELECT id, name, description, translations
    FROM english_kid_topic
    WHERE id = ?
  `).bind(id).first<TopicRow>();
}

export async function handleListTopics(env: Env, origin: string): Promise<Response> {
  try {
    const rows = await env.DB.prepare(`
      SELECT id, name, description, translations
      FROM english_kid_topic
      ORDER BY id ASC
    `).all<TopicRow>();
    return successResponse(200, 'SUCCESS', rows.results.map(parseTopic), origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleGetTopic(env: Env, origin: string, rawId: string): Promise<Response> {
  const id = parseTopicId(rawId, origin);
  if (isResponse(id)) return id;
  try {
    const topic = await getTopic(env, id);
    if (!topic) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
    return successResponse(200, 'SUCCESS', parseTopic(topic), origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCreateTopic(request: Request, env: Env, origin: string): Promise<Response> {
  const input = await readTopicInput(request, origin);
  if (isResponse(input)) return input;
  try {
    const result = await env.DB.prepare(`
      INSERT INTO english_kid_topic (name, description, translations)
      VALUES (?, ?, ?)
    `).bind(input.name, input.description, JSON.stringify(input.translations)).run();
    const topic = await getTopic(env, Number(result.meta.last_row_id));
    return successResponse(201, 'CREATED', topic ? parseTopic(topic) : undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateTopic(request: Request, env: Env, origin: string, rawId: string): Promise<Response> {
  const id = parseTopicId(rawId, origin);
  if (isResponse(id)) return id;
  const input = await readTopicInput(request, origin);
  if (isResponse(input)) return input;
  try {
    if (!await getTopic(env, id)) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
    await env.DB.prepare(`
      UPDATE english_kid_topic
      SET name = ?, description = ?, translations = ?
      WHERE id = ?
    `).bind(input.name, input.description, JSON.stringify(input.translations), id).run();
    const topic = await getTopic(env, id);
    return successResponse(200, 'UPDATED', topic ? parseTopic(topic) : undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteTopic(env: Env, origin: string, rawId: string): Promise<Response> {
  const id = parseTopicId(rawId, origin);
  if (isResponse(id)) return id;
  try {
    if (!await getTopic(env, id)) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
    await env.DB.prepare('DELETE FROM english_kid_topic WHERE id = ?').bind(id).run();
    return successResponse(200, 'DELETED', undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
