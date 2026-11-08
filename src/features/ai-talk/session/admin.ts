import type { AiTalkSession } from '../../../types/ai-talk.ts';
import { errorResponse, successResponse } from '../../../utils/response.ts';
import { formatSession } from './user.ts';

export async function handleListAdminSessions(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const scenarioId = url.searchParams.get('scenario_id');
  const status = url.searchParams.get('status');
  const userId = url.searchParams.get('user_id');

  let query = 'SELECT * FROM ai_talk_sessions';
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (scenarioId) {
    conditions.push('scenario_id = ?');
    params.push(scenarioId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (userId) {
    conditions.push('user_id = ?');
    params.push(Number(userId));
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT 100';

  const result = await env.DB.prepare(query).bind(...params).all<AiTalkSession>();
  const list = (result.results ?? []).map(formatSession);

  return successResponse(200, 'SUCCESS', list, origin);
}

export async function handleGetAdminSession(
  sessionId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const session = await env.DB.prepare(
    'SELECT * FROM ai_talk_sessions WHERE id = ?',
  )
    .bind(sessionId)
    .first<AiTalkSession>();

  if (!session) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  return successResponse(200, 'SUCCESS', formatSession(session), origin);
}

export async function handleDeleteAdminSession(
  sessionId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM ai_talk_sessions WHERE id = ?',
  )
    .bind(sessionId)
    .run();

  if (!result.meta.changes) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  return successResponse(200, 'DELETED', undefined, origin);
}
