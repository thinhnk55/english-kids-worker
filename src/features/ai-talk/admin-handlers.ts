import type { AiTalkCategory, AiTalkScenario } from '../../types/ai-talk.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';

// Categories
export async function handleListAdminCategories(env: Env, origin: string): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT * FROM ai_talk_categories ORDER BY position ASC, code ASC',
  ).all<AiTalkCategory>();

  return successResponse(200, 'SUCCESS', result.results ?? [], origin);
}

export async function handleCreateAdminCategory(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    code?: string;
    parent_code?: string;
    name?: string;
    position?: number;
  } | null;

  if (!body || !body.code || !body.name) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Mã và tên danh mục là bắt buộc', origin);
  }

  const code = body.code.trim();
  const name = body.name.trim();
  const parentCode = body.parent_code?.trim() || null;
  const position = typeof body.position === 'number' ? body.position : 0;

  try {
    const inserted = await env.DB.prepare(
      `INSERT INTO ai_talk_categories (code, parent_code, name, position)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
      .bind(code, parentCode, name, position)
      .first<AiTalkCategory>();

    return successResponse(201, 'CREATED', inserted, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE') || message.includes('PRIMARY KEY')) {
      return errorResponse(409, 'CONFLICT', 'Mã danh mục đã tồn tại', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleUpdateAdminCategory(
  request: Request,
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    parent_code?: string;
    name?: string;
    position?: number;
  } | null;

  if (!body) {
    return errorResponse(400, 'BAD_REQUEST', undefined, origin);
  }

  const existing = await env.DB.prepare(
    'SELECT * FROM ai_talk_categories WHERE code = ?',
  )
    .bind(code)
    .first<AiTalkCategory>();

  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
  const parentCode = body.parent_code !== undefined ? (body.parent_code?.trim() || null) : existing.parent_code;
  const position = typeof body.position === 'number' ? body.position : existing.position;

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_categories
     SET parent_code = ?, name = ?, position = ?
     WHERE code = ?
     RETURNING *`,
  )
    .bind(parentCode, name, position, code)
    .first<AiTalkCategory>();

  return successResponse(200, 'UPDATED', updated, origin);
}

export async function handleDeleteAdminCategory(
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM ai_talk_categories WHERE code = ?',
  )
    .bind(code)
    .run();

  if (!result.meta.changes) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  return successResponse(200, 'DELETED', undefined, origin);
}

// Scenarios
export async function handleListAdminScenarios(env: Env, origin: string): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT * FROM ai_talk_scenarios ORDER BY id ASC',
  ).all<AiTalkScenario>();

  const list = (result.results ?? []).map(item => ({
    ...item,
    missions: typeof item.missions === 'string' ? safeJsonParse(item.missions, []) : item.missions,
  }));

  return successResponse(200, 'SUCCESS', list, origin);
}

export async function handleGetAdminScenario(id: string, env: Env, origin: string): Promise<Response> {
  const scenario = await env.DB.prepare(
    'SELECT * FROM ai_talk_scenarios WHERE id = ?',
  )
    .bind(id)
    .first<AiTalkScenario>();

  if (!scenario) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  return successResponse(200, 'SUCCESS', {
    ...scenario,
    missions: typeof scenario.missions === 'string' ? safeJsonParse(scenario.missions, []) : scenario.missions,
  }, origin);
}

