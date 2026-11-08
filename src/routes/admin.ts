import {
  handleCreateAdminCategory,
  handleDeleteAdminCategory,
  handleListAdminCategories,
  handleUpdateAdminCategory,
} from '../features/ai-talk/category/admin.ts';
import {
  handleCreateAdminScenario,
  handleDeleteAdminScenario,
  handleGetAdminScenario,
  handleListAdminScenarios,
  handlePublishAiTalkCatalog,
  handleUpdateAdminScenario,
} from '../features/ai-talk/scenario/admin.ts';
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

  // --- Publish Catalog ---
  if (pathname === '/v1/admin/ai-talk/publish') {
    if (method === 'POST') return handlePublishAiTalkCatalog(env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- Categories ---
  if (pathname === '/v1/admin/ai-talk/categories') {
    if (method === 'GET') return handleListAdminCategories(env, origin);
    if (method === 'POST') return handleCreateAdminCategory(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const categoryMatch = pathname.match(/^\/v1\/admin\/ai-talk\/categories\/([^/]+)$/);
  if (categoryMatch) {
    const code = decodeURIComponent(categoryMatch[1]);
    if (method === 'PUT') return handleUpdateAdminCategory(request, code, env, origin);
    if (method === 'DELETE') return handleDeleteAdminCategory(code, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- Scenarios ---
  if (pathname === '/v1/admin/ai-talk/scenarios') {
    if (method === 'GET') return handleListAdminScenarios(env, origin);
    if (method === 'POST') return handleCreateAdminScenario(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const scenarioMatch = pathname.match(/^\/v1\/admin\/ai-talk\/scenarios\/([^/]+)$/);
  if (scenarioMatch) {
    const id = decodeURIComponent(scenarioMatch[1]);
    if (method === 'GET') return handleGetAdminScenario(id, env, origin);
    if (method === 'PUT') return handleUpdateAdminScenario(request, id, env, origin);
    if (method === 'DELETE') return handleDeleteAdminScenario(id, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- Sessions (Admin view / manage) ---
  if (pathname === '/v1/admin/ai-talk/sessions') {
    if (method === 'GET') return handleListAdminSessions(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const sessionMatch = pathname.match(/^\/v1\/admin\/ai-talk\/sessions\/([^/]+)$/);
  if (sessionMatch) {
    const id = decodeURIComponent(sessionMatch[1]);
    if (method === 'GET') return handleGetAdminSession(id, env, origin);
    if (method === 'DELETE') return handleDeleteAdminSession(id, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  return errorResponse(404, 'NOT_FOUND', undefined, origin);
}
