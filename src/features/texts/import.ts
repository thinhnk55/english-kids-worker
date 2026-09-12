import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

const MAX_JSON_BYTES = 2_000_000;
const MAX_BATCH_TEXTS = 500;
const MAX_BATCH_STATEMENTS = 1_000;

type JsonObject = Record<string, unknown>;

export interface ImportMediaAudio {
  id?: string;
  voice: string;
  url: string;
}

export interface ImportMedia {
  url: string;
  id?: string;
}

export interface ImportLexicalMapping {
  mapping_id?: string;
  lexical_id?: string;
  lexical_text?: string;
  token_indexes: number[];
  display_order?: number;
}

export interface ImportTextItem {
  id: string;
  text: string;
  phonemes: string | null;
  tokens: string[];
  translations: Record<string, string>;
  audios: ImportMediaAudio[];
  images: ImportMedia[];
  videos: ImportMedia[];
  lexicals: ImportLexicalMapping[];
}

export interface BatchImportPayload {
  items: ImportTextItem[];
  strategy: 'create' | 'upsert';
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function objectValue(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : null;
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseTranslations(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const res: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') res[k] = v.trim();
  }
  return res;
}

export function parseImportPayload(raw: unknown, origin: string): BatchImportPayload | Response {
  const body = objectValue(raw);
  if (!body) return errorResponse(400, 'VALIDATION_ERROR', 'Payload phải là JSON object', origin);

  const rawItems = Array.isArray(body.items) ? body.items : Array.isArray(raw) ? raw : null;
  if (!rawItems || rawItems.length === 0) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Payload cần chứa danh sách items', origin);
  }
  if (rawItems.length > MAX_BATCH_TEXTS) {
    return errorResponse(400, 'VALIDATION_ERROR', `Mỗi đợt import chỉ được tối đa ${MAX_BATCH_TEXTS} phần tử`, origin);
  }

  const strategy = body.strategy === 'create' ? 'create' : 'upsert';
  const items: ImportTextItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const itemObj = objectValue(rawItems[i]);
    if (!itemObj) return errorResponse(400, 'VALIDATION_ERROR', `Item thứ ${i + 1} không phải là object`, origin);

    const textStr = cleanText(itemObj.text);
    if (!textStr) return errorResponse(400, 'VALIDATION_ERROR', `Item thứ ${i + 1} thiếu text`, origin);

    const id = cleanText(itemObj.id) ?? generateUUIDv7();
    const phonemes = cleanText(itemObj.phonemes);

    let tokens: string[];
    if (Array.isArray(itemObj.tokens)) {
      tokens = itemObj.tokens.map(t => String(t).trim()).filter(Boolean);
    } else {
      tokens = textStr.split(/\s+/).filter(Boolean);
    }

    const translations = parseTranslations(itemObj.translations);

    // Media
    const mediaObj = objectValue(itemObj.media) ?? itemObj;
    const audios: ImportMediaAudio[] = [];
    if (Array.isArray(mediaObj.audios)) {
      for (const a of mediaObj.audios) {
        const aObj = objectValue(a);
        const url = cleanText(aObj?.url);
        if (url) audios.push({ id: cleanText(aObj?.id) ?? generateUUIDv7(), voice: cleanText(aObj?.voice) ?? 'default', url });
      }
    }

    const images: ImportMedia[] = [];
    if (Array.isArray(mediaObj.images)) {
      for (const img of mediaObj.images) {
        const imgObj = objectValue(img);
        const url = cleanText(imgObj?.url);
        if (url) images.push({ id: cleanText(imgObj?.id) ?? generateUUIDv7(), url });
      }
    }

    const videos: ImportMedia[] = [];
    if (Array.isArray(mediaObj.videos)) {
      for (const v of mediaObj.videos) {
        const vObj = objectValue(v);
        const url = cleanText(vObj?.url);
        if (url) videos.push({ id: cleanText(vObj?.id) ?? generateUUIDv7(), url });
      }
    }

    // Mappings
    const lexicals: ImportLexicalMapping[] = [];
    if (Array.isArray(itemObj.lexicals)) {
      for (const l of itemObj.lexicals) {
        const lObj = objectValue(l);
        if (lObj) {
          const tokenIndexes = Array.isArray(lObj.token_indexes)
            ? lObj.token_indexes.map(idx => Number(idx)).filter(idx => Number.isInteger(idx) && idx >= 0)
            : [];
          if (tokenIndexes.length > 0) {
            lexicals.push({
              mapping_id: cleanText(lObj.mapping_id) ?? generateUUIDv7(),
              lexical_id: cleanText(lObj.lexical_id) ?? undefined,
              lexical_text: cleanText(lObj.lexical_text) ?? undefined,
              token_indexes: tokenIndexes,
              display_order: Number.isInteger(lObj.display_order) ? Number(lObj.display_order) : 0,
            });
          }
        }
      }
    }

    items.push({
      id,
      text: textStr,
      phonemes,
      tokens,
      translations,
      audios,
      images,
      videos,
      lexicals,
    });
  }

  return { items, strategy };
}

