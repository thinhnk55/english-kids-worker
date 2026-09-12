import {
  handleCreateTaxonomy,
  handleCreateTaxonomyTerm,
  handleDeleteTaxonomy,
  handleDeleteTaxonomyTerm,
  handleGetTaxonomy,
  handleGetTextTerms,
  handleListTaxonomies,
  handleReplaceTextTerms,
  handleUpdateTaxonomy,
  handleUpdateTaxonomyTerm,
} from '../features/classification/handlers.ts';
import {
  handleBatchAssignTerms,
  handleBatchDeleteTexts,
} from '../features/texts/batch.ts';
import {
  handleCreateText,
  handleDeleteText,
  handleGetText,
  handleListTexts,
  handleUpdateText,
} from '../features/texts/handlers.ts';
import {
  handleCommitBatchImport,
  handlePreviewBatchImport,
} from '../features/texts/import.ts';
import { errorResponse } from '../utils/response.ts';

function methodNotAllowed(origin: string): Response {
  return errorResponse(405, 'BAD_REQUEST', 'Method not allowed', origin);
}

export async function routeAdminRequest(
  request: Request,
  env: Env,
  origin: string,
  pathname: string,
): Promise<Response> {
  const path = pathname.slice('/v1/admin'.length) || '/';

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', scope: 'admin' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // Taxonomy Routes
  if (path === '/taxonomies') {
    if (request.method === 'GET') return handleListTaxonomies(request, env, origin);
    if (request.method === 'POST') return handleCreateTaxonomy(request, env, origin);
    return methodNotAllowed(origin);
  }

  const taxonomyTermsMatch = path.match(/^\/taxonomies\/([^/]+)\/terms$/);
  if (taxonomyTermsMatch) {
    return request.method === 'POST'
      ? handleCreateTaxonomyTerm(request, env, origin, taxonomyTermsMatch[1])
      : methodNotAllowed(origin);
  }

  const taxonomyMatch = path.match(/^\/taxonomies\/([^/]+)$/);
  if (taxonomyMatch) {
    if (request.method === 'GET') return handleGetTaxonomy(env, origin, taxonomyMatch[1]);
    if (request.method === 'PUT') return handleUpdateTaxonomy(request, env, origin, taxonomyMatch[1]);
    if (request.method === 'DELETE') return handleDeleteTaxonomy(env, origin, taxonomyMatch[1]);
    return methodNotAllowed(origin);
  }

  const taxonomyTermMatch = path.match(/^\/taxonomy-terms\/([^/]+)$/);
  if (taxonomyTermMatch) {
    if (request.method === 'PUT') return handleUpdateTaxonomyTerm(request, env, origin, taxonomyTermMatch[1]);
    if (request.method === 'DELETE') return handleDeleteTaxonomyTerm(env, origin, taxonomyTermMatch[1]);
    return methodNotAllowed(origin);
  }

  // Texts Batch Routes
  if (path === '/texts/import/preview') {
    return request.method === 'POST' ? handlePreviewBatchImport(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/texts/import') {
    return request.method === 'POST' ? handleCommitBatchImport(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/texts/batch-delete') {
    return request.method === 'POST' ? handleBatchDeleteTexts(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/texts/batch-terms') {
    return request.method === 'PUT' ? handleBatchAssignTerms(request, env, origin) : methodNotAllowed(origin);
  }

  // Text Terms Route
  const textTermsMatch = path.match(/^\/texts\/([^/]+)\/terms$/);
  if (textTermsMatch) {
    if (request.method === 'GET') return handleGetTextTerms(env, origin, textTermsMatch[1]);
    if (request.method === 'PUT') return handleReplaceTextTerms(request, env, origin, textTermsMatch[1]);
    return methodNotAllowed(origin);
  }

  // Texts CRUD Routes
  if (path === '/texts') {
    if (request.method === 'GET') return handleListTexts(request, env, origin);
    if (request.method === 'POST') return handleCreateText(request, env, origin);
    return methodNotAllowed(origin);
  }

  const textMatch = path.match(/^\/texts\/([^/]+)$/);
  if (textMatch) {
    if (request.method === 'GET') return handleGetText(env, origin, textMatch[1]);
    if (request.method === 'PUT') return handleUpdateText(request, env, origin, textMatch[1]);
    if (request.method === 'DELETE') return handleDeleteText(env, origin, textMatch[1]);
    return methodNotAllowed(origin);
  }

  return errorResponse(404, 'NOT_FOUND', 'Admin endpoint not found', origin);
}
