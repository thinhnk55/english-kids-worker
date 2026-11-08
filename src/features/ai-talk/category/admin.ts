import type { AiTalkCategory } from '../../../types/ai-talk.ts';
import { errorResponse, successResponse } from '../../../utils/response.ts';

export async function handleListAdminCategories(env: Env, origin: string): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT * FROM ai_talk_categories ORDER BY position ASC, code ASC',
  ).all<AiTalkCategory>();

  return successResponse(200, 'SUCCESS', result.results ?? [], origin);
}

export async function handleCreateAdminCategory(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    code?: string;
    parent_code?: string;
    name?: string;
    position?: number;
  } | null;

  if (!body || !body.code || !body.name) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Mã và tên danh mục là bắt buộc', origin);
  }

  const code = body.code.trim();
  const name = body.name.trim();
  const parentCode = body.parent_code?.trim() || null;
  const position = typeof body.position === 'number' ? body.position : 0;

  try {
    const inserted = await env.DB.prepare(
      `INSERT INTO ai_talk_categories (code, parent_code, name, position)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
      .bind(code, parentCode, name, position)
      .first<AiTalkCategory>();

    return successResponse(201, 'CREATED', inserted, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE') || message.includes('PRIMARY KEY')) {
      return errorResponse(409, 'CONFLICT', 'Mã danh mục đã tồn tại', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleUpdateAdminCategory(
  request: Request,
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    parent_code?: string;
    name?: string;
    position?: number;
  } | null;

  if (!body) {
    return errorResponse(400, 'BAD_REQUEST', undefined, origin);
  }

  const existing = await env.DB.prepare(
    'SELECT * FROM ai_talk_categories WHERE code = ?',
  )
    .bind(code)
    .first<AiTalkCategory>();

  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
  const parentCode = body.parent_code !== undefined ? (body.parent_code?.trim() || null) : existing.parent_code;
  const position = typeof body.position === 'number' ? body.position : existing.position;

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_categories
     SET parent_code = ?, name = ?, position = ?
     WHERE code = ?
     RETURNING *`,
  )
    .bind(parentCode, name, position, code)
    .first<AiTalkCategory>();

  return successResponse(200, 'UPDATED', updated, origin);
}

export async function handleDeleteAdminCategory(
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM ai_talk_categories WHERE code = ?',
  )
    .bind(code)
    .run();

  if (!result.meta.changes) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  return successResponse(200, 'DELETED', undefined, origin);
}
