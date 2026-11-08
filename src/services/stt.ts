export interface TranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export async function transcribeAudio(
  request: Request,
  env: Env,
): Promise<TranscribeResult> {
  const internalKey = env.INTERNAL_API_KEY || '751791ddb95fcb30db0330b2ea7c9bc9f15c4eee3f5d8ab968449988b4ef0d7c';
  const contentType = request.headers.get('content-type') || '';

  try {
    const upstreamRes = await env.STT_SERVICE.fetch('https://stt-worker/v1/internal/audio/transcriptions', {
      method: 'POST',
      headers: {
        'content-type': contentType,
        'X-Internal-Key': internalKey,
        'X-Caller': 'english-kids-worker',
      },
      body: request.body,
    });

    if (!upstreamRes.ok) {
      const err = await upstreamRes.text();
      console.error('STT upstream error:', upstreamRes.status, err);
      return { ok: false, error: 'Không thể nhận diện giọng nói' };
    }

    const data = await upstreamRes.json() as { text?: string };
    const text = data.text?.trim();
    if (!text) {
      return { ok: false, error: 'Không nhận diện được nội dung giọng nói' };
    }

    return { ok: true, text };
  } catch (error) {
    console.error('Failed to call STT service:', error);
    return { ok: false, error: 'Lỗi kết nối dịch vụ STT' };
  }
}
