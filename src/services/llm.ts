export async function callLlmCompletion(
  env: Env,
  params: {
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  },
): Promise<{ text: string }> {
  const internalKey = env.INTERNAL_API_KEY || '751791ddb95fcb30db0330b2ea7c9bc9f15c4eee3f5d8ab968449988b4ef0d7c';

  const messages = params.messages || (params.prompt ? [{ role: 'user', content: params.prompt }] : []);
  const maxTokens = Math.min(Math.max(params.max_tokens || 500, 1), 600);

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
      messages,
      temperature: params.temperature ?? 0.5,
      max_tokens: maxTokens,
      ...(params.response_format ? { response_format: params.response_format } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM_ERROR_${response.status}: ${errText}`);
  }

  const json = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = json.choices?.[0]?.message?.content?.trim() || '';
  return { text };
}
