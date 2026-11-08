import type { AiTalkMission, ChatMessage, ChatMessageFeedback } from '../types/ai-talk.ts';

export interface LlmTalkTurnResult {
  reply: string;
  completed_missions: string[];
  feedback?: ChatMessageFeedback;
  is_all_completed: boolean;
  score?: number;
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
  },
): Promise<LlmTalkTurnResult> {
  const internalKey = env.INTERNAL_API_KEY || '751791ddb95fcb30db0330b2ea7c9bc9f15c4eee3f5d8ab968449988b4ef0d7c';

  const systemInstructions = `You are a friendly, encouraging English conversation partner for kids learning English.
Current Scenario:
- Situation: ${params.situation}
- Your Role: ${params.aiRole}
- Child's Role: ${params.userRole}
- Personality & Guidance: ${params.aiPrompt}

Target Missions for Child:
${JSON.stringify(params.missions, null, 2)}
Previously completed mission codes: ${JSON.stringify(params.previouslyCompletedMissions)}

Turn count: ${params.turnsCount + 1} of ${params.maxTurns}.

Your Goal:
1. Reply naturally and warmly in character as "${params.aiRole}".
2. Keep your response very concise (1-2 short sentences, simple English for kids).
3. Check if the child's latest message satisfies any of the target missions. Return the list of ALL currently completed mission codes (including previous ones and any newly achieved ones).
4. Provide gentle feedback for the child: a short praise or a small natural suggestion if applicable.
5. If all missions in the list are now completed, set "is_all_completed": true. Otherwise false.
6. Provide an integer "score" from 50 to 100 representing child's effort and English accuracy so far.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "reply": "string (what AI says to the child)",
  "completed_missions": ["code1", "code2"],
  "feedback": {
    "praise": "short encouragement in English or Vietnamese",
    "grammar": "optional gentle correction",
    "suggestion": "optional tip"
  },
  "is_all_completed": boolean,
  "score": number
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
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstructions },
          ...conversationHistory,
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LLM API error:', response.status, errText);
      return fallbackResult(params.previouslyCompletedMissions);
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return fallbackResult(params.previouslyCompletedMissions);

    const parsed = JSON.parse(content) as LlmTalkTurnResult;
    return {
      reply: parsed.reply || "That's wonderful! Can you tell me more?",
      completed_missions: Array.isArray(parsed.completed_missions) ? parsed.completed_missions : params.previouslyCompletedMissions,
      feedback: parsed.feedback,
      is_all_completed: Boolean(parsed.is_all_completed),
      score: typeof parsed.score === 'number' ? parsed.score : 80,
    };
  } catch (error) {
    console.error('Failed to call LLM:', error);
    return fallbackResult(params.previouslyCompletedMissions);
  }
}

function fallbackResult(previouslyCompleted: string[]): LlmTalkTurnResult {
  return {
    reply: "Great job! What would you like to say next?",
    completed_missions: previouslyCompleted,
    feedback: { praise: "Good effort!" },
    is_all_completed: false,
    score: 75,
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

  const systemInstructions = `You are a warm, supportive English coach for kids learning English.
The child is in a roleplay conversation and needs a quick, practical hint on what to reply right now.
Context:
- Scenario: ${params.situation}
- AI partner (${params.aiRole}) just said: "${params.lastAssistantMessage || ''}"
- Next mission / goal for the child: "${params.nextMissionGoal || 'Continue conversation naturally'}"

Instruction:
Provide 1 very simple, encouraging sentence suggesting what the child can say in English.
Keep vocabulary simple and natural.
Example: "You can say: 'I want chocolate, please!'" or "Try asking: 'How much does it cost?'"
Respond ONLY with the hint text. Do not wrap in JSON or add explanation.`;

  try {
    const response = await env.LLM_SERVICE.fetch('https://llm-worker/v1/internal/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Internal-Key': internalKey,
        'X-Caller': 'english-kids-worker',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: 'Give me a hint on what to say.' },
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
    console.error('Failed to generate hint:', error);
    return `Try saying: "Yes, please!"`;
  }
}
