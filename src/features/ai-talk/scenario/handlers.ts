import type { AiTalkScenarioRow } from '../../../types/ai-talk.ts';
import { errorResponse, successResponse } from '../../../utils/response.ts';

export async function handleListScenarios(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  let query = 'SELECT * FROM ai_talk_scenarios';
  const params: unknown[] = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY category ASC, code ASC';

  const result = await env.DB.prepare(query).bind(...params).all<AiTalkScenarioRow>();
  return successResponse(200, 'SUCCESS', result.results || [], origin);
}

export async function handleGetScenario(
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM ai_talk_scenarios WHERE code = ?')
    .bind(code)
    .first<AiTalkScenarioRow>();

  if (!row) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy kịch bản', origin);
  }

  return successResponse(200, 'SUCCESS', row, origin);
}

export async function handleCreateAdminScenario(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as Partial<AiTalkScenarioRow> | null;

  if (!body || !body.code || !body.name || !body.category) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Mã (code), tên (name) và danh mục (category) là bắt buộc', origin);
  }

  const code = body.code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const name = body.name.trim();
  const category = body.category.trim();
  const creditCost = Math.max(Number(body.credit_cost) || 1, 0);
  const maxTurns = Math.max(Number(body.max_turns) || 10, 1);
  const now = Math.floor(Date.now() / 1000);

  const existing = await env.DB.prepare('SELECT code FROM ai_talk_scenarios WHERE code = ?')
    .bind(code)
    .first();

  if (existing) {
    return errorResponse(409, 'CONFLICT', 'Mã kịch bản đã tồn tại', origin);
  }

  const catCheck = await env.DB.prepare('SELECT code FROM ai_talk_categories WHERE code = ?')
    .bind(category)
    .first();

  if (!catCheck) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Danh mục (category) không tồn tại', origin);
  }

  const created = await env.DB.prepare(
    `INSERT INTO ai_talk_scenarios (code, name, category, credit_cost, max_turns, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  )
    .bind(code, name, category, creditCost, maxTurns, now, now)
    .first<AiTalkScenarioRow>();

  return successResponse(201, 'CREATED', created, origin);
}

export async function handleUpdateAdminScenario(
  request: Request,
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as Partial<AiTalkScenarioRow> | null;

  const existing = await env.DB.prepare('SELECT * FROM ai_talk_scenarios WHERE code = ?')
    .bind(code)
    .first<AiTalkScenarioRow>();

  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy kịch bản', origin);
  }

  const name = body?.name ? body.name.trim() : existing.name;
  let category = existing.category;
  if (body?.category) {
    category = body.category.trim();
    const catCheck = await env.DB.prepare('SELECT code FROM ai_talk_categories WHERE code = ?')
      .bind(category)
      .first();
    if (!catCheck) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Danh mục (category) không tồn tại', origin);
    }
  }

  const creditCost = body?.credit_cost !== undefined ? Math.max(Number(body.credit_cost) || 1, 0) : existing.credit_cost;
  const maxTurns = body?.max_turns !== undefined ? Math.max(Number(body.max_turns) || 10, 1) : existing.max_turns;
  const now = Math.floor(Date.now() / 1000);

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_scenarios
     SET name = ?, category = ?, credit_cost = ?, max_turns = ?, updated_at = ?
     WHERE code = ?
     RETURNING *`,
  )
    .bind(name, category, creditCost, maxTurns, now, code)
    .first<AiTalkScenarioRow>();

  return successResponse(200, 'SUCCESS', updated, origin);
}

export async function handleDeleteAdminScenario(
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const res = await env.DB.prepare('DELETE FROM ai_talk_scenarios WHERE code = ?')
    .bind(code)
    .run();

  if (!res.meta.changes) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy kịch bản', origin);
  }

  return successResponse(200, 'DELETED', undefined, origin);
}
