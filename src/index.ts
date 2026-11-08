import { handleGetCatalog } from './features/catalog/handlers.ts';
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
          public: '/v1/catalogs',
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

    // Public published catalogs (no auth required for lightning speed)
    if (pathname.startsWith('/v1/catalogs/')) {
      const key = decodeURIComponent(pathname.slice('/v1/catalogs/'.length));
      if (request.method !== 'GET') return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
      return handleGetCatalog(key, env, origin);
    }

    // Admin routes
    if (pathname === '/v1/admin' || pathname.startsWith('/v1/admin/')) {
      const auth = await requireAdmin(request, env, origin);
      if (!auth.ok) return auth.response;
      return routeAdminRequest(request, env, origin, pathname);
    }

    // User routes
    if (pathname === '/v1/my' || pathname.startsWith('/v1/my/') || pathname === '/v1' || pathname.startsWith('/v1/')) {
      const auth = await requireUser(request, env, origin);
      if (!auth.ok) return auth.response;
      return routeUserRequest(request, env, origin, pathname, auth.payload.sub);
    }

    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  },
} satisfies ExportedHandler<Env>;
