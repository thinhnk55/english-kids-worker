import {
  handleGetSession,
  handleListProfileSessions,
  handleSessionLlmChat,
  handleSessionMessage,
  handleSessionVoiceMessage,
  handleStartSession,
  handleSynthesizeGeneralText,
  handleUpdateSession,
} from '../features/ai-talk/session/user.ts';
import { handleGetMyCredits } from '../features/credit/handlers.ts';
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

  // --- Credits ---
  if (pathname === '/v1/my/credits') {
    if (method === 'GET') return handleGetMyCredits(userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

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

  // --- LLM Chat Completion (Client quyết định prompt, BE khóa cứng 500 max_tokens) ---
  if (pathname === '/v1/my/ai-talk/chat' || pathname === '/v1/ai-talk/chat') {
    if (method === 'POST') return handleSessionLlmChat(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- TTS độc lập cho bé nghe phát âm bất kỳ câu nào ---
  if (pathname === '/v1/my/ai-talk/tts' || pathname === '/v1/ai-talk/tts') {
    if (method === 'POST') return handleSynthesizeGeneralText(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // --- AI Talk Sessions List & Start ---
  if (pathname === '/v1/my/ai-talk/sessions' || pathname === '/v1/ai-talk/sessions' || pathname === '/v1/ai-talk/sessions/start' || pathname === '/v1/my/ai-talk/sessions/start') {
    if (method === 'GET') return handleListProfileSessions(request, userId, env, origin);
    if (method === 'POST') return handleStartSession(request, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Gửi giọng nói (STT)
  const voiceMessageMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/messages\/voice$/);
  if (voiceMessageMatch) {
    if (method === 'POST') return handleSessionVoiceMessage(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // TTS cho câu nói trong phiên
  const sessionTtsMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/tts$/);
  if (sessionTtsMatch) {
    if (method === 'POST') return handleSynthesizeGeneralText(request, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Gửi tin nhắn / lưu lượt hội thoại của Client (BE kiểm tra chặn số turn tối đa)
  const sessionMessagesMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/messages(?:\/text)?$/);
  if (sessionMessagesMatch) {
    const sessionId = Number(sessionMessagesMatch[1]);
    if (method === 'POST') return handleSessionMessage(request, sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Kết thúc phiên hoặc cập nhật trạng thái session
  const sessionEndMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)\/end$/);
  if (sessionEndMatch) {
    const sessionId = Number(sessionEndMatch[1]);
    if (method === 'POST') return handleUpdateSession(request, sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  // Lấy chi tiết phiên hoặc cập nhật phiên (PUT)
  const sessionMatch = pathname.match(/^\/v1\/(?:my\/)?ai-talk\/sessions\/(\d+)$/);
  if (sessionMatch) {
    const sessionId = Number(sessionMatch[1]);
    if (method === 'GET') return handleGetSession(sessionId, userId, env, origin);
    if (method === 'PUT') return handleUpdateSession(request, sessionId, userId, env, origin);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', undefined, origin);
  }

  return errorResponse(404, 'NOT_FOUND', undefined, origin);
}
