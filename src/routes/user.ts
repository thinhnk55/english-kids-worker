import { errorResponse } from '../utils/response.ts';

export async function routeUserRequest(
  _request: Request,
  _env: Env,
  origin: string,
  pathname: string,
  userId: string,
  userRole?: string,
): Promise<Response> {
  const path = pathname.slice('/v1'.length) || '/';

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', scope: 'user', userId, userRole }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  return errorResponse(404, 'NOT_FOUND', 'User endpoint not found', origin);
}
