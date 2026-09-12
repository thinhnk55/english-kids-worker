import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';
import { getTextById, readBody } from './handlers.ts';

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
    const res = await env.DB.prepare(`
      DELETE FROM text_audio WHERE id = ? AND texts_id = ?
    `).bind(audioId, textId).run();

    if (res.meta.changes === 0) return errorResponse(404, 'NOT_FOUND', 'Audio không tồn tại', origin);
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
    const res = await env.DB.prepare(`
      DELETE FROM text_image WHERE id = ? AND texts_id = ?
    `).bind(imageId, textId).run();

    if (res.meta.changes === 0) return errorResponse(404, 'NOT_FOUND', 'Image không tồn tại', origin);
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
