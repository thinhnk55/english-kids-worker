import {
  handleGetTaxonomy,
  handleGetTaxonomyTerms,
  handleGetTerm,
  handleListTaxonomies,
} from '../features/classification/handlers.ts';
import {
  handleGetText,
  handleListTexts,
} from '../features/texts/handlers.ts';
import { errorResponse } from '../utils/response.ts';

export async function routeUserRequest(
  request: Request,
  env: Env,
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

  // Texts User Routes
  if (path === '/texts') {
    if (request.method === 'GET') return handleListTexts(request, env, origin);
  }

  const textMatch = path.match(/^\/texts\/([^/]+)$/);
  if (textMatch) {
    if (request.method === 'GET') return handleGetText(env, origin, textMatch[1]);
  }

  // Taxonomies & Terms User Routes
  if (path === '/taxonomies') {
    if (request.method === 'GET') return handleListTaxonomies(request, env, origin);
  }

  const taxonomyTermsMatch = path.match(/^\/taxonomies\/([^/]+)\/terms$/);
  if (taxonomyTermsMatch) {
    if (request.method === 'GET') return handleGetTaxonomyTerms(env, origin, taxonomyTermsMatch[1]);
  }

  const taxonomyMatch = path.match(/^\/taxonomies\/([^/]+)$/);
  if (taxonomyMatch) {
    if (request.method === 'GET') return handleGetTaxonomy(env, origin, taxonomyMatch[1]);
  }

  const termMatch = path.match(/^\/(?:terms|taxonomy-terms)\/([^/]+)$/);
  if (termMatch) {
    if (request.method === 'GET') return handleGetTerm(env, origin, termMatch[1]);
  }

  return errorResponse(404, 'NOT_FOUND', 'User endpoint not found', origin);
}
