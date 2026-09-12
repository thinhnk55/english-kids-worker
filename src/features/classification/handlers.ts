import { parsePagination } from '../../utils/pagination.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

type JsonObject = Record<string, unknown>;

export interface TaxonomyRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  translations: string;
  selection_mode: 'single' | 'multiple';
}

export interface TaxonomyTermRow {
  id: string;
  taxonomy_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  description: string;
  translations: string;
  position: number;
}

export interface TaxonomyInput {
  code: string;
  name: string;
  description: string | null;
  translations: Record<string, { name?: string; description?: string }>;
  selection_mode: 'single' | 'multiple';
}

export interface TermInput {
  parent_id: string | null;
  code: string;
  name: string;
  description: string;
  translations: Record<string, { name?: string; description?: string }>;
  position: number;
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function isConstraint(error: unknown): boolean {
  return error instanceof Error && /constraint|unique|foreign key/i.test(error.message);
}

function parseJsonObject(value: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as JsonObject : {};
  } catch {
    return {};
  }
}

export function parseTaxonomy(row: TaxonomyRow) {
  return { ...row, translations: parseJsonObject(row.translations) };
}

export function parseTerm(row: TaxonomyTermRow) {
  return { ...row, translations: parseJsonObject(row.translations) };
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

function readRequiredText(value: unknown, field: string, origin: string): string | Response {
  if (typeof value !== 'string' || !value.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', `${field} không được để trống`, origin);
  }
  return value.trim();
}

function readCode(value: unknown, origin: string): string | Response {
  const code = readRequiredText(value, 'code', origin);
  if (isResponse(code)) return code;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(code)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'code chỉ gồm chữ thường, số, dấu _ hoặc -', origin);
  }
  return code;
}

function readTranslations(value: unknown, origin: string): Record<string, { name?: string; description?: string }> | Response {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'translations phải là một JSON object', origin);
  }
  const translations: Record<string, { name?: string; description?: string }> = {};
  for (const [locale, rawTranslation] of Object.entries(value)) {
    if (!locale.trim() || typeof rawTranslation !== 'object' || rawTranslation === null || Array.isArray(rawTranslation)) {
      return errorResponse(400, 'VALIDATION_ERROR', `translations.${locale} không hợp lệ`, origin);
    }
    const translation = rawTranslation as JsonObject;
    if (translation.name !== undefined && typeof translation.name !== 'string') {
      return errorResponse(400, 'VALIDATION_ERROR', `translations.${locale}.name phải là chuỗi`, origin);
    }
    if (translation.description !== undefined && typeof translation.description !== 'string') {
      return errorResponse(400, 'VALIDATION_ERROR', `translations.${locale}.description phải là chuỗi`, origin);
    }
    translations[locale] = {
      ...(typeof translation.name === 'string' ? { name: translation.name.trim() } : {}),
      ...(typeof translation.description === 'string' ? { description: translation.description.trim() } : {}),
    };
  }
  return translations;
}

async function readTaxonomyInput(request: Request, origin: string): Promise<TaxonomyInput | Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;
  const code = readCode(body.code, origin);
  if (isResponse(code)) return code;
  const name = readRequiredText(body.name, 'name', origin);
  if (isResponse(name)) return name;
  const description = body.description === undefined || body.description === null
    ? null
    : typeof body.description === 'string' ? body.description.trim() || null : undefined;
  if (description === undefined) return errorResponse(400, 'VALIDATION_ERROR', 'description phải là chuỗi hoặc null', origin);
  const translations = readTranslations(body.translations, origin);
  if (isResponse(translations)) return translations;
  if (body.selection_mode !== 'single' && body.selection_mode !== 'multiple') {
    return errorResponse(400, 'VALIDATION_ERROR', 'selection_mode phải là single hoặc multiple', origin);
  }
  return { code, name, description, translations, selection_mode: body.selection_mode };
}

async function readTermInput(request: Request, origin: string): Promise<TermInput | Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;
  const code = readCode(body.code, origin);
  if (isResponse(code)) return code;
  const name = readRequiredText(body.name, 'name', origin);
  if (isResponse(name)) return name;
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const parentId = body.parent_id === undefined || body.parent_id === null
    ? null
    : typeof body.parent_id === 'string' && body.parent_id.trim() ? body.parent_id.trim() : undefined;
  if (parentId === undefined) return errorResponse(400, 'VALIDATION_ERROR', 'parent_id phải là chuỗi hoặc null', origin);
  const position = body.position === undefined ? 0 : body.position;
  if (!Number.isSafeInteger(position) || (position as number) < 0) {
    return errorResponse(400, 'VALIDATION_ERROR', 'position phải là số nguyên không âm', origin);
  }
  const translations = readTranslations(body.translations, origin);
  if (isResponse(translations)) return translations;
  return { parent_id: parentId, code, name, description, translations, position: position as number };
}

