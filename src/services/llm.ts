import type { AiTalkMission, ChatMessage, ChatMessageFeedback } from '../types/ai-talk.ts';

export interface SessionCompetencyEvaluation {
  performance_score: number; // 0 - 100
  overall: string;
  strengths: string[];
  improvements: string[];
}

export interface LlmTalkTurnResult {
  reply: string;
  completed_missions: string[];
  feedback: ChatMessageFeedback;
  is_all_completed: boolean;
  performance_score: number;
  evaluation?: SessionCompetencyEvaluation;
  debug_log?: {
    latency_ms: number;
    pending_before: string[];
    new_completed: string[];
    relevance_level: string;
    penalty: number;
    focus_score_after: number;
  };
}

export async function evaluateAndReplyAiTalk(
  env: Env,
  params: {
    situation: string;
    aiRole: string;
    userRole: string;
    aiPrompt: string;
    missions: AiTalkMission[];
    previouslyCompletedMissions: string[];
    messages: ChatMessage[];
    turnsCount: number;
    maxTurns: number;
    currentFocusScore: number;
  },
): Promise<LlmTalkTurnResult> {
  const internalKey = env.INTERNAL_API_KEY || '751791ddb95fcb30db0330b2ea7c9bc9f15c4eee3f5d8ab968449988b4ef0d7c';
  const startTime = Date.now();

  const allMissions = params.missions || [];
  const completedSet = new Set(params.previouslyCompletedMissions || []);
  const pendingMissions = allMissions.filter(m => !completedSet.has(m.id));

  const lastUserMessage = [...params.messages].reverse().find(m => m.role === 'user')?.content || '';

  const missionsListStr = allMissions
    .map((m, idx) => `  ${idx + 1}. [${m.id}] ${m.goal} (Hints: ${(m.hints || []).join(', ') || 'None'})`)
    .join('\n');

  const pendingListStr = pendingMissions.length > 0
    ? pendingMissions.map(m => `  - [${m.id}] ${m.goal}`).join('\n')
    : '  (All target missions have been achieved!)';

  const completedListStr = params.previouslyCompletedMissions.length > 0
    ? params.previouslyCompletedMissions.join(', ')
    : 'None yet';

  const systemInstructions = `You are an expert English conversation partner and language assessor for English learners.

SCENARIO CONTEXT:
- Situation: ${params.situation}
- Your Character Role: ${params.aiRole}
- Learner's Character Role: ${params.userRole}
- Persona & Guidance: ${params.aiPrompt}

MISSIONS / LEARNING GOALS:
${missionsListStr}

STATUS:
- Completed missions: [${completedListStr}]
- PENDING MISSIONS (Focus on guiding the learner to achieve these):
${pendingListStr}

Turn count: ${params.turnsCount + 1} of ${params.maxTurns}.
Focus Score (Anti-derailment health bar): ${params.currentFocusScore}/100.

IMPORTANT CONCEPTS:
1. FOCUS SCORE (Chống lạc đề):
   - A retention meter strictly to prevent off-topic rambling (100 -> 0).
   - "on_topic": 0 penalty
   - "slight_off_topic": -10 penalty
   - "completely_off_topic": -25 penalty
   - "intentional_off_topic": -35 penalty
   - NOTE: Grammatical errors DO NOT reduce Focus Score! Only off-topic rambling reduces Focus Score.

2. PERFORMANCE SCORE (Điểm đánh giá năng lực thực tế: 0 - 100):
   - Comprehensive score reflecting actual English ability:
     * Accuracy (40%): Correct grammar, sentence structure, suitable vocabulary.
     * Naturalness & Fluency (30%): Natural phrasing, appropriateness.
     * Task completion & Efficiency (30%): Achieving missions within reasonable turns.

YOUR TASKS FOR THIS TURN:

1. EVALUATE LEARNER'S LATEST MESSAGE ("${lastUserMessage}"):
   - Accuracy:
     * is_correct: true if grammar and vocabulary are acceptable for spoken English.
     * issue: If there is a grammatical, vocabulary, or word order mistake, describe it concisely (e.g. "Nên dùng large pizza thay vì pizza big").
   - Relevance (Anti-derailment check):
     * "on_topic": Learner stays on the scenario. (penalty: 0, note: "Đúng chủ đề")
     * "slight_off_topic": Slightly off or pausing. (penalty: -10, note: "Hơi lạc đề")
     * "completely_off_topic": Unrelated or asking about AI identity. (penalty: -25, note: "Lạc đề hoàn toàn")
     * "intentional_off_topic": Deliberate derailing. (penalty: -35, note: "Cố tình lạc đề")
   - Naturalness:
     * suggestion: How a native speaker would say this more naturally in this context (e.g. "I'd like a large pizza, please.").
   - Praise:
     * A brief encouraging comment (e.g. "Great choice!", "Good order!").

2. CHECK MISSION ADVANCEMENT:
   - Check if the learner satisfied any PENDING missions.
   - If satisfied, include its mission ID in "completed_missions".
   - Return ALL completed mission IDs (both previous and new).
   - "is_all_completed": true if all ${allMissions.length} missions in the scenario are now done.

3. GENERATE IN-CHARACTER REPLY:
   - Speak 100% in character as "${params.aiRole}".
   - Keep it short: 1 to 2 natural sentences in simple English.
   - If learner is OFF-TOPIC: Politely redirect them back to the scenario.
   - If learner is ON-TOPIC: Respond naturally and ask a question to prompt the NEXT pending mission!
   - If ALL missions are finished: Conclude with a warm wrap-up and thank the customer/learner.

4. OVERALL COMPETENCY EVALUATION:
   - Provide "performance_score" (0 - 100) reflecting their actual English performance so far.
   - Provide "evaluation":
     * "overall": 1-2 sentences summarizing their English performance.
     * "strengths": 1-2 key strengths observed (e.g. "Phản xạ nhanh", "Dùng từ vựng đúng").
     * "improvements": 1-2 points to improve (e.g. "Cần chú ý trật tự tính từ trước danh từ").

OUTPUT FORMAT: Strict JSON matching this schema:
{
  "reply": "string (what AI says in character)",
  "completed_missions": ["id1", "id2"],
  "feedback": {
    "accuracy": { "is_correct": boolean, "issue": "string or null" },
    "relevance": { "level": "on_topic" | "slight_off_topic" | "completely_off_topic" | "intentional_off_topic", "penalty": number, "note": "string" },
    "naturalness": { "suggestion": "string or null" },
    "praise": "string"
  },
  "is_all_completed": boolean,
  "performance_score": number,
  "evaluation": {
    "overall": "string",
    "strengths": ["string"],
    "improvements": ["string"]
  }
}`;

  const conversationHistory = params.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));

  try {
    const response = await env.LLM_SERVICE.fetch('https://llm-worker/v1/internal/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Internal-Key': internalKey,
        'X-Caller': 'english-kids-worker',
      },
      body: JSON.stringify({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemInstructions },
          ...conversationHistory,
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI-TALK-LLM-ERROR] Status:', response.status, errText);
      return fallbackResult(params.previouslyCompletedMissions, params.currentFocusScore, latencyMs);
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.warn('[AI-TALK-LLM-EMPTY] No content returned from LLM');
      return fallbackResult(params.previouslyCompletedMissions, params.currentFocusScore, latencyMs);
    }

    const parsed = JSON.parse(content) as {
      reply?: string;
      completed_missions?: string[];
      feedback?: ChatMessageFeedback;
      is_all_completed?: boolean;
      performance_score?: number;
      evaluation?: SessionCompetencyEvaluation;
    };

    const completedMissions = Array.isArray(parsed.completed_missions)
      ? Array.from(new Set([...params.previouslyCompletedMissions, ...parsed.completed_missions]))
      : params.previouslyCompletedMissions;

    const feedback: ChatMessageFeedback = {
      accuracy: {
        is_correct: parsed.feedback?.accuracy?.is_correct ?? true,
        issue: parsed.feedback?.accuracy?.issue || undefined,
      },
      relevance: {
        level: parsed.feedback?.relevance?.level || 'on_topic',
        penalty: typeof parsed.feedback?.relevance?.penalty === 'number' ? parsed.feedback.relevance.penalty : 0,
        note: parsed.feedback?.relevance?.note || 'Đúng chủ đề',
      },
      naturalness: {
        suggestion: parsed.feedback?.naturalness?.suggestion || undefined,
      },
      praise: parsed.feedback?.praise || 'Phản hồi tốt!',
      grammar: parsed.feedback?.accuracy?.issue || undefined,
      suggestion: parsed.feedback?.naturalness?.suggestion || undefined,
    };

    const newlyDone = completedMissions.filter(id => !completedSet.has(id));
    const penalty = feedback.relevance?.penalty ?? 0;
    const focusScoreAfter = Math.max(0, params.currentFocusScore + penalty);

    const performanceScore = typeof parsed.performance_score === 'number'
      ? Math.min(100, Math.max(0, parsed.performance_score))
      : 80;

    const evaluation: SessionCompetencyEvaluation = {
      performance_score: performanceScore,
      overall: parsed.evaluation?.overall || 'Bạn đã tham gia hội thoại tích cực và hoàn thành các lượt đối thoại.',
      strengths: Array.isArray(parsed.evaluation?.strengths) && parsed.evaluation.strengths.length > 0
        ? parsed.evaluation.strengths
        : ['Nắm được nội dung tình huống', 'Phản hồi tự tin'],
      improvements: Array.isArray(parsed.evaluation?.improvements) && parsed.evaluation.improvements.length > 0
        ? parsed.evaluation.improvements
        : ['Chú ý các mẫu câu giao tiếp tự nhiên hơn'],
    };

    // Structured Server Logging
    console.log('[AI-TALK-TURN-LOG]', JSON.stringify({
      turn: params.turnsCount + 1,
      latencyMs,
      learnerInput: lastUserMessage,
      relevance: feedback.relevance,
      accuracy: feedback.accuracy,
      focusScore: `${params.currentFocusScore} -> ${focusScoreAfter}`,
      performanceScore,
      newlyCompletedMissions: newlyDone,
      allCompletedMissions: completedMissions,
      aiReply: parsed.reply,
    }, null, 2));

    return {
      reply: parsed.reply || "That's great! Let's continue.",
      completed_missions: completedMissions,
      feedback,
      is_all_completed: Boolean(parsed.is_all_completed) || (allMissions.length > 0 && completedMissions.length >= allMissions.length),
      performance_score: performanceScore,
      evaluation,
      debug_log: {
        latency_ms: latencyMs,
        pending_before: pendingMissions.map(m => m.id),
        new_completed: newlyDone,
        relevance_level: feedback.relevance?.level || 'on_topic',
        penalty,
        focus_score_after: focusScoreAfter,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('[AI-TALK-EXCEPTION] Error during evaluateAndReplyAiTalk:', error);
    return fallbackResult(params.previouslyCompletedMissions, params.currentFocusScore, latencyMs);
  }
}

