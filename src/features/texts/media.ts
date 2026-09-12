import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';
import { getSentenceById, readBody } from '../sentences/handlers.ts';
import { getLexicalById } from '../lexicals/handlers.ts';

export async function handleUploadR2Asset(request: Request, env: Env, origin: string): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key')?.trim();

  if (!key) return errorResponse(400, 'VALIDATION_ERROR', 'Tham số key là bắt buộc', origin);

  const contentType = request.headers.get('content-type') || 'application/octet-stream';
  const body = await request.arrayBuffer();

  if (!body || body.byteLength === 0) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Nội dung file không được rỗng', origin);
  }

  try {
    await env.ASSETS.put(key, body, {
      httpMetadata: { contentType },
      customMetadata: { uploadedAt: new Date().toISOString() },
    });

    const baseUrl = env.ASSET_BASE_URL || 'https://english-kids-bucket.hocnhe.com';
    const publicUrl = `${baseUrl}/${key.replace(/^\/+/u, '')}`;

    return successResponse(201, 'CREATED', {
      uploadUrl: publicUrl,
      publicUrl,
      key,
      contentType,
    }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteR2Asset(request: Request, env: Env, origin: string): Promise<Response> {
  let key: string | null = null;
  const urlParam = new URL(request.url).searchParams.get('url');

  if (urlParam) {
    key = urlParam.replace(/^https?:\/\/[^/]+\//u, '');
  } else {
    const body = await readBody(request, origin);
    if (!(body instanceof Response) && typeof body.url === 'string') {
      key = body.url.replace(/^https?:\/\/[^/]+\//u, '');
    }
  }

  if (!key) return errorResponse(400, 'VALIDATION_ERROR', 'Cần cung cấp URL hoặc Key để xóa', origin);

  try {
    await env.ASSETS.delete(key);
    return successResponse(200, 'DELETED', { deleted: true, key }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleServeR2Asset(request: Request, env: Env, key: string, origin: string): Promise<Response> {
  const wantsRange = request.headers.has('Range');
  const object = await env.ASSETS.get(key, wantsRange ? { range: request.headers } : undefined);
  if (!object) return errorResponse(404, 'NOT_FOUND', 'Asset không tồn tại', origin);

  const headers = new Headers({
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': object.httpEtag,
    'Accept-Ranges': 'bytes',
  });

  if (object.httpMetadata?.contentType) {
    headers.set('Content-Type', object.httpMetadata.contentType);
  } else if (key.endsWith('.avif')) {
    headers.set('Content-Type', 'image/avif');
  } else if (key.endsWith('.opus')) {
    headers.set('Content-Type', 'audio/opus');
  } else if (key.endsWith('.mp4')) {
    headers.set('Content-Type', 'video/mp4');
  }

  let status = 200;
  if (object.range && 'offset' in object.range && typeof object.range.offset === 'number' && 'length' in object.range && typeof object.range.length === 'number') {
    const length = object.range.length;
    headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    status = 206;
  } else {
    headers.set('Content-Length', String(object.size));
  }

  if (request.method === 'HEAD') return new Response(null, { status, headers });
  return new Response(object.body, { status, headers });
}

// --- Sentence Media Handlers ---
export async function handleAddSentenceAudio(request: Request, env: Env, origin: string, sentenceId: string): Promise<Response> {
  const existing = await getSentenceById(env, sentenceId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Sentence không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const voice = typeof body.voice === 'string' ? body.voice.trim() : 'default';
  const url = typeof body.url === 'string' ? body.url.trim() : '';

  if (!url) return errorResponse(400, 'VALIDATION_ERROR', 'url không được để trống', origin);

  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO sentence_audio (id, sentence_id, voice, url)
      VALUES (?, ?, ?, ?)
    `).bind(id, sentenceId, voice, url).run();

    return successResponse(201, 'CREATED', { id, sentence_id: sentenceId, voice, url }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteSentenceAudio(env: Env, origin: string, sentenceId: string, audioId: string): Promise<Response> {
  try {
    const audio = await env.DB.prepare(`
      SELECT url FROM sentence_audio WHERE id = ? AND sentence_id = ?
    `).bind(audioId, sentenceId).first<{ url: string }>();

    if (!audio) return errorResponse(404, 'NOT_FOUND', 'Audio không tồn tại', origin);

    await env.DB.prepare(`
      DELETE FROM sentence_audio WHERE id = ? AND sentence_id = ?
    `).bind(audioId, sentenceId).run();

    if (audio.url && audio.url.includes('english-kids-bucket.hocnhe.com')) {
      const key = audio.url.replace(/^https?:\/\/[^/]+\//u, '');
      await env.ASSETS.delete(key).catch(console.error);
    }

    return successResponse(200, 'DELETED', { deleted: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

// --- Lexical Media Handlers ---
export async function handleAddLexicalAudio(request: Request, env: Env, origin: string, lexicalId: string): Promise<Response> {
  const existing = await getLexicalById(env, lexicalId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Lexical không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const voice = typeof body.voice === 'string' ? body.voice.trim() : 'default';
  const url = typeof body.url === 'string' ? body.url.trim() : '';

  if (!url) return errorResponse(400, 'VALIDATION_ERROR', 'url không được để trống', origin);

  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO lexical_audio (id, lexical_id, voice, url)
      VALUES (?, ?, ?, ?)
    `).bind(id, lexicalId, voice, url).run();

    return successResponse(201, 'CREATED', { id, lexical_id: lexicalId, voice, url }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteLexicalAudio(env: Env, origin: string, lexicalId: string, audioId: string): Promise<Response> {
  try {
    const audio = await env.DB.prepare(`
      SELECT url FROM lexical_audio WHERE id = ? AND lexical_id = ?
    `).bind(audioId, lexicalId).first<{ url: string }>();

    if (!audio) return errorResponse(404, 'NOT_FOUND', 'Audio không tồn tại', origin);

    await env.DB.prepare(`
      DELETE FROM lexical_audio WHERE id = ? AND lexical_id = ?
    `).bind(audioId, lexicalId).run();

    if (audio.url && audio.url.includes('english-kids-bucket.hocnhe.com')) {
      const key = audio.url.replace(/^https?:\/\/[^/]+\//u, '');
      await env.ASSETS.delete(key).catch(console.error);
    }

    return successResponse(200, 'DELETED', { deleted: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleAddLexicalImage(request: Request, env: Env, origin: string, lexicalId: string): Promise<Response> {
  const existing = await getLexicalById(env, lexicalId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Lexical không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return errorResponse(400, 'VALIDATION_ERROR', 'url không được để trống', origin);

  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO lexical_image (id, lexical_id, url)
      VALUES (?, ?, ?)
    `).bind(id, lexicalId, url).run();

    return successResponse(201, 'CREATED', { id, lexical_id: lexicalId, url }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteLexicalImage(env: Env, origin: string, lexicalId: string, imageId: string): Promise<Response> {
  try {
    const img = await env.DB.prepare(`
      SELECT url FROM lexical_image WHERE id = ? AND lexical_id = ?
    `).bind(imageId, lexicalId).first<{ url: string }>();

    if (!img) return errorResponse(404, 'NOT_FOUND', 'Image không tồn tại', origin);

    await env.DB.prepare(`
      DELETE FROM lexical_image WHERE id = ? AND lexical_id = ?
    `).bind(imageId, lexicalId).run();

    if (img.url && img.url.includes('english-kids-bucket.hocnhe.com')) {
      const key = img.url.replace(/^https?:\/\/[^/]+\//u, '');
      await env.ASSETS.delete(key).catch(console.error);
    }

    return successResponse(200, 'DELETED', { deleted: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleAddLexicalVideo(request: Request, env: Env, origin: string, lexicalId: string): Promise<Response> {
  const existing = await getLexicalById(env, lexicalId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Lexical không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return errorResponse(400, 'VALIDATION_ERROR', 'url không được để trống', origin);

  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO lexical_video (id, lexical_id, url)
      VALUES (?, ?, ?)
    `).bind(id, lexicalId, url).run();

    return successResponse(201, 'CREATED', { id, lexical_id: lexicalId, url }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteLexicalVideo(env: Env, origin: string, lexicalId: string, videoId: string): Promise<Response> {
  try {
    const res = await env.DB.prepare(`
      DELETE FROM lexical_video WHERE id = ? AND lexical_id = ?
    `).bind(videoId, lexicalId).run();

    if (res.meta.changes === 0) return errorResponse(404, 'NOT_FOUND', 'Video không tồn tại', origin);
    return successResponse(200, 'DELETED', { deleted: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

// Backward-compatible aliases for legacy /texts endpoints
export const handleAddTextAudio = handleAddSentenceAudio;
export const handleDeleteTextAudio = handleDeleteSentenceAudio;
export const handleAddTextImage = handleAddSentenceImage;
export const handleDeleteTextImage = handleDeleteSentenceImage;
export const handleAddTextVideo = handleAddSentenceVideo;
export const handleDeleteTextVideo = handleDeleteSentenceVideo;
