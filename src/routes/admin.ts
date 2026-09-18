import {
  handleCreateTopic,
  handleDeleteTopic,
  handleGetTopic,
  handleListTopics,
  handleUpdateTopic,
} from '../features/topics/handlers.ts';
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
  handleCommitBatchImport,
  handlePreviewBatchImport,
} from '../features/sentences/import.ts';
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

  // Topic Routes
  if (path === '/topics') {
    if (request.method === 'GET') return handleListTopics(env, origin);
    if (request.method === 'POST') return handleCreateTopic(request, env, origin);
    return methodNotAllowed(origin);
  }

  const topicMatch = path.match(/^\/topics\/([^/]+)$/);
  if (topicMatch) {
    if (request.method === 'GET') return handleGetTopic(env, origin, topicMatch[1]);
    if (request.method === 'PUT') return handleUpdateTopic(request, env, origin, topicMatch[1]);
    if (request.method === 'DELETE') return handleDeleteTopic(env, origin, topicMatch[1]);
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

  return errorResponse(404, 'NOT_FOUND', 'Admin endpoint not found', origin);
}
