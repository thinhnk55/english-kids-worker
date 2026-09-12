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
import {
  handleAddTextAudio,
  handleAddTextImage,
  handleAddTextVideo,
  handleDeleteR2Asset,
  handleDeleteTextAudio,
  handleDeleteTextImage,
  handleDeleteTextVideo,
  handleUpdateTextLexicals,
  handleUploadR2Asset,
} from '../features/texts/media.ts';
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

  // Upload Route
  if (path === '/upload') {
    if (request.method === 'POST') return handleUploadR2Asset(request, env, origin);
    if (request.method === 'DELETE') return handleDeleteR2Asset(request, env, origin);
    return methodNotAllowed(origin);
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
  if (path === '/texts/import/preview' || path === '/texts/batch-import/preview') {
    return request.method === 'POST' ? handlePreviewBatchImport(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/texts/import' || path === '/texts/batch-import/commit') {
    return request.method === 'POST' ? handleCommitBatchImport(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/texts/batch-delete') {
    return request.method === 'POST' ? handleBatchDeleteTexts(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/texts/batch-terms') {
    return request.method === 'PUT' || request.method === 'POST' ? handleBatchAssignTerms(request, env, origin) : methodNotAllowed(origin);
  }

  // Text Media Routes
  const textAudioItemMatch = path.match(/^\/texts\/([^/]+)\/audios\/([^/]+)$/);
  if (textAudioItemMatch) {
    return request.method === 'DELETE'
      ? handleDeleteTextAudio(env, origin, textAudioItemMatch[1], textAudioItemMatch[2])
      : methodNotAllowed(origin);
  }

  const textAudiosMatch = path.match(/^\/texts\/([^/]+)\/audios$/);
  if (textAudiosMatch) {
    return request.method === 'POST'
      ? handleAddTextAudio(request, env, origin, textAudiosMatch[1])
      : methodNotAllowed(origin);
  }

  const textImageItemMatch = path.match(/^\/texts\/([^/]+)\/images\/([^/]+)$/);
  if (textImageItemMatch) {
    return request.method === 'DELETE'
      ? handleDeleteTextImage(env, origin, textImageItemMatch[1], textImageItemMatch[2])
      : methodNotAllowed(origin);
  }

  const textImagesMatch = path.match(/^\/texts\/([^/]+)\/images$/);
  if (textImagesMatch) {
    return request.method === 'POST'
      ? handleAddTextImage(request, env, origin, textImagesMatch[1])
      : methodNotAllowed(origin);
  }

  const textVideoItemMatch = path.match(/^\/texts\/([^/]+)\/videos\/([^/]+)$/);
  if (textVideoItemMatch) {
    return request.method === 'DELETE'
      ? handleDeleteTextVideo(env, origin, textVideoItemMatch[1], textVideoItemMatch[2])
      : methodNotAllowed(origin);
  }

  const textVideosMatch = path.match(/^\/texts\/([^/]+)\/videos$/);
  if (textVideosMatch) {
    return request.method === 'POST'
      ? handleAddTextVideo(request, env, origin, textVideosMatch[1])
      : methodNotAllowed(origin);
  }

  // Text Lexicals Route
  const textLexicalsMatch = path.match(/^\/texts\/([^/]+)\/lexicals$/);
  if (textLexicalsMatch) {
    return request.method === 'PUT'
      ? handleUpdateTextLexicals(request, env, origin, textLexicalsMatch[1])
      : methodNotAllowed(origin);
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
