import { errorResponse, successResponse } from '../../utils/response.ts';

type JsonObject = Record<string, unknown>;

interface TopicRow {
  code: string;
  parent_code: string | null;
  name: string;
  description: string | null;
  translations: string;
  position: number;
}

interface TopicInput {
  code: string;
  parent_code: string | null;
  name: string;
  description: string | null;
  translations: Record<string, { name?: string; description?: string }>;
  position: number;
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

function readCode(value: unknown, field: string, origin: string): string | Response {
  const code = readRequiredText(value, field, origin);
  if (isResponse(code)) return code;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(code)) {
    return errorResponse(400, 'VALIDATION_ERROR', `${field} chỉ gồm chữ thường, số, dấu _ hoặc -`, origin);
  }
  return code;
}

function readTranslations(value: unknown, origin: string): TopicInput['translations'] | Response {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'translations phải là một JSON object', origin);
  }

  const translations: TopicInput['translations'] = {};
  for (const [locale, rawValue] of Object.entries(value)) {
    if (!locale.trim() || typeof rawValue !== 'object' || rawValue === null || Array.isArray(rawValue)) {
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

  const code = readCode(body.code, 'code', origin);
  if (isResponse(code)) return code;
  const name = readRequiredText(body.name, 'name', origin);
  if (isResponse(name)) return name;
  const parentCode = body.parent_code === undefined || body.parent_code === null
    ? null
    : readCode(body.parent_code, 'parent_code', origin);
  if (isResponse(parentCode)) return parentCode;
  const description = body.description === undefined || body.description === null
    ? null
    : typeof body.description === 'string' ? body.description.trim() || null : undefined;
  if (description === undefined) {
    return errorResponse(400, 'VALIDATION_ERROR', 'description phải là chuỗi hoặc null', origin);
  }
  const translations = readTranslations(body.translations, origin);
  if (isResponse(translations)) return translations;
  const position = body.position === undefined ? 0 : body.position;
  if (!Number.isSafeInteger(position) || (position as number) < 0) {
    return errorResponse(400, 'VALIDATION_ERROR', 'position phải là số nguyên không âm', origin);
  }
  return { code, parent_code: parentCode, name, description, translations, position: position as number };
}

async function getTopic(env: Env, code: string): Promise<TopicRow | null> {
  return env.DB.prepare(`
    SELECT code, parent_code, name, description, translations, position
    FROM english_kid_topic
    WHERE code = ?
  `).bind(code).first<TopicRow>();
}

async function parentWouldCreateCycle(env: Env, code: string, parentCode: string): Promise<boolean> {
  const result = await env.DB.prepare(`
    WITH RECURSIVE descendants(code) AS (
      SELECT code FROM english_kid_topic WHERE parent_code = ?
      UNION ALL
      SELECT child.code
      FROM english_kid_topic AS child
      JOIN descendants ON child.parent_code = descendants.code
    )
    SELECT 1 AS found FROM descendants WHERE code = ? LIMIT 1
  `).bind(code, parentCode).first<{ found: number }>();
  return Boolean(result);
}

export async function handleListTopics(env: Env, origin: string): Promise<Response> {
  try {
    const rows = await env.DB.prepare(`
      SELECT code, parent_code, name, description, translations, position
      FROM english_kid_topic
      ORDER BY parent_code IS NOT NULL, parent_code ASC, position ASC, code ASC
    `).all<TopicRow>();
    return successResponse(200, 'SUCCESS', rows.results.map(parseTopic), origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleGetTopic(env: Env, origin: string, code: string): Promise<Response> {
  try {
    const topic = await getTopic(env, code);
    if (!topic) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
    return successResponse(200, 'SUCCESS', parseTopic(topic), origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCreateTopic(request: Request, env: Env, origin: string): Promise<Response> {
  const input = await readTopicInput(request, origin);
  if (isResponse(input)) return input;
  if (input.parent_code && !await getTopic(env, input.parent_code)) {
    return errorResponse(404, 'NOT_FOUND', 'Chủ đề cha không tồn tại', origin);
  }

  try {
    await env.DB.prepare(`
      INSERT INTO english_kid_topic (code, parent_code, name, description, translations, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      input.code,
      input.parent_code,
      input.name,
      input.description,
      JSON.stringify(input.translations),
      input.position,
    ).run();
    const topic = await getTopic(env, input.code);
    return successResponse(201, 'CREATED', topic ? parseTopic(topic) : undefined, origin);
  } catch (error) {
    if (error instanceof Error && /constraint|unique/i.test(error.message)) {
      return errorResponse(409, 'CONFLICT', 'code chủ đề đã tồn tại hoặc dữ liệu không hợp lệ', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateTopic(request: Request, env: Env, origin: string, currentCode: string): Promise<Response> {
  const input = await readTopicInput(request, origin);
  if (isResponse(input)) return input;
  try {
    if (!await getTopic(env, currentCode)) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
    if (input.parent_code === currentCode || (input.parent_code && await parentWouldCreateCycle(env, currentCode, input.parent_code))) {
      return errorResponse(409, 'CONFLICT', 'Chủ đề cha không thể là chính nó hoặc chủ đề con', origin);
    }
    if (input.parent_code && !await getTopic(env, input.parent_code)) {
      return errorResponse(404, 'NOT_FOUND', 'Chủ đề cha không tồn tại', origin);
    }
    await env.DB.prepare(`
      UPDATE english_kid_topic
      SET code = ?, parent_code = ?, name = ?, description = ?, translations = ?, position = ?
      WHERE code = ?
    `).bind(
      input.code,
      input.parent_code,
      input.name,
      input.description,
      JSON.stringify(input.translations),
      input.position,
      currentCode,
    ).run();
    const topic = await getTopic(env, input.code);
    return successResponse(200, 'UPDATED', topic ? parseTopic(topic) : undefined, origin);
  } catch (error) {
    if (error instanceof Error && /constraint|unique|foreign key/i.test(error.message)) {
      return errorResponse(409, 'CONFLICT', 'code chủ đề đã tồn tại hoặc dữ liệu không hợp lệ', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteTopic(env: Env, origin: string, code: string): Promise<Response> {
  try {
    if (!await getTopic(env, code)) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
    const child = await env.DB.prepare('SELECT code FROM english_kid_topic WHERE parent_code = ? LIMIT 1').bind(code).first<{ code: string }>();
    if (child) return errorResponse(409, 'CONFLICT', 'Không thể xoá chủ đề đang có chủ đề con', origin);
    await env.DB.prepare('DELETE FROM english_kid_topic WHERE code = ?').bind(code).run();
    return successResponse(200, 'DELETED', undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
