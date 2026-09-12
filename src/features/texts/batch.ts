import { errorResponse, successResponse } from '../../utils/response.ts';

type JsonObject = Record<string, unknown>;

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export async function readBody(request: Request, origin: string): Promise<JsonObject | Response> {
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

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function handleBatchDeleteTexts(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;

  const sentenceIds = Array.isArray(body.text_ids)
    ? body.text_ids.map(id => typeof id === 'string' ? id.trim() : '').filter(Boolean)
    : Array.isArray(body.ids)
    ? body.ids.map(id => typeof id === 'string' ? id.trim() : '').filter(Boolean)
    : [];

  if (sentenceIds.length === 0 || sentenceIds.length > 200) {
    return errorResponse(400, 'VALIDATION_ERROR', 'text_ids/ids phải là mảng chứa từ 1 đến 200 id', origin);
  }

  try {
    const statements: D1PreparedStatement[] = [];
    for (const chunk of chunks(sentenceIds, 50)) {
      const placeholders = chunk.map(() => '?').join(', ');
      statements.push(env.DB.prepare(`DELETE FROM sentences WHERE id IN (${placeholders})`).bind(...chunk));
    }

    await env.DB.batch(statements);

    return successResponse(200, 'DELETED', {
      deleted_count: sentenceIds.length,
      text_ids: sentenceIds,
      ids: sentenceIds,
    }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleBatchAssignTerms(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;

  const rawIds = Array.isArray(body.text_ids) ? body.text_ids : Array.isArray(body.ids) ? body.ids : [];
  if (rawIds.length === 0 || rawIds.length > 200) {
    return errorResponse(400, 'VALIDATION_ERROR', 'text_ids/ids phải là mảng chứa từ 1 đến 200 id', origin);
  }

  if (!Array.isArray(body.term_ids)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'term_ids phải là mảng các term_id', origin);
  }

  const sentenceIds = Array.from(new Set(rawIds.map(id => typeof id === 'string' ? id.trim() : '').filter(Boolean)));
  const termIds = Array.from(new Set(body.term_ids.map(id => typeof id === 'string' ? id.trim() : '').filter(Boolean)));
  const mode = body.mode === 'replace' ? 'replace' : 'add';

  try {
    if (termIds.length > 0) {
      const termPlaceholders = termIds.map(() => '?').join(', ');
      const existingTerms = await env.DB.prepare(`SELECT id FROM taxonomy_terms WHERE id IN (${termPlaceholders})`).bind(...termIds).all<{ id: string }>();
      if (existingTerms.results.length !== termIds.length) {
        const found = new Set(existingTerms.results.map(r => r.id));
        return errorResponse(404, 'NOT_FOUND', { missing_term_ids: termIds.filter(id => !found.has(id)) }, origin);
      }
    }

    const statements: D1PreparedStatement[] = [];

    for (const sentenceId of sentenceIds) {
      if (mode === 'replace') {
        statements.push(env.DB.prepare('DELETE FROM sentence_terms WHERE sentence_id = ?').bind(sentenceId));
      }
      for (const termId of termIds) {
        statements.push(env.DB.prepare('INSERT OR IGNORE INTO sentence_terms (sentence_id, term_id) VALUES (?, ?)').bind(sentenceId, termId));
      }
    }

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    return successResponse(200, 'UPDATED', {
      processed_text_ids: sentenceIds,
      term_ids: termIds,
      mode,
    }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
