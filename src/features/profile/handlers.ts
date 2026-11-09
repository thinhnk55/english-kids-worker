import type { EnglishKidsParent, EnglishKidsProfile } from '../../types/profile.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';

// ── Parent APIs ─────────────────────────────────────────────────────────────

export async function handleGetParent(
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  let parent = await env.DB.prepare(
    'SELECT * FROM parent WHERE user_id = ?',
  )
    .bind(userId)
    .first<EnglishKidsParent>();

  const now = Math.floor(Date.now() / 1000);

  if (!parent) {
    // Tự động khởi tạo cấu hình phụ huynh mặc định nếu chưa có (mặc định 5 profile)
    parent = await env.DB.prepare(
      `INSERT INTO parent (user_id, default_profile, max_profiles, created_at, updated_at)
       VALUES (?, NULL, 5, ?, ?)
       RETURNING *`,
    )
      .bind(userId, now, now)
      .first<EnglishKidsParent>();
  }

  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM english_kids_profile WHERE user_id = ?',
  )
    .bind(userId)
    .first<{ count: number }>();

  return successResponse(
    200,
    'SUCCESS',
    {
      user_id: userId,
      default_profile: parent?.default_profile ?? null,
      max_profiles: parent?.max_profiles ?? 5,
      profiles_count: countRow?.count ?? 0,
      created_at: parent?.created_at ?? now,
      updated_at: parent?.updated_at ?? now,
    },
    origin,
  );
}

export async function handleSetDefaultProfile(
  request: Request,
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    profile_id?: number | null;
  } | null;

  if (!body) {
    return errorResponse(400, 'BAD_REQUEST', 'Dữ liệu không hợp lệ', origin);
  }

  const profileId = typeof body.profile_id === 'number' ? body.profile_id : null;
  const now = Math.floor(Date.now() / 1000);

  if (profileId !== null) {
    // Kiểm tra profile có thuộc về user_id này không
    const profile = await env.DB.prepare(
      'SELECT id FROM english_kids_profile WHERE id = ? AND user_id = ?',
    )
      .bind(profileId, userId)
      .first<{ id: number }>();

    if (!profile) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ người học', origin);
    }
  }

  await env.DB.prepare(
    `INSERT INTO parent (user_id, default_profile, max_profiles, created_at, updated_at)
     VALUES (?, ?, 5, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       default_profile = excluded.default_profile,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, profileId, now, now)
    .run();

  return successResponse(200, 'SUCCESS', { default_profile: profileId }, origin);
}

// ── Profiles APIs ───────────────────────────────────────────────────────────

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
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    avatar?: string;
    birth_year?: number;
    gender?: string;
    position?: number;
  } | null;

  if (!body || !body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Tên hồ sơ không được để trống', origin);
  }

  // 1. Kiểm tra giới hạn số lượng hồ sơ từ bảng parent (mặc định 5)
  const parent = await env.DB.prepare(
    'SELECT default_profile, max_profiles FROM parent WHERE user_id = ?',
  )
    .bind(userId)
    .first<{ default_profile: number | null; max_profiles: number }>();

  const maxProfiles = parent?.max_profiles ?? 5;

  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM english_kids_profile WHERE user_id = ?',
  )
    .bind(userId)
    .first<{ count: number }>();

  const currentCount = countRow?.count ?? 0;
  if (currentCount >= maxProfiles) {
    return errorResponse(
      400,
      'MAX_PROFILES_EXCEEDED',
      `Tài khoản đã đạt giới hạn tối đa ${maxProfiles} hồ sơ cho phép`,
      origin,
    );
  }

  // 2. Thêm mới hồ sơ
  const name = body.name.trim();
  const avatar = body.avatar?.trim() || null;
  const birthYear = typeof body.birth_year === 'number' ? body.birth_year : null;
  const gender = body.gender?.trim() || null;
  const position = typeof body.position === 'number' ? body.position : currentCount;
  const now = Math.floor(Date.now() / 1000);

  const insert = await env.DB.prepare(
    `INSERT INTO english_kids_profile (user_id, name, avatar, birth_year, gender, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  )
    .bind(userId, name, avatar, birthYear, gender, position, now, now)
    .first<EnglishKidsProfile>();

  // 3. Nếu chưa có default_profile, tự động gán hồ sơ đầu tiên này làm mặc định
  if (insert && (!parent || parent.default_profile === null)) {
    await env.DB.prepare(
      `INSERT INTO parent (user_id, default_profile, max_profiles, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         default_profile = COALESCE(default_profile, excluded.default_profile),
         updated_at = excluded.updated_at`,
    )
      .bind(userId, insert.id, maxProfiles, now, now)
      .run();
  }

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

  const body = (await request.json().catch(() => null)) as {
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
  const avatar = body.avatar !== undefined ? body.avatar?.trim() || null : existing.avatar;
  const birthYear =
    body.birth_year !== undefined
      ? typeof body.birth_year === 'number'
        ? body.birth_year
        : null
      : existing.birth_year;
  const gender = body.gender !== undefined ? body.gender?.trim() || null : existing.gender;
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

  const now = Math.floor(Date.now() / 1000);

  // Nếu xóa trúng default_profile, cập nhật sang profile khác hoặc set NULL
  const remaining = await env.DB.prepare(
    'SELECT id FROM english_kids_profile WHERE user_id = ? ORDER BY position ASC, id ASC LIMIT 1',
  )
    .bind(userId)
    .first<{ id: number }>();

  await env.DB.prepare(
    `UPDATE parent
     SET default_profile = ?, updated_at = ?
     WHERE user_id = ? AND default_profile = ?`,
  )
    .bind(remaining?.id ?? null, now, userId, profileId)
    .run();

  return successResponse(200, 'DELETED', undefined, origin);
}
