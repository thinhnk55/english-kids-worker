import type { PublishedCatalog } from '../../types/catalog.ts';
import { buildCorsHeaders } from '../../utils/cors.ts';
import { errorResponse } from '../../utils/response.ts';

export async function handleGetCatalog(
  key: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const catalog = await env.DB.prepare(
    'SELECT payload FROM published_catalogs WHERE key = ?',
  )
    .bind(key)
    .first<Pick<PublishedCatalog, 'payload'>>();

  if (!catalog) {
    return errorResponse(404, 'NOT_FOUND', 'Catalog not found', origin);
  }

  return new Response(catalog.payload, {
    status: 200,
    headers: new Headers({
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60, s-maxage=300',
      ...buildCorsHeaders(origin),
    }),
  });
}
