import { successResponse } from '../../utils/response.ts';

export interface UserCreditsRow {
  user_id: number;
  credits: number;
  total_spent: number;
  updated_at: number;
}

export async function getUserCredits(env: Env, userId: number): Promise<{ credits: number; total_spent: number }> {
  const row = await env.DB.prepare('SELECT credits, total_spent FROM user_credits WHERE user_id = ?')
    .bind(userId)
    .first<UserCreditsRow>();

  if (row) {
    return {
      credits: row.credits,
      total_spent: row.total_spent,
    };
  }

  // Khởi tạo tài khoản mới với 50 credits tặng ban đầu
  const now = Math.floor(Date.now() / 1000);
  const initialCredits = 50;

  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT OR IGNORE INTO user_credits (user_id, credits, total_spent, updated_at) VALUES (?, ?, 0, ?)',
      ).bind(userId, initialCredits, now),
      env.DB.prepare(
        'INSERT INTO credit_transactions (user_id, amount, balance_after, reason, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(userId, initialCredits, initialCredits, 'welcome_bonus', now),
    ]);
  } catch (err) {
    console.error('[CREDIT-INIT-ERROR]', err);
  }

  const latest = await env.DB.prepare('SELECT credits, total_spent FROM user_credits WHERE user_id = ?')
    .bind(userId)
    .first<UserCreditsRow>();

  return {
    credits: latest?.credits ?? initialCredits,
    total_spent: latest?.total_spent ?? 0,
  };
}

export async function deductUserCredit(
  env: Env,
  userId: number,
  amount: number,
  reason: string,
  referenceId?: string | number,
): Promise<{ success: boolean; remainingCredits: number; message?: string }> {
  const current = await getUserCredits(env, userId);

  if (current.credits < amount) {
    return {
      success: false,
      remainingCredits: current.credits,
      message: 'Không đủ credit để thực hiện thao tác',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const refStr = referenceId ? String(referenceId) : null;

  const updateRes = await env.DB.prepare(
    'UPDATE user_credits SET credits = credits - ?, total_spent = total_spent + ?, updated_at = ? WHERE user_id = ? AND credits >= ? RETURNING credits',
  )
    .bind(amount, amount, now, userId, amount)
    .first<{ credits: number }>();

  if (!updateRes) {
    return {
      success: false,
      remainingCredits: current.credits,
      message: 'Trừ credit thất bại, vui lòng thử lại',
    };
  }

  const newBalance = updateRes.credits;

  // Ghi log giao dịch credit
  await env.DB.prepare(
    'INSERT INTO credit_transactions (user_id, amount, balance_after, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(userId, -amount, newBalance, reason, refStr, now)
    .run()
    .catch((err) => console.error('[CREDIT-TX-ERROR]', err));

  return {
    success: true,
    remainingCredits: newBalance,
  };
}

export async function handleGetMyCredits(
  userId: number,
  env: Env,
  origin: string,
): Promise<Response> {
  const result = await getUserCredits(env, userId);
  return successResponse(200, 'SUCCESS', result, origin);
}
