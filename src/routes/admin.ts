import {
  handleCreateTopic,
  handleDeleteTopic,
  handleGetTopic,
  handleListTopics,
  handleUpdateTopic,
} from '../features/topics/handlers.ts';
import {
  handleBatchDeleteEnglishInstructions,
  handleCreateEnglishInstruction,
  handleDeleteEnglishInstruction,
  handleGetEnglishInstruction,
  handleListEnglishInstructions,
  handleUpdateEnglishInstruction,
} from '../features/english-instructions/handlers.ts';
import {
  confirmInstructionAudio,
  createInstructionAudioPresign,
  deleteInstructionAudioAsset,
} from '../features/english-instructions/media-handlers.ts';
import {
  confirmTopicImage,
  createTopicImagePresign,
  deleteTopicImageAsset,
} from '../features/topics/media-handlers.ts';
import { errorResponse } from '../utils/response.ts';
import { batchDeleteLexicals, createLexical, deleteLexical, duplicateLexical, getLexical, listLexicals, updateLexical } from '../features/lexicals/handlers.ts';

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

  const topicImagePresignMatch = path.match(/^\/topics\/([^/]+)\/image\/presign$/);
  if (topicImagePresignMatch) {
    return request.method === 'POST'
      ? createTopicImagePresign(request, env, origin, topicImagePresignMatch[1])
      : methodNotAllowed(origin);
  }

  const topicImageMatch = path.match(/^\/topics\/([^/]+)\/image$/);
  if (topicImageMatch) {
    if (request.method === 'POST') return confirmTopicImage(env, origin, topicImageMatch[1]);
    if (request.method === 'DELETE') return deleteTopicImageAsset(env, origin, topicImageMatch[1]);
    return methodNotAllowed(origin);
  }

  const topicMatch = path.match(/^\/topics\/([^/]+)$/);
  if (topicMatch) {
    if (request.method === 'GET') return handleGetTopic(env, origin, topicMatch[1]);
    if (request.method === 'PUT') return handleUpdateTopic(request, env, origin, topicMatch[1]);
    if (request.method === 'DELETE') return handleDeleteTopic(env, origin, topicMatch[1]);
    return methodNotAllowed(origin);
  }

  // English Instruction Routes
  if (path === '/lexicals/batch-delete') return request.method === 'POST' ? batchDeleteLexicals(request, env, origin) : methodNotAllowed(origin);
  if (path === '/lexicals') {
    if (request.method === 'GET') return listLexicals(request, env, origin);
    if (request.method === 'POST') return createLexical(request, env, origin);
    return methodNotAllowed(origin);
  }
  const lexicalDuplicateMatch = path.match(/^\/lexicals\/([^/]+)\/duplicate$/);
  if (lexicalDuplicateMatch) return request.method === 'POST' ? duplicateLexical(env, origin, lexicalDuplicateMatch[1]) : methodNotAllowed(origin);
  const lexicalMatch = path.match(/^\/lexicals\/([^/]+)$/);
  if (lexicalMatch) {
    if (request.method === 'GET') return getLexical(env, origin, lexicalMatch[1]);
    if (request.method === 'PUT') return updateLexical(request, env, origin, lexicalMatch[1]);
    if (request.method === 'DELETE') return deleteLexical(env, origin, lexicalMatch[1]);
    return methodNotAllowed(origin);
  }

  if (path === '/english-instructions/batch-delete') {
    return request.method === 'POST' ? handleBatchDeleteEnglishInstructions(request, env, origin) : methodNotAllowed(origin);
  }

  if (path === '/english-instructions') {
    if (request.method === 'GET') return handleListEnglishInstructions(request, env, origin);
    if (request.method === 'POST') return handleCreateEnglishInstruction(request, env, origin);
    return methodNotAllowed(origin);
  }

  const instructionAudioPresignMatch = path.match(/^\/english-instructions\/([^/]+)\/audio\/presign$/);
  if (instructionAudioPresignMatch) {
    return request.method === 'POST'
      ? createInstructionAudioPresign(request, env, origin, instructionAudioPresignMatch[1])
      : methodNotAllowed(origin);
  }

  const instructionAudioMatch = path.match(/^\/english-instructions\/([^/]+)\/audio$/);
  if (instructionAudioMatch) {
    if (request.method === 'POST') return confirmInstructionAudio(env, origin, instructionAudioMatch[1]);
    if (request.method === 'DELETE') return deleteInstructionAudioAsset(env, origin, instructionAudioMatch[1]);
    return methodNotAllowed(origin);
  }

  const instructionMatch = path.match(/^\/english-instructions\/([^/]+)$/);
  if (instructionMatch) {
    if (request.method === 'GET') return handleGetEnglishInstruction(env, origin, instructionMatch[1]);
    if (request.method === 'PUT') return handleUpdateEnglishInstruction(request, env, origin, instructionMatch[1]);
    if (request.method === 'DELETE') return handleDeleteEnglishInstruction(env, origin, instructionMatch[1]);
    return methodNotAllowed(origin);
  }

  return errorResponse(404, 'NOT_FOUND', 'Admin endpoint not found', origin);
}
