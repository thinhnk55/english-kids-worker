import {
  handleGetMessageAudio,
  handleGetSession,
  handleListProfileSessions,
  handleSessionMessage,
  handleSessionVoiceMessage,
  handleStartSession,
  handleSynthesizeGeneralText,
} from '../features/ai-talk/session/user.ts';
import {
  handleCreateProfile,
  handleDeleteProfile,
  handleListProfiles,
  handleUpdateProfile,
} from '../features/profile/handlers.ts';
import { errorResponse } from '../utils/response.ts';

export async function routeUserRequest(
  request: Request,
  env: Env,
  origin: string,
  pathname: string,
  userIdStr: string,
): Promise<Response> {
  const userId = Number(userIdStr);
  if (!userId || isNaN(userId)) {
    return errorResponse(401, 'UNAUTHORIZED', undefined, origin);
  }

  const method = request.method;

  // --- Profiles ---
  if (pathname === '/v1/my/profiles') {
    if (method === 'GET') return handleListProfiles(userId, env, origin);
    if (method === 'POST') return handleCreateProfile(request, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  const profileMatch = pathname.match(/^\/v1\/my\/profiles\/(\d+)$/);
  if (profileMatch) {
    const profileId = Number(profileMatch[1]);
    if (method === 'PUT') return handleUpdateProfile(request, profileId, userId, env, origin);
    if (method === 'DELETE') return handleDeleteProfile(profileId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- TTS độc lập cho bé nghe phát âm bất kỳ câu nào ---
  if (pathname === '/v1/my/ai-talk/tts' || pathname === '/v1/ai-talk/tts') {
    if (method === 'POST') return handleSynthesizeGeneralText(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- AI Talk Sessions ---
  if (pathname === '/v1/my/ai-talk/sessions' || pathname === '/v1/ai-talk/sessions' || pathname === '/v1/ai-talk/sessions/start' || pathname === '/v1/my/ai-talk/sessions/start') {
    if (method === 'GET') return handleListProfileSessions(request, userId, env, origin);
    if (method === 'POST') return handleStartSession(request, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Gửi giọng nói (STT -> LLM response)
  const voiceMessageMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/messages\/voice$/);
  if (voiceMessageMatch) {
    const sessionId = Number(voiceMessageMatch[1]);
    if (method === 'POST') return handleSessionVoiceMessage(request, sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Lấy audio phát âm (TTS) cho 1 tin nhắn cụ thể của AI trong phiên
  const audioMessageMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/messages\/(\d+)\/audio$/);
  if (audioMessageMatch) {
    const sessionId = Number(audioMessageMatch[1]);
    const messageIndex = Number(audioMessageMatch[2]);
    if (method === 'GET') return handleGetMessageAudio(sessionId, messageIndex, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // TTS cho câu nói trong phiên
  const sessionTtsMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/tts$/);
  if (sessionTtsMatch) {
    if (method === 'POST') return handleSynthesizeGeneralText(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Gửi tin nhắn dạng văn bản (Text -> LLM response)
  const sessionMessagesMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/messages(?:\/text)?$/);
  if (sessionMessagesMatch) {
    const sessionId = Number(sessionMessagesMatch[1]);
    if (method === 'POST') return handleSessionMessage(request, sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Kết thúc phiên
  const sessionEndMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/end$/);
  if (sessionEndMatch) {
    const sessionId = Number(sessionEndMatch[1]);
    if (method === 'POST') return handleGetSession(sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Lấy chi tiết phiên
  const sessionMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)$/);
  if (sessionMatch) {
    const sessionId = Number(sessionMatch[1]);
    if (method === 'GET') return handleGetSession(sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  return errorResponse(404, 'NOT_FOUND', undefined, origin);
}
