import { deductUserCredit } from '../../credit/handlers.ts';
import { callLlmCompletion } from '../../../services/llm.ts';
import type { AiTalkScenarioRow, AiTalkSession, ChatMessage } from '../../../types/ai-talk.ts';
import { safeJsonParse } from '../../../utils/json.ts';
import { errorResponse, successResponse } from '../../../utils/response.ts';

export async function handleStartSession(
  request: Request,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    scenario_id?: string;
    scenario_code?: string;
    code?: string;
    profile_id?: number;
    max_turns?: number;
    initial_messages?: ChatMessage[];
    first_message?: string;
  } | null;

  const scenarioCode = body?.scenario_id || body?.scenario_code || body?.code;
  if (!scenarioCode || typeof scenarioCode !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'Mã kịch bản (scenario_id) là bắt buộc', origin);
  }

  const cleanCode = scenarioCode.trim();

  // Tra cứu thông tin scenario từ bảng ai_talk_scenarios
  const scenarioRow = await env.DB.prepare(
    'SELECT code, name, category, credit_cost, max_turns FROM ai_talk_scenarios WHERE code = ?',
  )
    .bind(cleanCode)
    .first<AiTalkScenarioRow>();

  const creditCost = scenarioRow?.credit_cost ?? 1;
  const maxTurns = scenarioRow?.max_turns ?? (Math.min(Math.max(Number(body?.max_turns) || 10, 1), 25));

  // Kiểm tra và trừ credit theo cấu hình của scenario
  const creditDeduction = await deductUserCredit(env, userId, creditCost, 'start_ai_talk_session', cleanCode);
  if (!creditDeduction.success) {
    return errorResponse(402, 'PAYMENT_REQUIRED', `Tài khoản cần tối thiểu ${creditCost} credit để luyện tập kịch bản này!`, origin);
  }

  const profileId = typeof body?.profile_id === 'number' ? body.profile_id : null;
  const now = Math.floor(Date.now() / 1000);

  // Client quyết định tin nhắn khởi tạo
  let initialMessages: ChatMessage[] = [];
  if (Array.isArray(body?.initial_messages) && body.initial_messages.length > 0) {
    initialMessages = body.initial_messages;
  } else if (body?.first_message) {
    initialMessages = [
      {
        role: 'assistant',
        content: body.first_message,
        timestamp: Date.now(),
      },
    ];
  }

  const session = await env.DB.prepare(
    `INSERT INTO ai_talk_sessions (
       user_id, profile_id, scenario_id, status, turns_count, max_turns,
       completed_missions, score, focus_score, messages, feedback, created_at, updated_at
     )
     VALUES (?, ?, ?, 'in_progress', 0, ?, '[]', 100, 100, ?, NULL, ?, ?)
     RETURNING *`,
  )
    .bind(
      userId,
      profileId,
      cleanCode,
      maxTurns,
      JSON.stringify(initialMessages),
      now,
      now,
    )
    .first<AiTalkSession>();

  return successResponse(201, 'CREATED', {
    ...formatSession(session),
    remaining_credits: creditDeduction.remainingCredits,
  }, origin);
}

export async function handleGetSession(
  sessionId: number,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const session = await env.DB.prepare(
    'SELECT * FROM ai_talk_sessions WHERE id = ? AND user_id = ?',
  )
    .bind(sessionId, userId)
    .first<AiTalkSession>();

  if (!session) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  return successResponse(200, 'SUCCESS', formatSession(session), origin);
}

export async function handleListProfileSessions(
  request: Request,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const profileIdParam = url.searchParams.get('profile_id');
  const scenarioId = url.searchParams.get('scenario_id');

  let query = 'SELECT * FROM ai_talk_sessions WHERE user_id = ?';
  const params: unknown[] = [userId];

  if (profileIdParam) {
    query += ' AND profile_id = ?';
    params.push(Number(profileIdParam));
  }

  if (scenarioId) {
    query += ' AND scenario_id = ?';
    params.push(scenarioId);
  }

  query += ' ORDER BY created_at DESC LIMIT 50';

  const result = await env.DB.prepare(query).bind(...params).all<AiTalkSession>();
  const list = (result.results ?? []).map(formatSession);

  return successResponse(200, 'SUCCESS', list, origin);
}

