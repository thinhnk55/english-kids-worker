import type { AiTalkMission, ChatMessage, ChatMessageFeedback } from '../types/ai-talk.ts';

export interface LlmTalkTurnResult {
  reply: string;
  completed_missions: string[];
  feedback: ChatMessageFeedback;
  is_all_completed: boolean;
  score?: number;
  debug_log?: {
    latency_ms: number;
    pending_before: string[];
    new_completed: string[];
    relevance_level: string;
    penalty: number;
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
    currentScore?: number;
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

  const systemInstructions = `You are a real-time English conversation partner and language coach for English learners.

SCENARIO CONTEXT:
- Situation: ${params.situation}
- Your Character Role: ${params.aiRole}
- Learner's Character Role: ${params.userRole}
- Guidance & Tone: ${params.aiPrompt}

ALL MISSIONS TO COMPLETE IN THIS SCENARIO:
${missionsListStr}

STATUS:
- Already completed missions: [${completedListStr}]
- PENDING MISSIONS TO FOCUS ON RIGHT NOW:
${pendingListStr}

Turn count: ${params.turnsCount + 1} of ${params.maxTurns}. Current focus score: ${params.currentScore ?? 100}/100.

YOUR 3 CONCURRENT OBJECTIVES FOR THIS TURN:

1. EVALUATE LEARNER'S LATEST MESSAGE ("${lastUserMessage}"):
   - Accuracy:
     * is_correct: true if grammar and vocabulary are acceptable for spoken English.
     * issue: If there is a noticeable grammar, vocabulary, or word order mistake, describe it concisely (e.g. "Sai trật tự từ: nên nói large pizza thay vì pizza big").
   - Relevance (Check topic & mission adherence):
     * "on_topic": The learner talks about the scenario/order/missions. (penalty: 0, note: "Đúng chủ đề")
     * "slight_off_topic": Pausing or asking small unrelated questions. (penalty: -10, note: "Hơi lạc đề")
     * "completely_off_topic": Completely unrelated to the scenario or talking to the AI as a bot. (penalty: -25, note: "Lạc đề hoàn toàn")
     * "intentional_off_topic": Deliberate and repeated derailment. (penalty: -35, note: "Cố tình lạc đề")
   - Naturalness:
     * suggestion: How would a native English speaker say this more naturally? Give a natural phrasing (e.g. "I'd like a large pizza, please."). Only omit if the user's sentence was already very natural.
   - Praise:
     * A brief word of encouragement (e.g. "Good effort!", "Nice expression!", "Great choice!").

2. CHECK MISSION ADVANCEMENT:
   - Check if the learner's latest message satisfies any of the PENDING missions.
   - If satisfied (even in simple/imperfect words), add its mission ID to "completed_missions".
   - Return the cumulative list of ALL completed mission IDs (both previous and any newly completed).
   - "is_all_completed": true if all ${allMissions.length} missions in the scenario are now done.

3. GENERATE IN-CHARACTER REPLY:
   - Stay 100% in character as "${params.aiRole}".
   - Keep it concise: 1 to 2 short, natural sentences in simple English.
   - If the learner is OFF-TOPIC: Respond briefly in character and politely steer them back to the scenario (e.g. "Haha, but I'm your pizza cashier! What pizza would you like to order?").
   - If the learner is ON-TOPIC: React naturally to what they said, and proactively prompt them towards the NEXT pending mission!
   - If ALL missions are completed: Confirm their complete order/task and conclude with a warm closing.

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
  "is_all_completed": boolean
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
      return fallbackResult(params.previouslyCompletedMissions, latencyMs);
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.warn('[AI-TALK-LLM-EMPTY] No content returned from LLM');
      return fallbackResult(params.previouslyCompletedMissions, latencyMs);
    }

    const parsed = JSON.parse(content) as {
      reply?: string;
      completed_missions?: string[];
      feedback?: ChatMessageFeedback;
      is_all_completed?: boolean;
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

    // Structured Server Logging
    console.log('[AI-TALK-TURN-LOG]', JSON.stringify({
      turn: params.turnsCount + 1,
      latencyMs,
      learnerInput: lastUserMessage,
      relevance: feedback.relevance,
      accuracy: feedback.accuracy,
      newlyCompletedMissions: newlyDone,
      allCompletedMissions: completedMissions,
      aiReply: parsed.reply,
    }, null, 2));

    return {
      reply: parsed.reply || "That's great! Let's continue.",
      completed_missions: completedMissions,
      feedback,
      is_all_completed: Boolean(parsed.is_all_completed) || (allMissions.length > 0 && completedMissions.length >= allMissions.length),
      score: undefined,
      debug_log: {
        latency_ms: latencyMs,
        pending_before: pendingMissions.map(m => m.id),
        new_completed: newlyDone,
        relevance_level: feedback.relevance?.level || 'on_topic',
        penalty: feedback.relevance?.penalty || 0,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('[AI-TALK-EXCEPTION] Error during evaluateAndReplyAiTalk:', error);
    return fallbackResult(params.previouslyCompletedMissions, latencyMs);
  }
}

function fallbackResult(previouslyCompleted: string[], latencyMs = 0): LlmTalkTurnResult {
  return {
    reply: "I understand! Let's continue with our conversation.",
    completed_missions: previouslyCompleted,
    feedback: {
      accuracy: { is_correct: true },
      relevance: { level: 'on_topic', penalty: 0, note: 'Đúng chủ đề' },
      praise: "Cố gắng rất tốt!",
    },
    is_all_completed: false,
    score: 80,
    debug_log: {
      latency_ms: latencyMs,
      pending_before: [],
      new_completed: [],
      relevance_level: 'on_topic',
      penalty: 0,
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
