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
  turn_deduction: number;
  evaluation?: SessionCompetencyEvaluation;
  debug_log?: {
    latency_ms: number;
    pending_before: string[];
    new_completed: string[];
    turn_deduction: number;
    focus_penalty: number;
    focus_score_after: number;
  };
}

function getMissionId(m: AiTalkMission): string {
  return m.id || m.code || '';
}

function getMissionGoal(m: AiTalkMission): string {
  return m.goal || m.text || '';
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
    currentCompetencyScore: number;
  },
): Promise<LlmTalkTurnResult> {
  const internalKey = env.INTERNAL_API_KEY || '751791ddb95fcb30db0330b2ea7c9bc9f15c4eee3f5d8ab968449988b4ef0d7c';
  const startTime = Date.now();

  const allMissions = params.missions || [];
  const completedSet = new Set(params.previouslyCompletedMissions || []);
  const pendingMissions = allMissions.filter(m => !completedSet.has(getMissionId(m)));

  const lastUserMessage = [...params.messages].reverse().find(m => m.role === 'user')?.content || '';

  const missionsListStr = allMissions
    .map((m, idx) => `  ${idx + 1}. [${getMissionId(m)}] ${getMissionGoal(m)} (Hints: ${(m.hints || []).join(', ') || 'None'})`)
    .join('\n');

  const pendingListStr = pendingMissions.length > 0
    ? pendingMissions.map(m => `  - [${getMissionId(m)}] ${getMissionGoal(m)}`).join('\n')
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

Current turn: ${params.turnsCount + 1} of ${params.maxTurns}.
Focus Energy: ${params.currentFocusScore}/100. Current Competency Score: ${params.currentCompetencyScore}/100.

EVALUATION & SCORING RULES:

1. ACCURACY CHECK (Ngữ pháp & chính tả):
   - Set "has_accuracy_error": true if there is any noticeable grammar, spelling, or word order mistake.
   - If true, set "accuracy_issue": brief description of the mistake and how to fix it (e.g. "Sai trật tự từ: nên nói 'large pizza' thay vì 'pizza big'").
   - Rule: Sai ngữ pháp chính tả sẽ bị trừ 10 điểm năng lực.

2. NATURALNESS CHECK (Độ tự nhiên):
   - Set "is_unnatural": true if the sentence is grammatically understandable but sounds unnatural, stiff, or not like how a native speaker would say it in this conversation.
   - If true, set "naturalness_suggestion": a natural phrasing (e.g. "Nên nói: 'I would like a large pizza, please.'").
   - Rule: Chưa tự nhiên sẽ bị trừ 5 điểm năng lực.

3. RELEVANCE CHECK (Nội dung liên quan chủ đề & Focus Energy):
   - Set "is_off_topic": true if the learner says something unrelated to the scenario/order/topic.
   - If true, set "off_topic_reason": brief reason (e.g. "Hỏi việc ngoài lề không liên quan đến đặt bánh").
   - Set "off_topic_severity":
     * "slight": slightly off or pausing (Focus Energy -10)
     * "complete": completely off-topic or talking to AI as a bot (Focus Energy -25)
     * "intentional": deliberate repeated derailment (Focus Energy -35)
   - Rule: Không liên quan chủ đề sẽ bị trừ 10 điểm năng lực (và trừ Focus Energy tương ứng).
   * Note: Nếu mắc đồng thời nhiều lỗi, hệ thống sẽ tự động cộng dồn tất cả các điểm trừ.

4. CHECK MISSION ADVANCEMENT:
   - Check if the learner's message satisfies any of the PENDING missions.
   - If satisfied (even in simple/imperfect words), include its mission ID in "completed_missions".
   - Return cumulative list of ALL completed mission IDs (both previous and newly achieved).
   - Set "is_all_completed": true if all ${allMissions.length} missions in the scenario are now done.

5. IN-CHARACTER REPLY:
   - Speak 100% in character as "${params.aiRole}".
   - Keep it short: 1 to 2 natural sentences in simple English for learners.
   - If learner is OFF-TOPIC: Politely redirect them back to the scenario.
   - If learner is ON-TOPIC: React naturally and ask a question to prompt the NEXT pending mission!
   - If ALL missions are finished: Conclude with a warm wrap-up and thank the customer/learner.

6. OVERALL COMPETENCY EVALUATION:
   - "overall": 1-2 sentences summarizing their English communication performance.
   - "strengths": 1-2 positive highlights observed.
   - "improvements": 1-2 practical suggestions for improvement.

OUTPUT FORMAT: Strict JSON matching this schema:
{
  "reply": "string (what AI says in character)",
  "completed_missions": ["id1", "id2"],
  "feedback": {
    "has_accuracy_error": boolean,
    "accuracy_issue": "string or null",
    "is_unnatural": boolean,
    "naturalness_suggestion": "string or null",
    "is_off_topic": boolean,
    "off_topic_reason": "string or null",
    "off_topic_severity": "slight" | "complete" | "intentional",
    "praise": "string"
  },
  "is_all_completed": boolean,
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
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI-TALK-LLM-ERROR] Status:', response.status, errText);
      return fallbackResult(params.previouslyCompletedMissions, params.currentFocusScore, params.currentCompetencyScore, latencyMs);
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.warn('[AI-TALK-LLM-EMPTY] No content returned from LLM');
      return fallbackResult(params.previouslyCompletedMissions, params.currentFocusScore, params.currentCompetencyScore, latencyMs);
    }

    const parsed = JSON.parse(content) as {
      reply?: string;
      completed_missions?: string[];
      feedback?: {
        has_accuracy_error?: boolean;
        accuracy_issue?: string;
        is_unnatural?: boolean;
        naturalness_suggestion?: string;
        is_off_topic?: boolean;
        off_topic_reason?: string;
        off_topic_severity?: 'slight' | 'complete' | 'intentional';
        praise?: string;
      };
      is_all_completed?: boolean;
      evaluation?: SessionCompetencyEvaluation;
    };

    const completedMissions = Array.isArray(parsed.completed_missions)
      ? Array.from(new Set([...params.previouslyCompletedMissions, ...parsed.completed_missions]))
      : params.previouslyCompletedMissions;

    // DETERMINISTIC DEDUCTION CALCULATION:
    // - 1 lần chưa tự nhiên trừ 5 điểm
    // - 1 lần sai ngữ pháp chính tả trừ 10 điểm
    // - 1 lần nội dung không liên quan chủ đề trừ 10 điểm
    // - Mắc đồng thời nhiều lỗi thì cộng dồn lại trừ điểm
    const deductions: Array<{ rule: string; points: number; detail?: string }> = [];
    let turnDeduction = 0;

    const hasAccuracyError = Boolean(parsed.feedback?.has_accuracy_error);
    if (hasAccuracyError) {
      turnDeduction += 10;
      deductions.push({
        rule: 'Sai ngữ pháp / chính tả',
        points: 10,
        detail: parsed.feedback?.accuracy_issue || 'Lỗi ngữ pháp hoặc chính tả',
      });
    }

    const isUnnatural = Boolean(parsed.feedback?.is_unnatural);
    if (isUnnatural) {
      turnDeduction += 5;
      deductions.push({
        rule: 'Chưa tự nhiên',
        points: 5,
        detail: parsed.feedback?.naturalness_suggestion || 'Cách diễn đạt chưa tự nhiên',
      });
    }

    const isOffTopic = Boolean(parsed.feedback?.is_off_topic);
    let focusPenalty = 0;
    if (isOffTopic) {
      turnDeduction += 10;
      const sev = parsed.feedback?.off_topic_severity;
      focusPenalty = sev === 'intentional' ? -35 : sev === 'complete' ? -25 : -10;
      deductions.push({
        rule: 'Nội dung không liên quan chủ đề',
        points: 10,
        detail: parsed.feedback?.off_topic_reason || 'Nội dung không bám sát tình huống',
      });
    }

    const newCompetencyScore = Math.max(0, params.currentCompetencyScore - turnDeduction);
    const focusScoreAfter = Math.max(0, params.currentFocusScore + focusPenalty);

    const feedback: ChatMessageFeedback = {
      has_accuracy_error: hasAccuracyError,
      accuracy_issue: parsed.feedback?.accuracy_issue || undefined,
      is_unnatural: isUnnatural,
      naturalness_suggestion: parsed.feedback?.naturalness_suggestion || undefined,
      is_off_topic: isOffTopic,
      off_topic_reason: parsed.feedback?.off_topic_reason || undefined,
      off_topic_severity: parsed.feedback?.off_topic_severity,
      turn_deduction: turnDeduction,
      deductions,
      focus_penalty: focusPenalty,
      praise: parsed.feedback?.praise || (turnDeduction === 0 ? 'Phản hồi rất tốt và tự nhiên!' : 'Cố gắng tốt!'),
      accuracy: {
        is_correct: !hasAccuracyError,
        issue: parsed.feedback?.accuracy_issue || undefined,
      },
      relevance: {
        level: isOffTopic
          ? (parsed.feedback?.off_topic_severity === 'complete' ? 'completely_off_topic' : 'slight_off_topic')
          : 'on_topic',
        penalty: focusPenalty,
        note: isOffTopic ? (parsed.feedback?.off_topic_reason || 'Lạc đề') : 'Đúng chủ đề',
      },
      naturalness: {
        suggestion: parsed.feedback?.naturalness_suggestion || undefined,
      },
    };

    const newlyDone = completedMissions.filter(id => !completedSet.has(id));

    const evaluation: SessionCompetencyEvaluation = {
      performance_score: newCompetencyScore,
      overall: parsed.evaluation?.overall || 'Đã tích cực tham gia đối thoại tiếng Anh.',
      strengths: Array.isArray(parsed.evaluation?.strengths) && parsed.evaluation.strengths.length > 0
        ? parsed.evaluation.strengths
        : (turnDeduction === 0 ? ['Phản xạ chuẩn xác', 'Diễn đạt tự nhiên'] : ['Tự tin phản hồi']),
      improvements: Array.isArray(parsed.evaluation?.improvements) && parsed.evaluation.improvements.length > 0
        ? parsed.evaluation.improvements
        : deductions.map(d => `${d.rule}: ${d.detail || ''}`),
    };

    // Structured Server Logging
    console.log('[AI-TALK-TURN-LOG]', JSON.stringify({
      turn: params.turnsCount + 1,
      latencyMs,
      learnerInput: lastUserMessage,
      turnDeduction: `-${turnDeduction}đ (${deductions.map(d => `${d.rule}: -${d.points}đ`).join(', ') || '0đ trừ'})`,
      competencyScore: `${params.currentCompetencyScore} -> ${newCompetencyScore}`,
      focusEnergy: `${params.currentFocusScore} -> ${focusScoreAfter} (penalty: ${focusPenalty})`,
      newlyCompletedMissions: newlyDone,
      allCompletedMissions: completedMissions,
      aiReply: parsed.reply,
    }, null, 2));

    return {
      reply: parsed.reply || "That's great! Let's continue.",
      completed_missions: completedMissions,
      feedback,
      is_all_completed: Boolean(parsed.is_all_completed) || (allMissions.length > 0 && completedMissions.length >= allMissions.length),
      performance_score: newCompetencyScore,
      turn_deduction: turnDeduction,
      evaluation,
      debug_log: {
        latency_ms: latencyMs,
        pending_before: pendingMissions.map(getMissionId),
        new_completed: newlyDone,
        turn_deduction: turnDeduction,
        focus_penalty: focusPenalty,
        focus_score_after: focusScoreAfter,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('[AI-TALK-EXCEPTION] Error during evaluateAndReplyAiTalk:', error);
    return fallbackResult(params.previouslyCompletedMissions, params.currentFocusScore, params.currentCompetencyScore, latencyMs);
  }
}

function fallbackResult(previouslyCompleted: string[], currentFocus: number, currentCompetency: number, latencyMs = 0): LlmTalkTurnResult {
  return {
    reply: "I understand! Let's continue with our conversation.",
    completed_missions: previouslyCompleted,
    feedback: {
      has_accuracy_error: false,
      is_unnatural: false,
      is_off_topic: false,
      turn_deduction: 0,
      deductions: [],
      focus_penalty: 0,
      praise: "Cố gắng rất tốt!",
      accuracy: { is_correct: true },
      relevance: { level: 'on_topic', penalty: 0, note: 'Đúng chủ đề' },
    },
    is_all_completed: false,
    performance_score: currentCompetency,
    turn_deduction: 0,
    evaluation: {
      performance_score: currentCompetency,
      overall: 'Hoàn thành lượt thoại với tinh thần giao tiếp tích cực.',
      strengths: ['Tự tin phản hồi'],
      improvements: ['Tiếp tục luyện tập để tăng độ lưu loát'],
    },
    debug_log: {
      latency_ms: latencyMs,
      pending_before: [],
      new_completed: [],
      turn_deduction: 0,
      focus_penalty: 0,
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
        max_tokens: 150,
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
