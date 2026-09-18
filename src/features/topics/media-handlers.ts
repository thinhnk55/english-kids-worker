import { errorResponse, successResponse } from '../../utils/response.ts';
import { createPresignedPutUrl, deleteTopicImage, topicImageKey, topicImageUrl } from '../../utils/r2-presign.ts';

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function topicImage(env: Env, id: number): Promise<{ image: string | null } | null> {
  return env.DB.prepare('SELECT image FROM english_kid_topic WHERE id = ?').bind(id).first<{ image: string | null }>();
}

export async function createTopicImagePresign(request: Request, env: Env, origin: string, rawId: string): Promise<Response> {
  const id = parseId(rawId);
  if (!id) return errorResponse(400, 'VALIDATION_ERROR', 'id chủ đề không hợp lệ', origin);
  if (!await topicImage(env, id)) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
  let body: { content_type?: unknown };
  try { body = await request.json() as { content_type?: unknown }; } catch { return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin); }
  if (body.content_type !== 'image/avif') return errorResponse(400, 'VALIDATION_ERROR', 'Ảnh chủ đề phải có định dạng image/avif', origin);
  const signed = await createPresignedPutUrl(topicImageKey(id), 'image/avif', env);
  if (!signed) return errorResponse(500, 'INTERNAL_ERROR', 'R2 presigned URL chưa được cấu hình', origin);
  return successResponse(200, 'SUCCESS', { id: 'image', key: `topics/${topicImageKey(id)}`, url: topicImageUrl(env, id), content_type: 'image/avif', upload_url: signed.uploadUrl, expires_in: signed.expiresIn }, origin);
}

export async function confirmTopicImage(env: Env, origin: string, rawId: string): Promise<Response> {
  const id = parseId(rawId);
  if (!id) return errorResponse(400, 'VALIDATION_ERROR', 'id chủ đề không hợp lệ', origin);
  const current = await topicImage(env, id);
  if (!current) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
  const image = topicImageUrl(env, id);
  if (current.image && current.image !== image) await deleteTopicImage(env, current.image);
  await env.DB.prepare('UPDATE english_kid_topic SET image = ? WHERE id = ?').bind(image, id).run();
  return successResponse(200, 'UPDATED', { id: 'image', url: image }, origin);
}

export async function deleteTopicImageAsset(env: Env, origin: string, rawId: string): Promise<Response> {
  const id = parseId(rawId);
  if (!id) return errorResponse(400, 'VALIDATION_ERROR', 'id chủ đề không hợp lệ', origin);
  const current = await topicImage(env, id);
  if (!current) return errorResponse(404, 'NOT_FOUND', 'Chủ đề không tồn tại', origin);
  await deleteTopicImage(env, current.image);
  await env.DB.prepare('UPDATE english_kid_topic SET image = NULL WHERE id = ?').bind(id).run();
  return successResponse(200, 'DELETED', { id: 'image' }, origin);
}
