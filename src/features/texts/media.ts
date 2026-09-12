import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';
import { getTextById, readBody } from './handlers.ts';

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

export async function handleAddTextAudio(request: Request, env: Env, origin: string, textId: string): Promise<Response> {
  const existing = await getTextById(env, textId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Text không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const voice = typeof body.voice === 'string' ? body.voice.trim() : 'default';
  const url = typeof body.url === 'string' ? body.url.trim() : '';

  if (!url) return errorResponse(400, 'VALIDATION_ERROR', 'url không được để trống', origin);

  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO text_audio (id, texts_id, voice, url)
      VALUES (?, ?, ?, ?)
    `).bind(id, textId, voice, url).run();

    return successResponse(201, 'CREATED', { id, texts_id: textId, voice, url }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteTextAudio(env: Env, origin: string, textId: string, audioId: string): Promise<Response> {
  try {
    const audio = await env.DB.prepare(`
      SELECT url FROM text_audio WHERE id = ? AND texts_id = ?
    `).bind(audioId, textId).first<{ url: string }>();

    if (!audio) return errorResponse(404, 'NOT_FOUND', 'Audio không tồn tại', origin);

    await env.DB.prepare(`
      DELETE FROM text_audio WHERE id = ? AND texts_id = ?
    `).bind(audioId, textId).run();

    if (audio.url && audio.url.includes('english-kids-bucket.hocnhe.com')) {
      const key = audio.url.replace(/^https?:\/\/[^/]+\//u, '');
      await env.ASSETS.delete(key).catch(console.error);
    }

    return successResponse(200, 'DELETED', { deleted: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleAddTextImage(request: Request, env: Env, origin: string, textId: string): Promise<Response> {
  const existing = await getTextById(env, textId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Text không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return errorResponse(400, 'VALIDATION_ERROR', 'url không được để trống', origin);

  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO text_image (id, texts_id, url)
      VALUES (?, ?, ?)
    `).bind(id, textId, url).run();

    return successResponse(201, 'CREATED', { id, texts_id: textId, url }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteTextImage(env: Env, origin: string, textId: string, imageId: string): Promise<Response> {
  try {
    const img = await env.DB.prepare(`
      SELECT url FROM text_image WHERE id = ? AND texts_id = ?
    `).bind(imageId, textId).first<{ url: string }>();

    if (!img) return errorResponse(404, 'NOT_FOUND', 'Image không tồn tại', origin);

    await env.DB.prepare(`
      DELETE FROM text_image WHERE id = ? AND texts_id = ?
    `).bind(imageId, textId).run();

    if (img.url && img.url.includes('english-kids-bucket.hocnhe.com')) {
      const key = img.url.replace(/^https?:\/\/[^/]+\//u, '');
      await env.ASSETS.delete(key).catch(console.error);
    }

    return successResponse(200, 'DELETED', { deleted: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleAddTextVideo(request: Request, env: Env, origin: string, textId: string): Promise<Response> {
  const existing = await getTextById(env, textId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Text không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return errorResponse(400, 'VALIDATION_ERROR', 'url không được để trống', origin);

  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO text_video (id, texts_id, url)
      VALUES (?, ?, ?)
    `).bind(id, textId, url).run();

    return successResponse(201, 'CREATED', { id, texts_id: textId, url }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteTextVideo(env: Env, origin: string, textId: string, videoId: string): Promise<Response> {
  try {
    const res = await env.DB.prepare(`
      DELETE FROM text_video WHERE id = ? AND texts_id = ?
    `).bind(videoId, textId).run();

    if (res.meta.changes === 0) return errorResponse(404, 'NOT_FOUND', 'Video không tồn tại', origin);
    return successResponse(200, 'DELETED', { deleted: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateTextLexicals(request: Request, env: Env, origin: string, textId: string): Promise<Response> {
  const existing = await getTextById(env, textId);
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Text không tồn tại', origin);

  const body = await readBody(request, origin);
  if (body instanceof Response) return body;

  const lexicals = Array.isArray(body.lexicals) ? body.lexicals : [];

  try {
    const statements: D1PreparedStatement[] = [
      env.DB.prepare('DELETE FROM sentence_lexical WHERE sentence_id = ?').bind(textId),
    ];

    for (const item of lexicals) {
      if (typeof item === 'object' && item !== null) {
        const lexicalId = typeof item.lexical_id === 'string' ? item.lexical_id.trim() : '';
        const tokenIndexes = Array.isArray(item.token_indexes)
          ? item.token_indexes.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0)
          : [];
        const displayOrder = Number.isInteger(item.display_order) ? Number(item.display_order) : 0;

        if (lexicalId && tokenIndexes.length > 0) {
          const mappingId = generateUUIDv7();
          statements.push(
            env.DB.prepare(`
              INSERT INTO sentence_lexical (id, sentence_id, lexical_id, token_indexes, display_order)
              VALUES (?, ?, ?, ?, ?)
            `).bind(mappingId, textId, lexicalId, JSON.stringify(tokenIndexes), displayOrder)
          );
        }
      }
    }

    await env.DB.batch(statements);
    return successResponse(200, 'UPDATED', { updated: true }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