function fallbackResult(previouslyCompleted: string[], currentFocus: number, latencyMs = 0): LlmTalkTurnResult {
  return {
    reply: "I understand! Let's continue with our conversation.",
    completed_missions: previouslyCompleted,
    feedback: {
      accuracy: { is_correct: true },
      relevance: { level: 'on_topic', penalty: 0, note: 'Đúng chủ đề' },
      praise: "Cố gắng rất tốt!",
    },
    is_all_completed: false,
    performance_score: 75,
    evaluation: {
      performance_score: 75,
      overall: 'Hoàn thành lượt thoại với tinh thần giao tiếp tích cực.',
      strengths: ['Tự tin phản hồi'],
      improvements: ['Tiếp tục luyện tập để tăng độ lưu loát'],
    },
    debug_log: {
      latency_ms: latencyMs,
      pending_before: [],
      new_completed: [],
      relevance_level: 'on_topic',
      penalty: 0,
      focus_score_after: currentFocus,
    },
  };
}

export async function generateDynamicHint(
  env: Env,
  params: {
    situation: string;
    aiRole: string;
    userRole: string;
    nextMissionGoal?: string;
    lastAssistantMessage?: string;
  },
): Promise<string> {
  const internalKey = env.INTERNAL_API_KEY || '751791ddb95fcb30db0330b2ea7c9bc9f15c4eee3f5d8ab968449988b4ef0d7c';

  const systemInstructions = `You are an English coach helping an English learner know what to say next in a roleplay.
Context:
- Scenario: ${params.situation}
- AI partner (${params.aiRole}) said: "${params.lastAssistantMessage || ''}"
- Next mission goal for learner: "${params.nextMissionGoal || 'Reply politely'}"

Provide exactly ONE short, natural English sentence the learner can say right now.
Respond ONLY with that sentence. Do not add quotes, markdown, or explanation.`;

  try {
    const response = await env.LLM_SERVICE.fetch('https://llm-worker/v1/internal/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Internal-Key': internalKey,
        'X-Caller': 'english-kids-worker',
      },
      body: JSON.stringify({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: 'Suggest what I should say.' },
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      return `Try saying: "I'd like that, please!"`;
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    return content || `Try saying: "Yes, please!"`;
  } catch (error) {
    console.error('[AI-TALK-HINT-ERROR]', error);
    return `Try saying: "Could you tell me more, please?"`;
  }
}
