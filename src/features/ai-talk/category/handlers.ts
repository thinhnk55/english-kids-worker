import type { AiTalkCategory } from '../../../types/ai-talk.ts';
import { errorResponse, successResponse } from '../../../utils/response.ts';

export async function handleListCategories(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const parentCode = url.searchParams.get('parent_code');

  let query = 'SELECT * FROM ai_talk_categories';
  const params: unknown[] = [];

  if (parentCode !== null) {
    if (parentCode === 'root' || parentCode === '') {
      query += ' WHERE parent_code IS NULL';
    } else {
      query += ' WHERE parent_code = ?';
      params.push(parentCode);
    }
  }

  query += ' ORDER BY position ASC, code ASC';

  const result = await env.DB.prepare(query).bind(...params).all<AiTalkCategory>();
  return successResponse(200, 'SUCCESS', result.results || [], origin);
}

export async function handleGetCategory(
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM ai_talk_categories WHERE code = ?')
    .bind(code)
    .first<AiTalkCategory>();

  if (!row) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy danh mục', origin);
  }

  return successResponse(200, 'SUCCESS', row, origin);
}

export async function handleCreateCategory(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as Partial<AiTalkCategory> | null;

  if (!body || !body.code || !body.name) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Mã (code) và tên (name) danh mục là bắt buộc', origin);
  }

  const code = body.code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const name = body.name.trim();
  const parentCode = body.parent_code ? body.parent_code.trim() : null;
  const position = Number(body.position) || 0;

  const existing = await env.DB.prepare('SELECT code FROM ai_talk_categories WHERE code = ?')
    .bind(code)
    .first();

  if (existing) {
    return errorResponse(409, 'CONFLICT', 'Mã danh mục đã tồn tại', origin);
  }

  if (parentCode) {
    const parent = await env.DB.prepare('SELECT code FROM ai_talk_categories WHERE code = ?')
      .bind(parentCode)
      .first();
    if (!parent) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Danh mục cha không tồn tại', origin);
    }
  }

  const created = await env.DB.prepare(
    `INSERT INTO ai_talk_categories (code, parent_code, name, position)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
  )
    .bind(code, parentCode, name, position)
    .first<AiTalkCategory>();

  return successResponse(201, 'CREATED', created, origin);
}

export async function handleUpdateCategory(
  request: Request,
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as Partial<AiTalkCategory> | null;

  const existing = await env.DB.prepare('SELECT * FROM ai_talk_categories WHERE code = ?')
    .bind(code)
    .first<AiTalkCategory>();

  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy danh mục', origin);
  }

  const name = body?.name ? body.name.trim() : existing.name;
  let parentCode = existing.parent_code;
  if (body?.parent_code !== undefined) {
    parentCode = body.parent_code ? body.parent_code.trim() : null;
  }
  const position = body?.position !== undefined ? Number(body.position) || 0 : existing.position;

  if (parentCode && parentCode === code) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Danh mục cha không thể là chính nó', origin);
  }

  if (parentCode) {
    const parent = await env.DB.prepare('SELECT code FROM ai_talk_categories WHERE code = ?')
      .bind(parentCode)
      .first();
    if (!parent) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Danh mục cha không tồn tại', origin);
    }
  }

  const updated = await env.DB.prepare(
    `UPDATE ai_talk_categories
     SET name = ?, parent_code = ?, position = ?
     WHERE code = ?
     RETURNING *`,
  )
    .bind(name, parentCode, position, code)
    .first<AiTalkCategory>();

  return successResponse(200, 'SUCCESS', updated, origin);
}

export async function handleDeleteCategory(
  code: string,
  env: Env,
  origin: string,
): Promise<Response> {
  // Kiểm tra xem có kịch bản hoặc danh mục con nào đang tham chiếu không
  const childCategory = await env.DB.prepare('SELECT code FROM ai_talk_categories WHERE parent_code = ? LIMIT 1')
    .bind(code)
    .first();

  if (childCategory) {
    return errorResponse(400, 'HAS_CHILDREN', 'Không thể xóa danh mục đang chứa danh mục con', origin);
  }

  const attachedScenario = await env.DB.prepare('SELECT code FROM ai_talk_scenarios WHERE category = ? LIMIT 1')
    .bind(code)
    .first();

  if (attachedScenario) {
    return errorResponse(400, 'HAS_SCENARIOS', 'Không thể xóa danh mục đang có kịch bản sử dụng', origin);
  }

  const res = await env.DB.prepare('DELETE FROM ai_talk_categories WHERE code = ?')
    .bind(code)
    .run();

  if (!res.meta.changes) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy danh mục', origin);
  }

  return successResponse(200, 'DELETED', undefined, origin);
}