export async function handleCreateAdminScenario(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    id?: string;
    category?: string;
    title?: string;
    situation?: string;
    missions?: unknown;
    ai_role?: string;
    user_role?: string;
    ai_prompt?: string;
    first_message?: string;
    max_turns?: number;
  } | null;

  if (!body || !body.id || !body.title || !body.situation || !body.ai_role || !body.user_role || !body.ai_prompt || !body.first_message) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Thiếu các thông tin bắt buộc của tình huống', origin);
  }

  const id = body.id.trim();
  const category = body.category?.trim() || null;
  const title = body.title.trim();
  const situation = body.situation.trim();
  const missionsStr = typeof body.missions === 'string' ? body.missions : JSON.stringify(body.missions ?? []);
  const aiRole = body.ai_role.trim();
  const userRole = body.user_role.trim();
  const aiPrompt = body.ai_prompt.trim();
  const firstMessage = body.first_message.trim();
  const maxTurns = typeof body.max_turns === 'number' && body.max_turns > 0 ? body.max_turns : 10;

  try {
    const inserted = await env.DB.prepare(
      `INSERT INTO ai_talk_scenarios (id, category, title, situation, missions, ai_role, user_role, ai_prompt, first_message, max_turns)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
      .bind(id, category, title, situation, missionsStr, aiRole, userRole, aiPrompt, firstMessage, maxTurns)
      .first<AiTalkScenario>();

    return successResponse(201, 'CREATED', {
      ...inserted,
      missions: safeJsonParse(inserted?.missions as string, []),
    }, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE') || message.includes('PRIMARY KEY')) {
      return errorResponse(409, 'CONFLICT', 'Mã tình huống đã tồn tại', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleUpdateAdminScenario(
  request: Request,
  id: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT * FROM ai_talk_scenarios WHERE id = ?',
  )
    .bind(id)
    .first<AiTalkScenario>();

  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  const body = await request.json().catch(() => null) as Partial<AiTalkScenario> | null;
  if (!body) return errorResponse(400, 'BAD_REQUEST', undefined, origin);

  const category = body.category !== undefined ? (body.category?.trim() || null) : existing.category;
  const title = body.title?.trim() || existing.title;
  const situation = body.situation?.trim() || existing.situation;
  const missionsStr = body.missions !== undefined
    ? (typeof body.missions === 'string' ? body.missions : JSON.stringify(body.missions))
    : (typeof existing.missions === 'string' ? existing.missions : JSON.stringify(existing.missions));
  const aiRole = body.ai_role?.trim() || existing.ai_role;
  const userRole = body.user_role?.trim() || existing.user_role;
  const aiPrompt = body.ai_prompt?.trim() || existing.ai_prompt;
  const firstMessage = body.first_message?.trim() || existing.first_message;
  const maxTurns = typeof body.max_turns === 'number' && body.max_turns > 0 ? body.max_turns : existing.max_turns;

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_scenarios
     SET category = ?, title = ?, situation = ?, missions = ?, ai_role = ?, user_role = ?, ai_prompt = ?, first_message = ?, max_turns = ?
     WHERE id = ?
     RETURNING *`,
  )
    .bind(category, title, situation, missionsStr, aiRole, userRole, aiPrompt, firstMessage, maxTurns, id)
    .first<AiTalkScenario>();

  return successResponse(200, 'UPDATED', {
    ...updated,
    missions: safeJsonParse(updated?.missions as string, []),
  }, origin);
}

export async function handleDeleteAdminScenario(
  id: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM ai_talk_scenarios WHERE id = ?',
  )
    .bind(id)
    .run();

  if (!result.meta.changes) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  return successResponse(200, 'DELETED', undefined, origin);
}

// Publish AI Talk Catalog snapshot
export async function handlePublishAiTalkCatalog(env: Env, origin: string): Promise<Response> {
  const [categoriesRes, scenariosRes] = await Promise.all([
    env.DB.prepare('SELECT * FROM ai_talk_categories ORDER BY position ASC, code ASC').all<AiTalkCategory>(),
    env.DB.prepare('SELECT * FROM ai_talk_scenarios ORDER BY id ASC').all<AiTalkScenario>(),
  ]);

  const categories = categoriesRes.results ?? [];
  const scenarios = (scenariosRes.results ?? []).map(s => ({
    ...s,
    missions: typeof s.missions === 'string' ? safeJsonParse(s.missions, []) : s.missions,
  }));

  const payload = JSON.stringify({
    success: true,
    code: 200,
    messageCode: 'SUCCESS',
    data: {
      categories,
      scenarios,
    },
  });

  await env.DB.prepare(
    `INSERT INTO published_catalogs (key, payload)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET payload = excluded.payload`,
  )
    .bind('ai_talk_catalog', payload)
    .run();

  return successResponse(200, 'SUCCESS', { key: 'ai_talk_catalog', scenarios_count: scenarios.length }, origin);
}

function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}