export async function getTaxonomy(env: Env, idOrCode: string): Promise<TaxonomyRow | null> {
  return env.DB.prepare(`
    SELECT id, code, name, description, translations, selection_mode
    FROM taxonomies
    WHERE id = ? OR code = ?
  `).bind(idOrCode, idOrCode).first<TaxonomyRow>();
}

export async function getTerm(env: Env, idOrCode: string): Promise<TaxonomyTermRow | null> {
  return env.DB.prepare(`
    SELECT id, taxonomy_id, parent_id, code, name, description, translations, position
    FROM taxonomy_terms
    WHERE id = ? OR code = ?
  `).bind(idOrCode, idOrCode).first<TaxonomyTermRow>();
}

export async function handleGetTerm(env: Env, origin: string, idOrCode: string): Promise<Response> {
  try {
    const term = await getTerm(env, idOrCode);
    if (!term) return errorResponse(404, 'NOT_FOUND', 'Term không tồn tại', origin);
    return successResponse(200, 'SUCCESS', parseTerm(term), origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleGetTaxonomyTerms(env: Env, origin: string, taxonomyIdOrCode: string): Promise<Response> {
  try {
    const taxonomy = await getTaxonomy(env, taxonomyIdOrCode);
    if (!taxonomy) return errorResponse(404, 'NOT_FOUND', 'Taxonomy không tồn tại', origin);
    const terms = await env.DB.prepare(`
      SELECT id, taxonomy_id, parent_id, code, name, description, translations, position
      FROM taxonomy_terms
      WHERE taxonomy_id = ?
      ORDER BY position ASC, id ASC
    `).bind(taxonomy.id).all<TaxonomyTermRow>();
    return successResponse(200, 'SUCCESS', terms.results.map(parseTerm), origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleListTaxonomies(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { page, size, offset } = parsePagination(url);
    const [count, rows] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS total FROM taxonomies').first<{ total: number }>(),
      env.DB.prepare(`
        SELECT id, code, name, description, translations, selection_mode
        FROM taxonomies
        ORDER BY name ASC, id ASC
        LIMIT ? OFFSET ?
      `).bind(size, offset).all<TaxonomyRow>(),
    ]);
    const data = await Promise.all(rows.results.map(async taxonomy => {
      const terms = await env.DB.prepare(`
        SELECT id, taxonomy_id, parent_id, code, name, description, translations, position
        FROM taxonomy_terms
        WHERE taxonomy_id = ?
        ORDER BY position ASC, id ASC
      `).bind(taxonomy.id).all<TaxonomyTermRow>();
      return { ...parseTaxonomy(taxonomy), terms: terms.results.map(parseTerm) };
    }));
    return successResponse(200, 'SUCCESS', data, origin, { page, size, total: count?.total ?? 0 });
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleGetTaxonomy(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const taxonomy = await getTaxonomy(env, id);
    if (!taxonomy) return errorResponse(404, 'NOT_FOUND', undefined, origin);
    const terms = await env.DB.prepare(`
      SELECT id, taxonomy_id, parent_id, code, name, description, translations, position
      FROM taxonomy_terms
      WHERE taxonomy_id = ?
      ORDER BY position ASC, id ASC
    `).bind(taxonomy.id).all<TaxonomyTermRow>();
    return successResponse(200, 'SUCCESS', { ...parseTaxonomy(taxonomy), terms: terms.results.map(parseTerm) }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCreateTaxonomy(request: Request, env: Env, origin: string): Promise<Response> {
  const input = await readTaxonomyInput(request, origin);
  if (isResponse(input)) return input;
  const id = generateUUIDv7();
  try {
    await env.DB.prepare(`
      INSERT INTO taxonomies (id, code, name, description, translations, selection_mode)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, input.code, input.name, input.description, JSON.stringify(input.translations), input.selection_mode).run();
    const taxonomy = await getTaxonomy(env, id);
    return successResponse(201, 'CREATED', taxonomy ? parseTaxonomy(taxonomy) : undefined, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', 'code taxonomy đã tồn tại hoặc dữ liệu không hợp lệ', origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateTaxonomy(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const input = await readTaxonomyInput(request, origin);
  if (isResponse(input)) return input;
  try {
    const existing = await getTaxonomy(env, id);
    if (!existing) return errorResponse(404, 'NOT_FOUND', undefined, origin);
    if (input.selection_mode === 'single') {
      const conflict = await env.DB.prepare(`
        SELECT assigned.sentence_id
        FROM sentence_terms assigned
        JOIN taxonomy_terms term ON term.id = assigned.term_id
        WHERE term.taxonomy_id = ?
        GROUP BY assigned.sentence_id
        HAVING COUNT(*) > 1
        LIMIT 1
      `).bind(existing.id).first<{ sentence_id: string }>();
      if (conflict) {
        return errorResponse(409, 'CONFLICT', `Sentence ${conflict.sentence_id} đang có nhiều term; chưa thể đổi taxonomy sang single`, origin);
      }
    }
    await env.DB.prepare(`
      UPDATE taxonomies
      SET code = ?, name = ?, description = ?, translations = ?, selection_mode = ?
      WHERE id = ?
    `).bind(input.code, input.name, input.description, JSON.stringify(input.translations), input.selection_mode, existing.id).run();
    const taxonomy = await getTaxonomy(env, existing.id);
    return successResponse(200, 'UPDATED', taxonomy ? parseTaxonomy(taxonomy) : undefined, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', error instanceof Error ? error.message : undefined, origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteTaxonomy(env: Env, origin: string, id: string): Promise<Response> {
  try {
    const existing = await getTaxonomy(env, id);
    if (!existing) return errorResponse(404, 'NOT_FOUND', undefined, origin);
    await env.DB.prepare('DELETE FROM taxonomies WHERE id = ?').bind(existing.id).run();
    return successResponse(200, 'DELETED', undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCreateTaxonomyTerm(request: Request, env: Env, origin: string, pathTaxonomyId?: string): Promise<Response> {
  const body = await readBody(request, origin);
  if (isResponse(body)) return body;

  const taxonomyId = pathTaxonomyId || (typeof body.taxonomy_id === 'string' ? body.taxonomy_id.trim() : '');
  if (!taxonomyId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'taxonomy_id không được để trống', origin);
  }

  const code = readCode(body.code, origin);
  if (isResponse(code)) return code;
  const name = readRequiredText(body.name, 'name', origin);
  if (isResponse(name)) return name;
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const parentId = body.parent_id === undefined || body.parent_id === null
    ? null
    : typeof body.parent_id === 'string' && body.parent_id.trim() ? body.parent_id.trim() : undefined;
  if (parentId === undefined) return errorResponse(400, 'VALIDATION_ERROR', 'parent_id phải là chuỗi hoặc null', origin);
  const position = body.position === undefined ? 0 : body.position;
  if (!Number.isSafeInteger(position) || (position as number) < 0) {
    return errorResponse(400, 'VALIDATION_ERROR', 'position phải là số nguyên không âm', origin);
  }
  const translations = readTranslations(body.translations, origin);
  if (isResponse(translations)) return translations;

  const id = generateUUIDv7();
  try {
    const taxonomy = await getTaxonomy(env, taxonomyId);
    if (!taxonomy) return errorResponse(404, 'NOT_FOUND', 'Taxonomy không tồn tại', origin);
    await env.DB.prepare(`
      INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, description, translations, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      taxonomy.id,
      parentId,
      code,
      name,
      description,
      JSON.stringify(translations),
      position as number,
    ).run();
    const term = await getTerm(env, id);
    return successResponse(201, 'CREATED', term ? parseTerm(term) : undefined, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', 'Term bị trùng hoặc parent_id không thuộc taxonomy', origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleUpdateTaxonomyTerm(request: Request, env: Env, origin: string, id: string): Promise<Response> {
  const input = await readTermInput(request, origin);
  if (isResponse(input)) return input;
  try {
    const existing = await getTerm(env, id);
    if (!existing) return errorResponse(404, 'NOT_FOUND', undefined, origin);
    if (input.parent_id) {
      const invalidParent = await env.DB.prepare(`
        WITH RECURSIVE descendants(id) AS (
          SELECT id FROM taxonomy_terms WHERE id = ?
          UNION ALL
          SELECT child.id
          FROM taxonomy_terms child
          JOIN descendants parent ON child.parent_id = parent.id
        )
        SELECT id FROM descendants WHERE id = ?
      `).bind(id, input.parent_id).first<{ id: string }>();
      if (invalidParent) {
        return errorResponse(409, 'CONFLICT', 'parent_id không thể là chính term hoặc một term con của nó', origin);
      }
    }
    await env.DB.prepare(`
      UPDATE taxonomy_terms
      SET parent_id = ?, code = ?, name = ?, description = ?, translations = ?, position = ?
      WHERE id = ?
    `).bind(
      input.parent_id,
      input.code,
      input.name,
      input.description,
      JSON.stringify(input.translations),
      input.position,
      id,
    ).run();
    const term = await getTerm(env, id);
    return successResponse(200, 'UPDATED', term ? parseTerm(term) : undefined, origin);
  } catch (error) {
    if (isConstraint(error)) return errorResponse(409, 'CONFLICT', error instanceof Error ? error.message : undefined, origin);
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleDeleteTaxonomyTerm(env: Env, origin: string, id: string): Promise<Response> {
  try {
    if (!await getTerm(env, id)) return errorResponse(404, 'NOT_FOUND', undefined, origin);
    await env.DB.prepare('DELETE FROM taxonomy_terms WHERE id = ?').bind(id).run();
    return successResponse(200, 'DELETED', undefined, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
