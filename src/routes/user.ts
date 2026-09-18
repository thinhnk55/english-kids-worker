import {
  handleGetTopic,
  handleListTopics,
} from '../features/topics/handlers.ts';
import {
  handleGetLexical,
  handleListLexicals,
} from '../features/lexicals/handlers.ts';
import {
  handleGetSentence,
  handleListSentences,
} from '../features/sentences/handlers.ts';
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

  // Sentences User Routes
  if (path === '/sentences') {
    if (request.method === 'GET') return handleListSentences(request, env, origin);
  }

  const sentenceMatch = path.match(/^\/sentences\/([^/]+)$/);
  if (sentenceMatch) {
    if (request.method === 'GET') return handleGetSentence(env, origin, sentenceMatch[1]);
  }

  // Lexicals User Routes
  if (path === '/lexicals') {
    if (request.method === 'GET') return handleListLexicals(request, env, origin);
  }

  const lexicalMatch = path.match(/^\/lexicals\/([^/]+)$/);
  if (lexicalMatch) {
    if (request.method === 'GET') return handleGetLexical(env, origin, lexicalMatch[1]);
  }

  // Texts Legacy User Routes
  if (path === '/texts') {
    if (request.method === 'GET') return handleListTexts(request, env, origin);
  }

  const textMatch = path.match(/^\/texts\/([^/]+)$/);
  if (textMatch) {
    if (request.method === 'GET') return handleGetText(env, origin, textMatch[1]);
  }

  // Topics User Routes
  if (path === '/topics') {
    if (request.method === 'GET') return handleListTopics(env, origin);
  }

  const topicMatch = path.match(/^\/topics\/([^/]+)$/);
  if (topicMatch) {
    if (request.method === 'GET') return handleGetTopic(env, origin, topicMatch[1]);
  }

  return errorResponse(404, 'NOT_FOUND', 'User endpoint not found', origin);
}
