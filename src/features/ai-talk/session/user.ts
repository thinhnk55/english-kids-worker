import { evaluateAndReplyAiTalk } from '../../../services/llm.ts';
import type { AiTalkMission, AiTalkScenario, AiTalkSession, ChatMessage } from '../../../types/ai-talk.ts';
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
    profile_id?: number;
  } | null;

  if (!body || !body.scenario_id || typeof body.scenario_id !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'Mã tình huống (scenario_id) là bắt buộc', origin);
  }

  const scenarioId = body.scenario_id.trim();
  const profileId = typeof body.profile_id === 'number' ? body.profile_id : null;

  const scenario = await env.DB.prepare(
    'SELECT * FROM ai_talk_scenarios WHERE id = ?',
  )
    .bind(scenarioId)
    .first<AiTalkScenario>();

  if (!scenario) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy tình huống', origin);
  }

  const now = Math.floor(Date.now() / 1000);

  const initialMessages: ChatMessage[] = [
    {
      role: 'assistant',
      content: scenario.first_message,
      timestamp: Date.now(),
    },
  ];

  const session = await env.DB.prepare(
    `INSERT INTO ai_talk_sessions (
       user_id, profile_id, scenario_id, status, turns_count, max_turns,
       completed_missions, score, messages, feedback, created_at, updated_at
     )
     VALUES (?, ?, ?, 'in_progress', 0, ?, '[]', NULL, ?, NULL, ?, ?)
     RETURNING *`,
  )
    .bind(
      userId,
      profileId,
      scenarioId,
      scenario.max_turns,
      JSON.stringify(initialMessages),
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

export async function handleSessionMessage(
  request: Request,
  sessionId: number,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    message?: string;
  } | null;

  if (!body || !body.message || typeof body.message !== 'string' || !body.message.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Tin nhắn không được để trống', origin);
  }

  const userText = body.message.trim();

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

  if (session.turns_count >= session.max_turns) {
    await env.DB.prepare(
      "UPDATE ai_talk_sessions SET status = 'failed', updated_at = ? WHERE id = ?",
    )
      .bind(Math.floor(Date.now() / 1000), sessionId)
      .run();
    return errorResponse(400, 'BAD_REQUEST', 'Đã đạt số lượt tối đa của bài luyện', origin);
  }

  const scenario = await env.DB.prepare(
    'SELECT * FROM ai_talk_scenarios WHERE id = ?',
  )
    .bind(session.scenario_id)
    .first<AiTalkScenario>();

  if (!scenario) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy tình huống của phiên này', origin);
  }

  const existingMessages: ChatMessage[] = typeof session.messages === 'string'
    ? safeJsonParse(session.messages, [])
    : session.messages;

  const previousMissions: string[] = typeof session.completed_missions === 'string'
    ? safeJsonParse(session.completed_missions, [])
    : session.completed_missions;

  const missionsList: AiTalkMission[] = typeof scenario.missions === 'string'
    ? safeJsonParse(scenario.missions, [])
    : scenario.missions;

  const userMsg: ChatMessage = {
    role: 'user',
    content: userText,
    timestamp: Date.now(),
  };
  const updatedMessages = [...existingMessages, userMsg];

  const turnResult = await evaluateAndReplyAiTalk(env, {
    situation: scenario.situation,
    aiRole: scenario.ai_role,
    userRole: scenario.user_role,
    aiPrompt: scenario.ai_prompt,
    missions: missionsList,
    previouslyCompletedMissions: previousMissions,
    messages: updatedMessages,
    turnsCount: session.turns_count,
    maxTurns: session.max_turns,
  });

  const assistantMsg: ChatMessage = {
    role: 'assistant',
    content: turnResult.reply,
    timestamp: Date.now(),
    feedback: turnResult.feedback,
  };
  updatedMessages.push(assistantMsg);

  const newTurnsCount = session.turns_count + 1;
  const now = Math.floor(Date.now() / 1000);

  let newStatus: AiTalkSession['status'] = 'in_progress';
  let finalScore: number | null = session.score;
  let finalFeedback: string | null = session.feedback;

  if (turnResult.is_all_completed) {
    newStatus = 'completed';
    finalScore = turnResult.score ?? 100;
    finalFeedback = turnResult.feedback?.praise || 'Tuyệt vời! Con đã hoàn thành tất cả nhiệm vụ!';
  } else if (newTurnsCount >= session.max_turns) {
    newStatus = 'failed';
    finalScore = turnResult.score ?? 60;
    finalFeedback = 'Hết lượt nói chuyện. Con hãy thử lại để hoàn thành nhé!';
  }

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_sessions
     SET turns_count = ?, completed_missions = ?, status = ?, score = ?, messages = ?, feedback = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  )
    .bind(
      newTurnsCount,
      JSON.stringify(turnResult.completed_missions),
      newStatus,
      finalScore,
      JSON.stringify(updatedMessages),
      finalFeedback,
      now,
      sessionId,
    )
    .first<AiTalkSession>();

  return successResponse(200, 'SUCCESS', formatSession(updated), origin);
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
  };
}
