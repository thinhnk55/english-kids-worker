import { deductUserCredit } from '../../credit/handlers.ts';
import { evaluateAndReplyAiTalk, generateDynamicHint } from '../../../services/llm.ts';
import { transcribeAudio } from '../../../services/stt.ts';
import { synthesizeSpeech } from '../../../services/tts.ts';
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
    scenario?: AiTalkScenario;
    scenario_snapshot?: AiTalkScenario | string;
    scenario_id?: string;
    profile_id?: number;
  } | null;

  if (!body) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', origin);
  }

  // Lấy dữ liệu cấu hình kịch bản do client gửi lên
  let scenario: AiTalkScenario | null = null;
  if (body.scenario && typeof body.scenario === 'object') {
    scenario = body.scenario;
  } else if (body.scenario_snapshot) {
    scenario = typeof body.scenario_snapshot === 'string'
      ? safeJsonParse<AiTalkScenario | null>(body.scenario_snapshot, null)
      : body.scenario_snapshot;
  }

  if (!scenario || !scenario.id || !scenario.first_message) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Thông tin kịch bản (scenario) không hợp lệ', origin);
  }

  // 1. Kiểm tra và trừ 1 credit rèn luyện của tài khoản
  const creditDeduction = await deductUserCredit(env, userId, 1, 'start_ai_talk_session', scenario.id);
  if (!creditDeduction.success) {
    return errorResponse(402, 'PAYMENT_REQUIRED', 'Tài khoản đã hết lượt rèn luyện (credit). Vui lòng nạp thêm credit để tiếp tục!', origin);
  }

  const scenarioId = scenario.id.trim();
  const profileId = typeof body.profile_id === 'number' ? body.profile_id : null;
  const maxTurns = Math.min(Math.max(Number(scenario.max_turns) || 10, 1), 15);
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
       user_id, profile_id, scenario_id, scenario_snapshot, status, turns_count, max_turns,
       completed_missions, score, focus_score, messages, feedback, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, 'in_progress', 0, ?, '[]', 100, 100, ?, NULL, ?, ?)
     RETURNING *`,
  )
    .bind(
      userId,
      profileId,
      scenarioId,
      JSON.stringify(scenario),
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

// Xử lý gửi tin nhắn dạng văn bản (Text -> LLM Reply)
export async function handleSessionMessage(
  request: Request,
  sessionId: number,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    message?: string;
    content?: string;
  } | null;

  const textContent = body?.message || body?.content;
  if (!body || !textContent || typeof textContent !== 'string' || !textContent.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Tin nhắn không được để trống', origin);
  }

  return await executeTurn(sessionId, userId, textContent.trim(), env, origin);
}

// Xử lý gửi tin nhắn dạng giọng nói (Audio Voice -> STT -> LLM Reply)
export async function handleSessionVoiceMessage(
  request: Request,
  sessionId: number,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const sttRes = await transcribeAudio(request, env);
  if (!sttRes.ok || !sttRes.text) {
    return errorResponse(400, 'VALIDATION_ERROR', sttRes.error || 'Không nhận diện được giọng nói', origin);
  }

  return await executeTurn(sessionId, userId, sttRes.text, env, origin, sttRes.text);
}

// Chuyển đổi một tin nhắn của AI trong phiên thành audio (TTS)
export async function handleGetMessageAudio(
  sessionId: number,
  messageIndex: number,
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
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy phiên trò chuyện', origin);
  }

  const messages: ChatMessage[] = typeof session.messages === 'string'
    ? safeJsonParse(session.messages, [])
    : session.messages;

  const targetMsg = messages[messageIndex];
  if (!targetMsg || !targetMsg.content) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy tin nhắn cần phát âm', origin);
  }

  return await synthesizeSpeech(env, targetMsg.content, { voice: 'alloy', speed: 0.95 }, origin);
}

// Chuyển đổi văn bản tự do thành audio TTS
export async function handleSynthesizeGeneralText(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    text?: string;
    voice?: string;
    speed?: number;
  } | null;

  if (!body || !body.text || typeof body.text !== 'string' || !body.text.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Nội dung text không được để trống', origin);
  }

  return await synthesizeSpeech(env, body.text.trim(), {
    voice: body.voice || 'alloy',
    speed: body.speed || 1.0,
  }, origin);
}

// Hàm dùng chung xử lý 1 lượt trò chuyện & tương tác LLM
async function executeTurn(
  sessionId: number,
  userId: number,
  userText: string,
  env: Env,
  origin: string,
  transcribedText?: string,
): Promise<Response> {
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

  // Đọc snapshot cấu hình kịch bản trực tiếp từ session
  const scenario: AiTalkScenario | null = session.scenario_snapshot
    ? safeJsonParse<AiTalkScenario | null>(session.scenario_snapshot, null)
    : null;

  if (!scenario) {
    return errorResponse(500, 'INTERNAL_ERROR', 'Không tìm thấy snapshot kịch bản của phiên', origin);
  }

  const existingMessages: ChatMessage[] = typeof session.messages === 'string'
    ? safeJsonParse(session.messages, [])
    : session.messages;

  const previousMissions: string[] = typeof session.completed_missions === 'string'
    ? safeJsonParse(session.completed_missions, [])
    : session.completed_missions;

  const missionsList: AiTalkMission[] = typeof scenario.missions === 'string'
    ? safeJsonParse(scenario.missions, [])
    : (scenario.missions ?? []);

  const userMsg: ChatMessage = {
    role: 'user',
    content: userText,
    timestamp: Date.now(),
  };
  const updatedMessages = [...existingMessages, userMsg];

  const currentFocusScore = typeof session.focus_score === 'number' ? session.focus_score : 100;
  const currentCompetencyScore = typeof session.score === 'number' ? session.score : 100;

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
    currentFocusScore,
    currentCompetencyScore,
  });

  // Gắn kết quả đánh giá chi tiết vào tin nhắn của user
  userMsg.feedback = turnResult.feedback;

  const assistantMsg: ChatMessage = {
    role: 'assistant',
    content: turnResult.reply,
    timestamp: Date.now(),
  };
  updatedMessages.push(assistantMsg);

  // Thanh năng lượng Focus (0 - 100)
  const focusPenalty = turnResult.feedback?.focus_penalty ?? 0;
  const newFocusScore = Math.max(0, currentFocusScore + focusPenalty);

  const newTurnsCount = session.turns_count + 1;
  const now = Math.floor(Date.now() / 1000);

  const isAllMissionsDone = turnResult.is_all_completed || (missionsList.length > 0 && turnResult.completed_missions.length >= missionsList.length);
  const isFailedByFocus = newFocusScore <= 0;
  const isTurnsExceeded = newTurnsCount >= session.max_turns;

  let newStatus: AiTalkSession['status'] = 'in_progress';
  let finalCompetencyScore: number | null = session.score;
  let finalFeedbackPayload: string | null = session.feedback;

  if (isAllMissionsDone) {
    newStatus = 'completed';
    finalCompetencyScore = turnResult.performance_score ?? 85;
    finalFeedbackPayload = JSON.stringify(turnResult.evaluation || {
      performance_score: finalCompetencyScore,
      overall: 'Xuất sắc! Bạn đã hoàn thành toàn bộ mục tiêu của bài học.',
      strengths: ['Giao tiếp trôi chảy', 'Bám sát tình huống'],
      improvements: ['Tiếp tục luyện tập thêm các cấu trúc câu nâng cao'],
    });
  } else if (isFailedByFocus) {
    newStatus = 'failed';
    finalCompetencyScore = turnResult.performance_score ?? 40;
    finalFeedbackPayload = JSON.stringify({
      performance_score: finalCompetencyScore,
      overall: 'Phiên hội thoại dừng lại do điểm tập trung (Focus Score) về 0 (lạc đề quá nhiều). Hãy thử lại và tập trung vào mục tiêu của nhân vật.',
      strengths: [],
      improvements: ['Hãy bám sát tình huống và câu hỏi của nhân vật'],
    });
  } else if (isTurnsExceeded) {
    newStatus = 'failed';
    finalCompetencyScore = turnResult.performance_score ?? 60;
    finalFeedbackPayload = JSON.stringify(turnResult.evaluation || {
      performance_score: finalCompetencyScore,
      overall: `Đã kết thúc ${session.max_turns} lượt thoại mà chưa hoàn thành tất cả mục tiêu.`,
      strengths: ['Đã cố gắng giao tiếp'],
      improvements: ['Hãy phản hồi nhanh và đi thẳng vào mục tiêu cần đạt'],
    });
  } else {
    finalCompetencyScore = turnResult.performance_score ?? session.score;
    if (turnResult.evaluation) {
      finalFeedbackPayload = JSON.stringify(turnResult.evaluation);
    }
  }

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_sessions
     SET turns_count = ?, completed_missions = ?, status = ?, score = ?, focus_score = ?, messages = ?, feedback = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  )
    .bind(
      newTurnsCount,
      JSON.stringify(turnResult.completed_missions),
      newStatus,
      finalCompetencyScore,
      newFocusScore,
      JSON.stringify(updatedMessages),
      finalFeedbackPayload,
      now,
      session.id,
    )
    .first<AiTalkSession>();

  const formatted = formatSession(updated);

  return successResponse(200, 'SUCCESS', {
    ...(transcribedText ? { transcription: transcribedText } : {}),
    ...formatted,
  }, origin);
}

export function formatSession(session: AiTalkSession | null | undefined) {
  if (!session) return null;
  return {
    ...session,
    scenario_snapshot: typeof session.scenario_snapshot === 'string'
      ? safeJsonParse(session.scenario_snapshot, null)
      : session.scenario_snapshot,
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

export async function handleGetSessionHint(
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
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy phiên', origin);
  }

  const scenario: AiTalkScenario | null = session.scenario_snapshot
    ? safeJsonParse<AiTalkScenario | null>(session.scenario_snapshot, null)
    : null;

  const messages = safeJsonParse<ChatMessage[]>(session.messages as string, []);
  const completedMissions = safeJsonParse<string[]>(session.completed_missions as string, []);
  const missions = scenario ? (typeof scenario.missions === 'string' ? safeJsonParse<AiTalkMission[]>(scenario.missions, []) : (scenario.missions ?? [])) : [];

  const nextMission = missions.find(m => !completedMissions.includes((m.id || m.code || '')));
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';

  const hint = await generateDynamicHint(env, {
    situation: scenario?.situation || 'General conversation',
    aiRole: scenario?.ai_role || 'Tutor',
    userRole: scenario?.user_role || 'Student',
    nextMissionGoal: nextMission ? (nextMission.goal || nextMission.text) : undefined,
    lastAssistantMessage: lastAssistantMsg,
  });

  return successResponse(200, 'SUCCESS', { hint }, origin);
}
