import { parsePagination } from '../../utils/pagination.ts';
import { deleteInstructionAudio } from '../../utils/r2-presign.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

type JsonObject = Record<string, unknown>;

interface EnglishInstruction {
  id: string;
  text: string;
  translations: string;
  pronunciation: string | null;
  voice_id: string;
  audio: string | null;
}

interface EnglishInstructionInput {
  text: string;
  translations: Record<string, { text?: string }>;
  pronunciation: string | null;
  voice_id: string;
}

const DEFAULT_VOICE_ID = 'kokoro-af_heart';
const VOICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]+-[A-Za-z0-9][A-Za-z0-9_-]*$/u;

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

async function readBody(request: Request, origin: string): Promise<JsonObject | Response> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu phải là một JSON object', origin);
    }
    return body as JsonObject;
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin);
  }
}

function requiredText(value: unknown, field: string, origin: string): string | Response {
  if (typeof value !== 'string' || !value.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', `${field} không được để trống`, origin);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, origin: string): string | null | Response {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return errorResponse(400, 'VALIDATION_ERROR', `${field} phải là chuỗi hoặc null`, origin);
  return value.trim() || null;
}

function parseTranslations(value: string): Record<string, { text?: string }> {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, { text?: string }>
      : {};
  } catch {
    return {};
  }
}

function parseInstruction(row: EnglishInstruction) {
  return { ...row, translations: parseTranslations(row.translations) };
}

function readTranslations(value: unknown, origin: string): EnglishInstructionInput['translations'] | Response {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'translations phải là một JSON object', origin);
  }
  const translations: EnglishInstructionInput['translations'] = {};
  for (const [locale, rawTranslation] of Object.entries(value)) {
    if (typeof rawTranslation !== 'object' || rawTranslation === null || Array.isArray(rawTranslation)) {
      return errorResponse(400, 'VALIDATION_ERROR', `translations.${locale} không hợp lệ`, origin);
    }
    const text = (rawTranslation as JsonObject).text;
    if (text !== undefined && typeof text !== 'string') {
      return errorResponse(400, 'VALIDATION_ERROR', `translations.${locale}.text phải là chuỗi`, origin);
    }
    translations[locale] = typeof text === 'string' && text.trim() ? { text: text.trim() } : {};
  }
  return translations;
}

async function readInput(request: Request, origin: string): Promise<EnglishInstructionInput | Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;
  const text = requiredText(body.text, 'text', origin);
  if (isResponse(text)) return text;
  const translations = readTranslations(body.translations, origin);
  if (isResponse(translations)) return translations;
  const pronunciation = optionalText(body.pronunciation, 'pronunciation', origin);
  if (isResponse(pronunciation)) return pronunciation;
  const voiceId = body.voice_id === undefined || body.voice_id === null
    ? DEFAULT_VOICE_ID
    : optionalText(body.voice_id, 'voice_id', origin);
  if (isResponse(voiceId)) return voiceId;
  if (!voiceId || !VOICE_ID_PATTERN.test(voiceId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'voice_id phải có dạng engine-voice_id, ví dụ kokoro-af_heart', origin);
  }
  return { text, translations, pronunciation, voice_id: voiceId };
}

async function findInstruction(env: Env, id: string): Promise<EnglishInstruction | null> {
  return env.DB.prepare(`
    SELECT id, text, translations, pronunciation, voice_id, audio
    FROM english_instructions
    WHERE id = ?
  `).bind(id).first<EnglishInstruction>();
}

export async function handleListEnglishInstructions(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { page, size, offset } = parsePagination(url);
    const query = url.searchParams.get('q')?.trim() ?? '';
    const where = query ? 'WHERE text LIKE ?' : '';
    const bindings = query ? [`%${query}%`] : [];
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM english_instructions ${where}`)
      .bind(...bindings).first<{ total: number }>();
    const rows = await env.DB.prepare(`
      SELECT id, text, translations, pronunciation, voice_id, audio
      FROM english_instructions
      ${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, size, offset).all<EnglishInstruction>();
    return successResponse(200, 'SUCCESS', rows.results.map(parseInstruction), origin, { page, size, total: count?.total ?? 0 });
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleGetEnglishInstruction(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const instruction = await findInstruction(env, id);
    if (!instruction) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy câu hướng dẫn', origin);
    return successResponse(200, 'SUCCESS', parseInstruction(instruction), origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCreateEnglishInstruction(request: Request, env: Env, origin: string): Promise<Response> {
  const input = await readInput(request, origin);
  if (isResponse(input)) return input;
  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO english_instructions (id, text, translations, pronunciation, voice_id)
    VALUES (?, ?, ?, ?, ?)
    `).bind(id, input.text, JSON.stringify(input.translations), input.pronunciation, input.voice_id).run();
    const instruction = await findInstruction(env, id);
    return successResponse(201, 'CREATED', instruction ? parseInstruction(instruction) : undefined, origin);
  } catch (error) {
    if (isUniqueConstraint(error)) return errorResponse(409, 'CONFLICT', 'Câu hướng dẫn với giọng đọc này đã tồn tại', origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateEnglishInstruction(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const input = await readInput(request, origin);
  if (isResponse(input)) return input;
  try {
    const existing = await findInstruction(env, id);
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy câu hướng dẫn', origin);
    const mustReplaceAudio = existing.text !== input.text
      || JSON.stringify(parseTranslations(existing.translations)) !== JSON.stringify(input.translations)
      || existing.pronunciation !== input.pronunciation
      || existing.voice_id !== input.voice_id;
    if (mustReplaceAudio) await deleteInstructionAudio(env, existing.audio);
    await env.DB.prepare(`
      UPDATE english_instructions
      SET text = ?, translations = ?, pronunciation = ?, voice_id = ?, audio = ?
      WHERE id = ?
    `).bind(input.text, JSON.stringify(input.translations), input.pronunciation, input.voice_id, mustReplaceAudio ? null : existing.audio, id).run();
    const instruction = await findInstruction(env, id);
    return successResponse(200, 'UPDATED', instruction ? parseInstruction(instruction) : undefined, origin);
  } catch (error) {
    if (isUniqueConstraint(error)) return errorResponse(409, 'CONFLICT', 'Câu hướng dẫn với giọng đọc này đã tồn tại', origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteEnglishInstruction(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const existing = await findInstruction(env, id);
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy câu hướng dẫn', origin);
    await deleteInstructionAudio(env, existing.audio);
    const result = await env.DB.prepare('DELETE FROM english_instructions WHERE id = ?').bind(id).run();
    if (!result.meta.changes) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy câu hướng dẫn', origin);
    return successResponse(200, 'DELETED', undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}

export async function handleBatchDeleteEnglishInstructions(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string').map(id => id.trim()).filter(Boolean) : [];
  if (!ids.length) return errorResponse(400, 'VALIDATION_ERROR', 'Danh sách ids không được để trống', origin);
  try {
    const placeholders = ids.map(() => '?').join(', ');
    const existing = await env.DB.prepare(`
      SELECT id, text, translations, pronunciation, voice_id, audio
      FROM english_instructions
      WHERE id IN (${placeholders})
    `).bind(...ids).all<EnglishInstruction>();
    await Promise.all(existing.results.map(instruction => deleteInstructionAudio(env, instruction.audio)));
    const result = await env.DB.prepare(`DELETE FROM english_instructions WHERE id IN (${placeholders})`).bind(...ids).run();
    return successResponse(200, 'DELETED', { count: result.meta.changes }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
