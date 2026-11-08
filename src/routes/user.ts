import {
  handleGetSession,
  handleListProfileSessions,
  handleSessionMessage,
  handleStartSession,
} from '../features/ai-talk/session/user.ts';
import {
  handleCreateProfile,
  handleDeleteProfile,
  handleListProfiles,
  handleUpdateProfile,
} from '../features/profile/handlers.ts';
import { errorResponse } from '../utils/response.ts';

export async function routeUserRequest(
  request: Request,
  env: Env,
  origin: string,
  pathname: string,
  userIdStr: string,
): Promise<Response> {
  const userId = Number(userIdStr);
  if (!userId || isNaN(userId)) {
    return errorResponse(401, 'UNAUTHORIZED', undefined, origin);
  }

  const method = request.method;

  // --- Profiles ---
  if (pathname === '/v1/my/profiles') {
    if (method === 'GET') return handleListProfiles(userId, env, origin);
    if (method === 'POST') return handleCreateProfile(request, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const profileMatch = pathname.match(/^\/v1\/my\/profiles\/(\d+)$/);
  if (profileMatch) {
    const profileId = Number(profileMatch[1]);
    if (method === 'PUT') return handleUpdateProfile(request, profileId, userId, env, origin);
    if (method === 'DELETE') return handleDeleteProfile(profileId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- AI Talk Sessions ---
  if (pathname === '/v1/my/ai-talk/sessions') {
    if (method === 'GET') return handleListProfileSessions(request, userId, env, origin);
    if (method === 'POST') return handleStartSession(request, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const sessionMessagesMatch = pathname.match(/^\/v1\/my\/ai-talk\/sessions\/(\d+)\/messages$/);
  if (sessionMessagesMatch) {
    const sessionId = Number(sessionMessagesMatch[1]);
    if (method === 'POST') return handleSessionMessage(request, sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const sessionMatch = pathname.match(/^\/v1\/my\/ai-talk\/sessions\/(\d+)$/);
  if (sessionMatch) {
    const sessionId = Number(sessionMatch[1]);
    if (method === 'GET') return handleGetSession(sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  return errorResponse(404, 'NOT_FOUND', undefined, origin);
}
