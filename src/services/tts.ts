import { buildCorsHeaders } from '../utils/cors.ts';
import { errorResponse } from '../utils/response.ts';

export interface SynthesizeOptions {
  voice?: string;
  speed?: number;
  model?: string;
}

export async function synthesizeSpeech(
  env: Env,
  text: string,
  options?: SynthesizeOptions,
  origin = '*',
): Promise<Response> {
  const internalKey = env.INTERNAL_API_KEY || '751791ddb95fcb30db0330b2ea7c9bc9f15c4eee3f5d8ab968449988b4ef0d7c';

  try {
    const response = await env.TTS_SERVICE.fetch('https://tts-worker/v1/internal/audio/speech', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Internal-Key': internalKey,
        'X-Caller': 'english-kids-worker',
      },
      body: JSON.stringify({
        input: text,
        voice: options?.voice || 'alloy',
        speed: options?.speed || 1.0,
        model: options?.model || 'tts-1',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('TTS upstream error:', response.status, err);
      return errorResponse(502, 'BAD_GATEWAY', 'Không thể chuyển đổi giọng đọc', origin);
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    return new Response(response.body, {
      status: 200,
      headers: new Headers({
        'content-type': contentType,
        'cache-control': 'public, max-age=86400',
        ...buildCorsHeaders(origin),
      }),
    });
  } catch (error) {
    console.error('Failed to call TTS service:', error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Lỗi kết nối dịch vụ TTS', origin);
  }
}
