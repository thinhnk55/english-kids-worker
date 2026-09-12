import {
  handleCreateTaxonomy,
  handleCreateTaxonomyTerm,
  handleDeleteTaxonomy,
  handleDeleteTaxonomyTerm,
  handleGetTaxonomy,
  handleGetTaxonomyTerms,
  handleGetTerm,
  handleListTaxonomies,
  handleUpdateTaxonomy,
  handleUpdateTaxonomyTerm,
} from '../features/classification/handlers.ts';
import {
  handleBatchDeleteLexicals,
  handleCreateLexical,
  handleDeleteLexical,
  handleGetLexical,
  handleListLexicals,
  handleUpdateLexical,
} from '../features/lexicals/handlers.ts';
import {
  handleBatchDeleteSentences,
  handleCreateSentence,
  handleDeleteSentence,
  handleGetSentence,
  handleListSentences,
  handleUpdateSentence,
  handleUpdateSentenceLexicals,
} from '../features/sentences/handlers.ts';
import {
  handleBatchDeleteTexts,
} from '../features/texts/batch.ts';
import {
  handleCreateText,
  handleDeleteText,
  handleGetText,
  handleListTexts,
  handleUpdateText,
  handleUpdateTextLexicals,
} from '../features/texts/handlers.ts';
import {
  handleCommitBatchImport,
  handlePreviewBatchImport,
} from '../features/texts/import.ts';
import {
  handleAddLexicalAudio,
  handleAddLexicalImage,
  handleAddLexicalVideo,
  handleAddSentenceAudio,
  handleAddTextAudio,
  handleAddTextImage,
  handleAddTextVideo,
  handleDeleteLexicalAudio,
  handleDeleteLexicalImage,
  handleDeleteLexicalVideo,
  handleDeleteR2Asset,
  handleDeleteSentenceAudio,
  handleDeleteTextAudio,
  handleDeleteTextImage,
  handleDeleteTextVideo,
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
    if (request.method === 'GET') return handleGetTaxonomyTerms(env, origin, taxonomyTermsMatch[1]);
    if (request.method === 'POST') return handleCreateTaxonomyTerm(request, env, origin, taxonomyTermsMatch[1]);
    return methodNotAllowed(origin);
  }

  const taxonomyMatch = path.match(/^\/taxonomies\/([^/]+)$/);
  if (taxonomyMatch) {
    if (request.method === 'GET') return handleGetTaxonomy(env, origin, taxonomyMatch[1]);
    if (request.method === 'PUT') return handleUpdateTaxonomy(request, env, origin, taxonomyMatch[1]);
    if (request.method === 'DELETE') return handleDeleteTaxonomy(env, origin, taxonomyMatch[1]);
    return methodNotAllowed(origin);
  }

  if (path === '/terms') {
    if (request.method === 'POST') return handleCreateTaxonomyTerm(request, env, origin);
    return methodNotAllowed(origin);
  }

  const termMatch = path.match(/^\/(?:terms|taxonomy-terms)\/([^/]+)$/);
  if (termMatch) {
    if (request.method === 'GET') return handleGetTerm(env, origin, termMatch[1]);
    if (request.method === 'PUT') return handleUpdateTaxonomyTerm(request, env, origin, termMatch[1]);
    if (request.method === 'DELETE') return handleDeleteTaxonomyTerm(env, origin, termMatch[1]);
    return methodNotAllowed(origin);
  }

  // Sentences Routes
  if (path === '/sentences/import/preview' || path === '/sentences/batch-import/preview') {
    return request.method === 'POST' ? handlePreviewBatchImport(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/sentences/import' || path === '/sentences/batch-import/commit') {
    return request.method === 'POST' ? handleCommitBatchImport(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/sentences/batch-delete') {
    return request.method === 'POST' ? handleBatchDeleteSentences(request, env, origin) : methodNotAllowed(origin);
  }

  const sentenceAudioItemMatch = path.match(/^\/sentences\/([^/]+)\/audios\/([^/]+)$/);
  if (sentenceAudioItemMatch) {
    return request.method === 'DELETE'
      ? handleDeleteSentenceAudio(env, origin, sentenceAudioItemMatch[1], sentenceAudioItemMatch[2])
      : methodNotAllowed(origin);
  }

  const sentenceAudiosMatch = path.match(/^\/sentences\/([^/]+)\/audios$/);
  if (sentenceAudiosMatch) {
    return request.method === 'POST'
      ? handleAddSentenceAudio(request, env, origin, sentenceAudiosMatch[1])
      : methodNotAllowed(origin);
  }

  const sentenceLexicalsMatch = path.match(/^\/sentences\/([^/]+)\/lexicals$/);
  if (sentenceLexicalsMatch) {
    return request.method === 'PUT'
      ? handleUpdateSentenceLexicals(request, env, origin, sentenceLexicalsMatch[1])
      : methodNotAllowed(origin);
  }

  if (path === '/sentences') {
    if (request.method === 'GET') return handleListSentences(request, env, origin);
    if (request.method === 'POST') return handleCreateSentence(request, env, origin);
    return methodNotAllowed(origin);
  }

  const sentenceMatch = path.match(/^\/sentences\/([^/]+)$/);
  if (sentenceMatch) {
    if (request.method === 'GET') return handleGetSentence(env, origin, sentenceMatch[1]);
    if (request.method === 'PUT') return handleUpdateSentence(request, env, origin, sentenceMatch[1]);
    if (request.method === 'DELETE') return handleDeleteSentence(env, origin, sentenceMatch[1]);
    return methodNotAllowed(origin);
  }

  // Lexicals Routes
  if (path === '/lexicals/batch-delete') {
    return request.method === 'POST' ? handleBatchDeleteLexicals(request, env, origin) : methodNotAllowed(origin);
  }

  const lexicalAudioItemMatch = path.match(/^\/lexicals\/([^/]+)\/audios\/([^/]+)$/);
  if (lexicalAudioItemMatch) {
    return request.method === 'DELETE'
      ? handleDeleteLexicalAudio(env, origin, lexicalAudioItemMatch[1], lexicalAudioItemMatch[2])
      : methodNotAllowed(origin);
  }

  const lexicalAudiosMatch = path.match(/^\/lexicals\/([^/]+)\/audios$/);
  if (lexicalAudiosMatch) {
    return request.method === 'POST'
      ? handleAddLexicalAudio(request, env, origin, lexicalAudiosMatch[1])
      : methodNotAllowed(origin);
  }

  const lexicalImageItemMatch = path.match(/^\/lexicals\/([^/]+)\/images\/([^/]+)$/);
  if (lexicalImageItemMatch) {
    return request.method === 'DELETE'
      ? handleDeleteLexicalImage(env, origin, lexicalImageItemMatch[1], lexicalImageItemMatch[2])
      : methodNotAllowed(origin);
  }

  const lexicalImagesMatch = path.match(/^\/lexicals\/([^/]+)\/images$/);
  if (lexicalImagesMatch) {
    return request.method === 'POST'
      ? handleAddLexicalImage(request, env, origin, lexicalImagesMatch[1])
      : methodNotAllowed(origin);
  }

  const lexicalVideoItemMatch = path.match(/^\/lexicals\/([^/]+)\/videos\/([^/]+)$/);
  if (lexicalVideoItemMatch) {
    return request.method === 'DELETE'
      ? handleDeleteLexicalVideo(env, origin, lexicalVideoItemMatch[1], lexicalVideoItemMatch[2])
      : methodNotAllowed(origin);
  }

  const lexicalVideosMatch = path.match(/^\/lexicals\/([^/]+)\/videos$/);
  if (lexicalVideosMatch) {
    return request.method === 'POST'
      ? handleAddLexicalVideo(request, env, origin, lexicalVideosMatch[1])
      : methodNotAllowed(origin);
  }

  if (path === '/lexicals') {
    if (request.method === 'GET') return handleListLexicals(request, env, origin);
    if (request.method === 'POST') return handleCreateLexical(request, env, origin);
    return methodNotAllowed(origin);
  }

  const lexicalMatch = path.match(/^\/lexicals\/([^/]+)$/);
  if (lexicalMatch) {
    if (request.method === 'GET') return handleGetLexical(env, origin, lexicalMatch[1]);
    if (request.method === 'PUT') return handleUpdateLexical(request, env, origin, lexicalMatch[1]);
    if (request.method === 'DELETE') return handleDeleteLexical(env, origin, lexicalMatch[1]);
    return methodNotAllowed(origin);
  }

  // Texts Legacy Batch Routes
  if (path === '/texts/import/preview' || path === '/texts/batch-import/preview') {
    return request.method === 'POST' ? handlePreviewBatchImport(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/texts/import' || path === '/texts/batch-import/commit') {
    return request.method === 'POST' ? handleCommitBatchImport(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/texts/batch-delete') {
    return request.method === 'POST' ? handleBatchDeleteTexts(request, env, origin) : methodNotAllowed(origin);
  }

  // Text Legacy Media Routes
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

  // Text Legacy Lexicals Route
  const textLexicalsMatch = path.match(/^\/texts\/([^/]+)\/lexicals$/);
  if (textLexicalsMatch) {
    return request.method === 'PUT'
      ? handleUpdateTextLexicals(request, env, origin, textLexicalsMatch[1])
      : methodNotAllowed(origin);
  }

  // Texts Legacy CRUD Routes
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
