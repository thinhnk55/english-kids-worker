import { errorResponse } from '../utils/response.ts';

export async function routeAdminRequest(
  _request: Request,
  _env: Env,
  origin: string,
  pathname: string,
): Promise<Response> {
  const path = pathname.slice('/v1/admin'.length) || '/';

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', scope: 'admin' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  return errorResponse(404, 'NOT_FOUND', 'Admin endpoint not found', origin);
}
