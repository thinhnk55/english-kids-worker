import type { AiTalkScenario } from '../../../types/ai-talk.ts';
import { safeJsonParse } from '../../../utils/json.ts';
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

  query += ' ORDER BY id ASC';

  const result = await env.DB.prepare(query).bind(...params).all<AiTalkScenario>();
  const list = (result.results ?? []).map(s => ({
    ...s,
    missions: typeof s.missions === 'string' ? safeJsonParse(s.missions, []) : s.missions,
  }));

  return successResponse(200, 'SUCCESS', list, origin);
}

export async function handleGetScenario(
  id: string,
  env: Env,
  origin: string,
): Promise<Response> {
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
