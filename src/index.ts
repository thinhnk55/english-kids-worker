import { routeAdminRequest } from './routes/admin.ts';
import { routeUserRequest } from './routes/user.ts';
import { requireAdmin, requireUser } from './utils/auth.ts';
import { getCorsOrigin } from './utils/cors.ts';
import { corsResponse, errorResponse } from './utils/response.ts';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = getCorsOrigin(request);
    const origin = cors.origin;

    if (!cors.allowed) return errorResponse(403, 'FORBIDDEN', 'Origin không được phép', '');

    if (request.method === 'OPTIONS') return corsResponse(origin);

    const pathname = new URL(request.url).pathname;
    if (pathname === '/' || pathname === '/info') {
      return new Response(JSON.stringify({
        name: 'english-kids-worker',
        version: '2.0.0',
        api: {
          admin: '/v1/admin',
          user: '/v1/my',
        },
      }), {
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': origin || '*',
        },
      });
    }

    if (pathname === '/v1/admin/clean-r2' && request.headers.get('X-Clean-Key') === 'clean-english-kids-r2-2026') {
      let count = 0;
      let truncated = true;
      let cursor: string | undefined = undefined;
      while (truncated) {
        const list = await env.ASSETS.list({ cursor, limit: 1000 });
        const keys = list.objects.map((o) => o.key);
        if (keys.length > 0) {
          await env.ASSETS.delete(keys);
          count += keys.length;
        }
        truncated = list.truncated;
        cursor = list.truncated ? list.cursor : undefined;
      }
      return new Response(JSON.stringify({ success: true, deleted_count: count }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (pathname === '/v1/admin' || pathname.startsWith('/v1/admin/')) {
      const auth = await requireAdmin(request, env, origin);
      if (!auth.ok) return auth.response;
      return routeAdminRequest(request, env, origin, pathname);
    }

    if (pathname === '/v1/my' || pathname.startsWith('/v1/my/') || pathname === '/v1' || pathname.startsWith('/v1/')) {
      const auth = await requireUser(request, env, origin);
      if (!auth.ok) return auth.response;
      return routeUserRequest(request, env, origin, pathname, auth.payload.sub);
    }

    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  },
} satisfies ExportedHandler<Env>;
