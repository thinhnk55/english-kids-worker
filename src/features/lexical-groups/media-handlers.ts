import { createPresignedPutUrlForObject, lexicalGroupAudioKey, lexicalGroupAudioUrl, lexicalGroupImageKey, lexicalGroupImageUrl } from '../../utils/r2-presign.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';

type MediaKind = 'image' | 'audio';
interface GroupMediaRow { id: string; image: string | null; audio: string | null; }
async function find(env: Env, id: string) { return env.DB.prepare('SELECT id, image, audio FROM lexical_groups WHERE id = ?').bind(id).first<GroupMediaRow>(); }
function config(kind: MediaKind, id: string, env: Env) { return kind === 'image' ? { key: lexicalGroupImageKey(id), url: lexicalGroupImageUrl(env, id), contentType: 'image/avif', column: 'image' as const } : { key: lexicalGroupAudioKey(id), url: lexicalGroupAudioUrl(env, id), contentType: 'audio/ogg', column: 'audio' as const }; }

export async function presignLexicalGroupMedia(request: Request, env: Env, origin: string, id: string, kind: MediaKind): Promise<Response> {
  if (!await find(env, id)) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy nhóm từ', origin);
  let body: { content_type?: unknown }; try { body = await request.json() as { content_type?: unknown }; } catch { return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin); }
  const media = config(kind, id, env); if (body.content_type !== media.contentType) return errorResponse(400, 'VALIDATION_ERROR', `File phải có định dạng ${media.contentType}`, origin);
  const signed = await createPresignedPutUrlForObject(media.key, media.contentType, env); if (!signed) return errorResponse(500, 'INTERNAL_ERROR', 'R2 presigned URL chưa được cấu hình', origin);
  return successResponse(200, 'SUCCESS', { id: kind, key: media.key, url: media.url, content_type: media.contentType, upload_url: signed.uploadUrl, expires_in: signed.expiresIn }, origin);
}

export async function confirmLexicalGroupMedia(env: Env, origin: string, id: string, kind: MediaKind): Promise<Response> {
  if (!await find(env, id)) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy nhóm từ', origin);
  const media = config(kind, id, env); if (!await env.ASSETS.head(media.key)) return errorResponse(400, 'VALIDATION_ERROR', 'Chưa tìm thấy file đã tải lên', origin);
  await env.DB.prepare(`UPDATE lexical_groups SET ${media.column} = ? WHERE id = ?`).bind(media.url, id).run(); return successResponse(200, 'UPDATED', { id: kind, url: media.url }, origin);
}

export async function deleteLexicalGroupMedia(env: Env, origin: string, id: string, kind: MediaKind): Promise<Response> {
  const row = await find(env, id); if (!row) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy nhóm từ', origin);
  const media = config(kind, id, env); await env.ASSETS.delete(media.key); await env.DB.prepare(`UPDATE lexical_groups SET ${media.column} = NULL WHERE id = ?`).bind(id).run(); return successResponse(200, 'DELETED', { id: kind }, origin);
}