// Client gửi nội dung 1 lượt (turn) lên BE: BE kiểm tra chặn số turn tối đa
export async function handleSessionMessage(
  request: Request,
  sessionId: number,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    messages?: ChatMessage[];
    user_message?: ChatMessage;
    assistant_message?: ChatMessage;
    content?: string;
    message?: string;
    score?: number;
    focus_score?: number;
    completed_missions?: string[];
    feedback?: any;
    status?: AiTalkSession['status'];
  } | null;

  if (!body) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', origin);
  }

  const session = await env.DB.prepare(
    'SELECT * FROM ai_talk_sessions WHERE id = ? AND user_id = ?',
  )
    .bind(sessionId, userId)
    .first<AiTalkSession>();

  if (!session) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy phiên trò chuyện', origin);
  }

  if (session.status !== 'in_progress') {
    return errorResponse(400, 'BAD_REQUEST', `Phiên trò chuyện đã kết thúc (${session.status})`, origin);
  }

  // BE kiểm tra chặn số turn tối đa mà client được phép gửi lên
  if (session.turns_count >= session.max_turns) {
    await env.DB.prepare(
      "UPDATE ai_talk_sessions SET status = 'failed', updated_at = ? WHERE id = ?",
    )
      .bind(Math.floor(Date.now() / 1000), sessionId)
      .run();
    return errorResponse(400, 'TURN_LIMIT_EXCEEDED', `Đã đạt giới hạn số lượt (${session.max_turns}) của phiên`, origin);
  }

  // Client quyết định toàn bộ nội dung lưu trữ
  const existingMessages: ChatMessage[] = typeof session.messages === 'string'
    ? safeJsonParse(session.messages, [])
    : session.messages;

  let newMessages: ChatMessage[] = [];
  if (Array.isArray(body.messages)) {
    newMessages = body.messages;
  } else {
    newMessages = [...existingMessages];
    if (body.user_message) newMessages.push(body.user_message);
    else if (body.content || body.message) {
      newMessages.push({
        role: 'user',
        content: (body.content || body.message)!,
        timestamp: Date.now(),
      });
    }
    if (body.assistant_message) newMessages.push(body.assistant_message);
  }

  const newTurnsCount = session.turns_count + 1;
  const now = Math.floor(Date.now() / 1000);

  const newScore = typeof body.score === 'number' ? body.score : session.score;
  const newFocusScore = typeof body.focus_score === 'number' ? body.focus_score : session.focus_score;
  const newCompletedMissions = Array.isArray(body.completed_missions)
    ? body.completed_missions
    : (typeof session.completed_missions === 'string' ? safeJsonParse(session.completed_missions, []) : session.completed_missions);

  let newStatus: AiTalkSession['status'] = body.status || 'in_progress';
  if (newStatus === 'in_progress' && newTurnsCount >= session.max_turns) {
    newStatus = 'completed';
  }

  const newFeedback = body.feedback !== undefined
    ? (typeof body.feedback === 'string' ? body.feedback : JSON.stringify(body.feedback))
    : session.feedback;

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_sessions
     SET turns_count = ?, completed_missions = ?, status = ?, score = ?, focus_score = ?, messages = ?, feedback = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  )
    .bind(
      newTurnsCount,
      JSON.stringify(newCompletedMissions),
      newStatus,
      newScore,
      newFocusScore,
      JSON.stringify(newMessages),
      newFeedback,
      now,
      session.id,
    )
    .first<AiTalkSession>();

  return successResponse(200, 'SUCCESS', formatSession(updated), origin);
}

// Cập nhật trạng thái session (kết thúc, hủy, hoặc lưu feedback)
export async function handleUpdateSession(
  request: Request,
  sessionId: number,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    status?: AiTalkSession['status'];
    score?: number;
    focus_score?: number;
    feedback?: any;
    completed_missions?: string[];
  } | null;

  const session = await env.DB.prepare(
    'SELECT * FROM ai_talk_sessions WHERE id = ? AND user_id = ?',
  )
    .bind(sessionId, userId)
    .first<AiTalkSession>();

  if (!session) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy phiên', origin);
  }

  const now = Math.floor(Date.now() / 1000);
  const status = body?.status || session.status;
  const score = typeof body?.score === 'number' ? body.score : session.score;
  const focusScore = typeof body?.focus_score === 'number' ? body.focus_score : session.focus_score;
  const feedback = body?.feedback !== undefined
    ? (typeof body.feedback === 'string' ? body.feedback : JSON.stringify(body.feedback))
    : session.feedback;
  const completedMissions = Array.isArray(body?.completed_missions)
    ? JSON.stringify(body.completed_missions)
    : session.completed_missions;

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_sessions
     SET status = ?, score = ?, focus_score = ?, feedback = ?, completed_missions = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  )
    .bind(status, score, focusScore, feedback, completedMissions, now, sessionId)
    .first<AiTalkSession>();

  return successResponse(200, 'SUCCESS', formatSession(updated), origin);
}

// LLM Completion Endpoint cho Client: client tự do cấu hình prompt và format
export async function handleSessionLlmChat(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  } | null;

  if (!body || (!body.prompt && (!Array.isArray(body.messages) || body.messages.length === 0))) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Prompt hoặc messages không được để trống', origin);
  }

  try {
    const res = await callLlmCompletion(env, {
      prompt: body.prompt,
      messages: body.messages,
      temperature: body.temperature ?? 0.5,
      max_tokens: Math.min(body.max_tokens || 500, 500),
      response_format: body.response_format,
    });
    return successResponse(200, 'SUCCESS', res, origin);
  } catch (err: any) {
    console.error('[AI-TALK-LLM-ERROR]', err);
    return errorResponse(500, 'INTERNAL_ERROR', err?.message || 'Lỗi gọi LLM', origin);
  }
}

export function formatSession(session: AiTalkSession | null | undefined) {
  if (!session) return null;
  return {
    ...session,
    completed_missions: typeof session.completed_missions === 'string'
      ? safeJsonParse(session.completed_missions, [])
      : session.completed_missions,
    messages: typeof session.messages === 'string'
      ? safeJsonParse(session.messages, [])
      : session.messages,
    feedback: typeof session.feedback === 'string'
      ? safeJsonParse(session.feedback, session.feedback)
      : session.feedback,
  };
}
