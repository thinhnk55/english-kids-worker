import {
  handleGetTopic,
  handleListTopics,
} from '../features/topics/handlers.ts';
import {
  handleGetEnglishInstruction,
  handleListEnglishInstructions,
} from '../features/english-instructions/handlers.ts';
import { errorResponse } from '../utils/response.ts';
import { getLexical, listLexicals } from '../features/lexicals/handlers.ts';

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

  // English Instruction Routes
  if (path === '/lexicals' && request.method === 'GET') return listLexicals(request, env, origin);
  const lexicalMatch = path.match(/^\/lexicals\/([^/]+)$/);
  if (lexicalMatch && request.method === 'GET') return getLexical(env, origin, lexicalMatch[1]);

  if (path === '/english-instructions') {
    if (request.method === 'GET') return handleListEnglishInstructions(request, env, origin);
  }

  const instructionMatch = path.match(/^\/english-instructions\/([^/]+)$/);
  if (instructionMatch) {
    if (request.method === 'GET') return handleGetEnglishInstruction(env, origin, instructionMatch[1]);
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
