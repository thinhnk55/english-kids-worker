import { callLlmCompletion } from '../../../services/llm.ts';
import type { AiTalkScenarioRow, AiTalkSession, ChatMessage, SessionMeta } from '../../../types/ai-talk.ts';
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
    max_turn?: number;
    energy?: number;
    initial_messages?: ChatMessage[];
    first_message?: string;
    meta?: Record<string, any>;
  } | null;

  const scenarioCode = body?.scenario_id || body?.scenario_code || body?.code;
  if (!scenarioCode || typeof scenarioCode !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'Mã kịch bản (scenario_id) là bắt buộc', origin);
  }

  const cleanCode = scenarioCode.trim();

  // Tra cứu thông tin scenario từ bảng ai_talk_scenarios
  const scenarioRow = await env.DB.prepare(
    'SELECT code, name, category, max_turns FROM ai_talk_scenarios WHERE code = ?',
  )
    .bind(cleanCode)
    .first<AiTalkScenarioRow>();

  const maxTurn = scenarioRow?.max_turns ?? (Math.min(Math.max(Number(body?.max_turns || body?.max_turn) || 10, 1), 25));

  const profileId = typeof body?.profile_id === 'number' ? body.profile_id : null;
  const initialEnergy = typeof body?.energy === 'number' ? body.energy : 3;
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

  const sessionMeta: SessionMeta = {
    messages: initialMessages,
    completed_missions: [],
    feedback: null,
    ...(body?.meta || {}),
  };

  const session = await env.DB.prepare(
    `INSERT INTO ai_talk_sessions (
       user_id, profile_id, scenario_id, status, turn, max_turn,
       energy, score, meta, created_at, updated_at
     )
     VALUES (?, ?, ?, 'in_progress', 0, ?, ?, 100, ?, ?, ?)
     RETURNING *`,
  )
    .bind(
      userId,
      profileId,
      cleanCode,
      maxTurn,
      initialEnergy,
      JSON.stringify(sessionMeta),
      now,
      now,
    )
    .first<AiTalkSession>();

  return successResponse(201, 'CREATED', formatSession(session), origin);
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
    energy?: number;
    completed_missions?: string[];
    feedback?: any;
    status?: AiTalkSession['status'];
    meta?: Record<string, any>;
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
  if (session.turn >= session.max_turn) {
    await env.DB.prepare(
      "UPDATE ai_talk_sessions SET status = 'failed', updated_at = ? WHERE id = ?",
    )
      .bind(Math.floor(Date.now() / 1000), sessionId)
      .run();
    return errorResponse(400, 'TURN_LIMIT_EXCEEDED', `Đã đạt giới hạn số lượt (${session.max_turn}) của phiên`, origin);
  }

  // Parse meta hiện tại
  const meta: SessionMeta = typeof session.meta === 'string'
    ? safeJsonParse(session.meta, {})
    : (session.meta || {});

  const existingMessages: ChatMessage[] = Array.isArray(meta.messages) ? meta.messages : [];

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

  const newTurn = session.turn + 1;
  const now = Math.floor(Date.now() / 1000);

  const newScore = typeof body.score === 'number' ? body.score : session.score;
  const newEnergy = typeof body.energy === 'number' ? body.energy : session.energy;

  let newStatus: AiTalkSession['status'] = body.status || 'in_progress';
  if (newEnergy !== null && newEnergy <= 0) {
    newStatus = 'failed';
  } else if (newStatus === 'in_progress' && newTurn >= session.max_turn) {
    newStatus = 'completed';
  }

  // Cập nhật meta
  meta.messages = newMessages;
  if (Array.isArray(body.completed_missions)) {
    meta.completed_missions = body.completed_missions;
  }
  if (body.feedback !== undefined) {
    meta.feedback = body.feedback;
  }
  if (body.meta && typeof body.meta === 'object') {
    Object.assign(meta, body.meta);
  }

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_sessions
     SET turn = ?, score = ?, energy = ?, status = ?, meta = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  )
    .bind(
      newTurn,
      newScore,
      newEnergy,
      newStatus,
      JSON.stringify(meta),
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
    energy?: number;
    feedback?: any;
    completed_missions?: string[];
    meta?: Record<string, any>;
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
  const energy = typeof body?.energy === 'number' ? body.energy : session.energy;

  const meta: SessionMeta = typeof session.meta === 'string'
    ? safeJsonParse(session.meta, {})
    : (session.meta || {});

  if (Array.isArray(body?.completed_missions)) {
    meta.completed_missions = body.completed_missions;
  }
  if (body?.feedback !== undefined) {
    meta.feedback = body.feedback;
  }
  if (body?.meta && typeof body.meta === 'object') {
    Object.assign(meta, body.meta);
  }

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_sessions
     SET status = ?, score = ?, energy = ?, meta = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  )
    .bind(status, score, energy, JSON.stringify(meta), now, sessionId)
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
  const meta: SessionMeta = typeof session.meta === 'string'
    ? safeJsonParse(session.meta, {})
    : (session.meta || {});

  return {
    ...session,
    turn: session.turn,
    turns_count: session.turn,
    max_turn: session.max_turn,
    max_turns: session.max_turn,
    energy: session.energy,
    score: session.score,
    meta,
    messages: Array.isArray(meta.messages) ? meta.messages : [],
    completed_missions: Array.isArray(meta.completed_missions) ? meta.completed_missions : [],
    feedback: meta.feedback ?? null,
  };
}