export async function handlePreviewBatchImport(request: Request, env: Env, origin: string): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    return errorResponse(413, 'VALIDATION_ERROR', 'Payload import vượt quá 2 MB', origin);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin);
  }

  const parsed = parseImportPayload(rawBody, origin);
  if (isResponse(parsed)) return parsed;

  try {
    const errors: string[] = [];
    const warnings: string[] = [];

    const itemIds = parsed.items.map(item => item.id);
    if (new Set(itemIds).size !== itemIds.length) {
      errors.push('Dữ liệu chứa các sentence id bị lặp lại trong cùng payload');
    }

    const placeholders = itemIds.map(() => '?').join(', ');
    const existingRows = await env.DB.prepare(`SELECT id FROM sentences WHERE id IN (${placeholders})`).bind(...itemIds).all<{ id: string }>();
    const existingSet = new Set(existingRows.results.map(r => r.id));

    if (parsed.strategy === 'create') {
      for (const id of itemIds) {
        if (existingSet.has(id)) errors.push(`Sentence ID ${id} đã tồn tại trong hệ thống (dùng strategy upsert nếu muốn ghi đè)`);
      }
    }

    const estimatedStatements = parsed.items.length * 4;
    if (estimatedStatements > MAX_BATCH_STATEMENTS) {
      errors.push(`Số lượng câu lệnh batch vượt quá giới hạn ${MAX_BATCH_STATEMENTS}`);
    }

    return successResponse(errors.length > 0 ? 422 : 200, errors.length > 0 ? 'VALIDATION_ERROR' : 'SUCCESS', {
      strategy: parsed.strategy,
      ready: errors.length === 0,
      total_items: parsed.items.length,
      existing_items_count: existingSet.size,
      errors,
      warnings,
      items: parsed.items,
    }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}

export async function handleCommitBatchImport(request: Request, env: Env, origin: string): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    return errorResponse(413, 'VALIDATION_ERROR', 'Payload import vượt quá 2 MB', origin);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Định dạng JSON không hợp lệ', origin);
  }

  const parsed = parseImportPayload(rawBody, origin);
  if (isResponse(parsed)) return parsed;

  try {
    const statements: D1PreparedStatement[] = [];

    for (const item of parsed.items) {
      // 1. Sentence statement
      const textSql = parsed.strategy === 'upsert'
        ? `INSERT INTO sentences (id, text, phonemes, tokens, translations) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET text = excluded.text, phonemes = excluded.phonemes, tokens = excluded.tokens, translations = excluded.translations`
        : `INSERT INTO sentences (id, text, phonemes, tokens, translations) VALUES (?, ?, ?, ?, ?)`;

      statements.push(env.DB.prepare(textSql).bind(
        item.id,
        item.text,
        item.phonemes,
        JSON.stringify(item.tokens),
        JSON.stringify(item.translations),
      ));

      // 2. Media statements
      if (item.audios.length > 0) {
        statements.push(env.DB.prepare('DELETE FROM sentence_audio WHERE sentence_id = ?').bind(item.id));
        for (const audio of item.audios) {
          statements.push(env.DB.prepare('INSERT INTO sentence_audio (id, sentence_id, voice, url) VALUES (?, ?, ?, ?)').bind(audio.id ?? generateUUIDv7(), item.id, audio.voice, audio.url));
        }
      }

      if (item.images.length > 0) {
        statements.push(env.DB.prepare('DELETE FROM sentence_image WHERE sentence_id = ?').bind(item.id));
        for (const img of item.images) {
          statements.push(env.DB.prepare('INSERT INTO sentence_image (id, sentence_id, url) VALUES (?, ?, ?)').bind(img.id ?? generateUUIDv7(), item.id, img.url));
        }
      }

      if (item.videos.length > 0) {
        statements.push(env.DB.prepare('DELETE FROM sentence_video WHERE sentence_id = ?').bind(item.id));
        for (const vid of item.videos) {
          statements.push(env.DB.prepare('INSERT INTO sentence_video (id, sentence_id, url) VALUES (?, ?, ?)').bind(vid.id ?? generateUUIDv7(), item.id, vid.url));
        }
      }

      // 3. Mappings
      if (item.lexicals.length > 0) {
        statements.push(env.DB.prepare('DELETE FROM sentence_lexicals WHERE sentence_id = ?').bind(item.id));
        for (const lex of item.lexicals) {
          if (lex.lexical_id) {
            statements.push(env.DB.prepare(`
              INSERT INTO sentence_lexicals (id, sentence_id, lexical_id, position, token_indexes)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(sentence_id, lexical_id, token_indexes) DO UPDATE SET position = excluded.position
            `).bind(lex.mapping_id ?? generateUUIDv7(), item.id, lex.lexical_id, lex.display_order ?? 0, JSON.stringify(lex.token_indexes)));
          }
        }
      }
    }

    if (statements.length > MAX_BATCH_STATEMENTS) {
      return errorResponse(413, 'VALIDATION_ERROR', `Batch chứa ${statements.length} câu lệnh vượt quá giới hạn ${MAX_BATCH_STATEMENTS}`, origin);
    }

    await env.DB.batch(statements);

    return successResponse(200, 'SUCCESS', {
      imported_count: parsed.items.length,
      strategy: parsed.strategy,
      total_statements: statements.length,
    }, origin);
  } catch (error) {
    return errorResponse(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined, origin);
  }
}
