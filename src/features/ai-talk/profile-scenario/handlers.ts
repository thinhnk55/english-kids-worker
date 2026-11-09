import type { AiTalkProfileScenario } from '../../../types/ai-talk.ts';
import { safeJsonParse } from '../../../utils/json.ts';
import { errorResponse, successResponse } from '../../../utils/response.ts';

export async function handleListProfileScenarios(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profile_id');

  let query = 'SELECT * FROM ai_talk_profile_scenarios';
  const params: unknown[] = [];

  if (profileId) {
    query += ' WHERE profile_id = ?';
    params.push(Number(profileId));
  }

  query += ' ORDER BY updated_at DESC';

  const result = await env.DB.prepare(query).bind(...params).all<AiTalkProfileScenario>();
  const formatted = (result.results || []).map((row) => ({
    ...row,
    meta: typeof row.meta === 'string' ? safeJsonParse(row.meta, {}) : (row.meta || {}),
  }));

  return successResponse(200, 'SUCCESS', formatted, origin);
}

export async function handleGetProfileScenario(
  profileId: number,
  scenarioId: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM ai_talk_profile_scenarios WHERE profile_id = ? AND scenario_id = ?',
  )
    .bind(profileId, scenarioId)
    .first<AiTalkProfileScenario>();

  if (!row) {
    return successResponse(200, 'SUCCESS', {
      profile_id: profileId,
      scenario_id: scenarioId,
      meta: {},
      created_at: 0,
      updated_at: 0,
    }, origin);
  }

  return successResponse(200, 'SUCCESS', {
    ...row,
    meta: typeof row.meta === 'string' ? safeJsonParse(row.meta, {}) : (row.meta || {}),
  }, origin);
}

export async function handleUpsertProfileScenario(
  request: Request,
  scenarioId: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    profile_id?: number;
    meta?: Record<string, any>;
  } | null;

  const profileId = Number(body?.profile_id);
  if (!profileId || isNaN(profileId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'profile_id là bắt buộc', origin);
  }

  const cleanScenarioId = scenarioId.trim();
  const meta = body?.meta && typeof body.meta === 'object' ? body.meta : {};
  const now = Math.floor(Date.now() / 1000);

  const row = await env.DB.prepare(
    `INSERT INTO ai_talk_profile_scenarios (profile_id, scenario_id, meta, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, scenario_id) DO UPDATE SET
       meta = excluded.meta,
       updated_at = excluded.updated_at
     RETURNING *`,
  )
    .bind(profileId, cleanScenarioId, JSON.stringify(meta), now, now)
    .first<AiTalkProfileScenario>();

  return successResponse(200, 'SUCCESS', {
    ...row,
    meta: typeof row?.meta === 'string' ? safeJsonParse(row.meta, {}) : (row?.meta || {}),
  }, origin);
}
