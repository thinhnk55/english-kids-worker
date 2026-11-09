import {
  handleCreateAdminScenario,
  handleDeleteAdminScenario,
  handleListScenarios,
  handleUpdateAdminScenario,
} from '../features/ai-talk/scenario/handlers.ts';
import {
  handleDeleteAdminSession,
  handleGetAdminSession,
  handleListAdminSessions,
} from '../features/ai-talk/session/admin.ts';
import { errorResponse } from '../utils/response.ts';

export async function routeAdminRequest(
  request: Request,
  env: Env,
  origin: string,
  pathname: string,
): Promise<Response> {
  const method = request.method;

  // --- Scenarios (Admin CRUD) ---
  if (pathname === '/v1/admin/ai-talk/scenarios') {
    if (method === 'GET') return handleListScenarios(request, env, origin);
    if (method === 'POST') return handleCreateAdminScenario(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const scenarioMatch = pathname.match(/^\/v1\/admin\/ai-talk\/scenarios\/([^/]+)$/);
  if (scenarioMatch) {
    const code = decodeURIComponent(scenarioMatch[1]);
    if (method === 'PUT') return handleUpdateAdminScenario(request, code, env, origin);
    if (method === 'DELETE') return handleDeleteAdminScenario(code, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- Sessions (Admin view / manage) ---
  if (pathname === '/v1/admin/ai-talk/sessions') {
    if (method === 'GET') return handleListAdminSessions(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const sessionMatch = pathname.match(/^\/v1\/admin\/ai-talk\/sessions\/(\d+)$/);
  if (sessionMatch) {
    const id = Number(sessionMatch[1]);
    if (method === 'GET') return handleGetAdminSession(id, env, origin);
    if (method === 'DELETE') return handleDeleteAdminSession(id, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  return errorResponse(404, 'NOT_FOUND', undefined, origin);
}
