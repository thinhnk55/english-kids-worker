import type { EnglishKidsProfile } from '../../types/profile.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleListProfiles(
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT * FROM english_kids_profile WHERE user_id = ? ORDER BY position ASC, id ASC',
  )
    .bind(userId)
    .all<EnglishKidsProfile>();

  return successResponse(200, 'SUCCESS', result.results ?? [], origin);
}

export async function handleCreateProfile(
  request: Request,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    name?: string;
    avatar?: string;
    birth_year?: number;
    gender?: string;
    position?: number;
  } | null;

  if (!body || !body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Tên hồ sơ không được để trống', origin);
  }

  const name = body.name.trim();
  const avatar = body.avatar?.trim() || null;
  const birthYear = typeof body.birth_year === 'number' ? body.birth_year : null;
  const gender = body.gender?.trim() || null;
  const position = typeof body.position === 'number' ? body.position : 0;
  const now = Math.floor(Date.now() / 1000);

  const insert = await env.DB.prepare(
    `INSERT INTO english_kids_profile (user_id, name, avatar, birth_year, gender, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  )
    .bind(userId, name, avatar, birthYear, gender, position, now, now)
    .first<EnglishKidsProfile>();

  return successResponse(201, 'CREATED', insert, origin);
}

export async function handleUpdateProfile(
  request: Request,
  profileId: number,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT * FROM english_kids_profile WHERE id = ? AND user_id = ?',
  )
    .bind(profileId, userId)
    .first<EnglishKidsProfile>();

  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  const body = await request.json().catch(() => null) as {
    name?: string;
    avatar?: string;
    birth_year?: number;
    gender?: string;
    position?: number;
  } | null;

  if (!body) {
    return errorResponse(400, 'BAD_REQUEST', undefined, origin);
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
  const avatar = body.avatar !== undefined ? (body.avatar?.trim() || null) : existing.avatar;
  const birthYear = body.birth_year !== undefined ? (typeof body.birth_year === 'number' ? body.birth_year : null) : existing.birth_year;
  const gender = body.gender !== undefined ? (body.gender?.trim() || null) : existing.gender;
  const position = typeof body.position === 'number' ? body.position : existing.position;
  const now = Math.floor(Date.now() / 1000);

  const updated = await env.DB.prepare(
    `UPDATE english_kids_profile
     SET name = ?, avatar = ?, birth_year = ?, gender = ?, position = ?, updated_at = ?
     WHERE id = ? AND user_id = ?
     RETURNING *`,
  )
    .bind(name, avatar, birthYear, gender, position, now, profileId, userId)
    .first<EnglishKidsProfile>();

  return successResponse(200, 'UPDATED', updated, origin);
}

export async function handleDeleteProfile(
  profileId: number,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM english_kids_profile WHERE id = ? AND user_id = ?',
  )
    .bind(profileId, userId)
    .run();

  if (!result.meta.changes) {
    return errorResponse(404, 'NOT_FOUND', undefined, origin);
  }

  return successResponse(200, 'DELETED', undefined, origin);
}
