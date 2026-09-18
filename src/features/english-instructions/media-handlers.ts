import { createPresignedPutUrlForObject, deleteInstructionAudio, instructionAudioKey, instructionAudioUrl } from '../../utils/r2-presign.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';

interface InstructionMediaRow {
  id: string;
  voice_id: string;
  audio: string | null;
}

async function findInstruction(env: Env, id: string): Promise<InstructionMediaRow | null> {
  return env.DB.prepare(`
    SELECT id, voice_id, audio
    FROM english_instructions
    WHERE id = ?
  `).bind(id).first<InstructionMediaRow>();
}

export async function createInstructionAudioPresign(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const instruction = await findInstruction(env, id);
  if (!instruction) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy câu hướng dẫn', origin);

  let body: { content_type?: unknown };
  try {
    body = await request.json() as { content_type?: unknown };
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin);
  }
  if (body.content_type !== 'audio/ogg') {
    return errorResponse(400, 'VALIDATION_ERROR', 'Audio hướng dẫn phải có định dạng audio/ogg', origin);
  }

  const key = instructionAudioKey(instruction.id, instruction.voice_id);
  const signed = await createPresignedPutUrlForObject(key, 'audio/ogg', env);
  if (!signed) return errorResponse(500, 'INTERNAL_ERROR', 'R2 presigned URL chưa được cấu hình', origin);
  return successResponse(200, 'SUCCESS', {
    id: 'audio',
    key,
    url: instructionAudioUrl(env, instruction.id, instruction.voice_id),
    content_type: 'audio/ogg',
    upload_url: signed.uploadUrl,
    expires_in: signed.expiresIn,
    voice_id: instruction.voice_id,
  }, origin);
}

export async function confirmInstructionAudio(env: Env, origin: string, id: string): Promise<Response> {
  const instruction = await findInstruction(env, id);
  if (!instruction) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy câu hướng dẫn', origin);
  const key = instructionAudioKey(instruction.id, instruction.voice_id);
  const object = await env.ASSETS.head(key);
  if (!object) return errorResponse(400, 'VALIDATION_ERROR', 'Chưa tìm thấy file audio đã tải lên', origin);
  const audio = instructionAudioUrl(env, instruction.id, instruction.voice_id);
  if (instruction.audio && instruction.audio !== audio) await deleteInstructionAudio(env, instruction.audio, instruction.id, instruction.voice_id);
  await env.DB.prepare('UPDATE english_instructions SET audio = ? WHERE id = ?').bind(audio, id).run();
  return successResponse(200, 'UPDATED', { id: 'audio', url: audio, voice_id: instruction.voice_id }, origin);
}

export async function deleteInstructionAudioAsset(env: Env, origin: string, id: string): Promise<Response> {
  const instruction = await findInstruction(env, id);
  if (!instruction) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy câu hướng dẫn', origin);
  await deleteInstructionAudio(env, instruction.audio, instruction.id, instruction.voice_id);
  await env.DB.prepare('UPDATE english_instructions SET audio = NULL WHERE id = ?').bind(id).run();
  return successResponse(200, 'DELETED', { id: 'audio' }, origin);
}
