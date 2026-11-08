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
    scenario_id?: string;
    profile_id?: number;
  } | null;

  if (!body || !body.scenario_id || typeof body.scenario_id !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'Mã tình huống (scenario_id) là bắt buộc', origin);
  }

  const scenarioId = body.scenario_id.trim();
  const profileId = typeof body.profile_id === 'number' ? body.profile_id : null;

  // 1. Ưu tiên tìm trong published catalog
  let scenario: AiTalkScenario | null = null;
  const catalogRow = await env.DB.prepare(
    'SELECT payload FROM published_catalogs WHERE key = ?',
  )
    .bind('ai_talk_catalog')
    .first<{ payload: string }>();

  if (catalogRow?.payload) {
    const catalogJson = safeJsonParse<{ data?: { scenarios?: AiTalkScenario[] } }>(catalogRow.payload, {});
    const found = catalogJson.data?.scenarios?.find(s => s.id === scenarioId);
    if (found) {
      scenario = {
        ...found,
        missions: typeof found.missions === 'string' ? safeJsonParse(found.missions, []) : (found.missions ?? []),
      };
    }
  }

  // 2. Dự phòng tìm trong bảng nháp ai_talk_scenarios
  if (!scenario) {
    const fromDb = await env.DB.prepare(
      'SELECT * FROM ai_talk_scenarios WHERE id = ?',
    )
      .bind(scenarioId)
      .first<AiTalkScenario>();

    if (fromDb) {
      scenario = {
        ...fromDb,
        missions: typeof fromDb.missions === 'string' ? safeJsonParse(fromDb.missions, []) : (fromDb.missions ?? []),
      };
    }
  }

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
     VALUES (?, ?, ?, 'in_progress', 0, ?, '[]', 100, ?, NULL, ?, ?)
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

// Chuyển đổi văn bản tự do thành audio TTS (tiện lợi cho client phát thử)
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

  let scenario: AiTalkScenario | null = null;
  const catalogRow = await env.DB.prepare(
    'SELECT payload FROM published_catalogs WHERE key = ?',
  )
    .bind('ai_talk_catalog')
    .first<{ payload: string }>();

  if (catalogRow?.payload) {
    const catalogJson = safeJsonParse<{ data?: { scenarios?: AiTalkScenario[] } }>(catalogRow.payload, {});
    const found = catalogJson.data?.scenarios?.find(s => s.id === session.scenario_id);
    if (found) {
      scenario = {
        ...found,
        missions: typeof found.missions === 'string' ? safeJsonParse(found.missions, []) : (found.missions ?? []),
      };
    }
  }

  if (!scenario) {
    const fromDb = await env.DB.prepare(
      'SELECT * FROM ai_talk_scenarios WHERE id = ?',
    )
      .bind(session.scenario_id)
      .first<AiTalkScenario>();

    if (fromDb) {
      scenario = {
        ...fromDb,
        missions: typeof fromDb.missions === 'string' ? safeJsonParse(fromDb.missions, []) : (fromDb.missions ?? []),
      };
    }
  }

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

  const currentScore = typeof session.score === 'number' ? session.score : 100;

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
    currentScore,
  });

  // Attach per-message feedback directly to the user's message
  userMsg.feedback = turnResult.feedback;

  const assistantMsg: ChatMessage = {
    role: 'assistant',
    content: turnResult.reply,
    timestamp: Date.now(),
  };
  updatedMessages.push(assistantMsg);

  const penalty = turnResult.feedback?.relevance?.penalty ?? 0;
  const newFocusScore = Math.max(0, currentScore + penalty);

  const newTurnsCount = session.turns_count + 1;
  const now = Math.floor(Date.now() / 1000);

  let newStatus: AiTalkSession['status'] = 'in_progress';
  let finalScore: number = newFocusScore;
  let finalFeedback: string | null = session.feedback;

  if (turnResult.is_all_completed) {
    newStatus = 'completed';
    finalScore = newFocusScore;
    finalFeedback = turnResult.feedback?.praise
      ? `Xuất sắc! Đã hoàn thành mọi mục tiêu với Focus Score: ${newFocusScore}/100. ${turnResult.feedback.praise}`
      : `Xuất sắc! Đã hoàn thành mọi mục tiêu với Focus Score: ${newFocusScore}/100.`;
  } else if (newFocusScore <= 0) {
    newStatus = 'failed';
    finalScore = 0;
    finalFeedback = 'Nhiệm vụ thất bại do điểm tập trung (Focus Score) về 0 (lạc đề quá nhiều).';
  } else if (newTurnsCount >= session.max_turns) {
    newStatus = 'failed';
    finalScore = newFocusScore;
    finalFeedback = `Đã đạt giới hạn ${session.max_turns} lượt thoại mà chưa hoàn thành toàn bộ mục tiêu.`;
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
    completed_missions: typeof session.completed_missions === 'string'
      ? safeJsonParse(session.completed_missions, [])
      : session.completed_missions,
    messages: typeof session.messages === 'string'
      ? safeJsonParse(session.messages, [])
      : session.messages,
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

  let scenario: AiTalkScenario | null = null;
  const catalogRow = await env.DB.prepare(
    'SELECT payload FROM published_catalogs WHERE key = ?',
  )
    .bind('ai_talk_catalog')
    .first<{ payload: string }>();

  if (catalogRow?.payload) {
    const catalogJson = safeJsonParse<{ data?: { scenarios?: AiTalkScenario[] } }>(catalogRow.payload, {});
    const found = catalogJson.data?.scenarios?.find(s => s.id === session.scenario_id);
    if (found) scenario = found;
  }

  if (!scenario) {
    scenario = await env.DB.prepare('SELECT * FROM ai_talk_scenarios WHERE id = ?')
      .bind(session.scenario_id)
      .first<AiTalkScenario>();
  }

  const messages = safeJsonParse<ChatMessage[]>(session.messages as string, []);
  const completedMissions = safeJsonParse<string[]>(session.completed_missions as string, []);
  const missions = scenario ? (typeof scenario.missions === 'string' ? safeJsonParse<AiTalkMission[]>(scenario.missions, []) : (scenario.missions ?? [])) : [];

  const nextMission = missions.find(m => !completedMissions.includes(m.code || (m as any).id));
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';

  const hint = await generateDynamicHint(env, {
    situation: scenario?.situation || 'General conversation',
    aiRole: scenario?.ai_role || 'Tutor',
    userRole: scenario?.user_role || 'Student',
    nextMissionGoal: nextMission ? ((nextMission as any).goal || nextMission.text) : undefined,
    lastAssistantMessage: lastAssistantMsg,
  });

  return successResponse(200, 'SUCCESS', { hint }, origin);
}
