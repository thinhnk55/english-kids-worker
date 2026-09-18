export interface SentenceToken {
  text: string;
  phonemes: string | null;
}

function parseToken(value: unknown): SentenceToken | null {
  if (typeof value === 'string' && value.trim()) {
    return { text: value.trim(), phonemes: null };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const token = value as Record<string, unknown>;
  if (typeof token.text !== 'string' || !token.text.trim()) return null;
  return {
    text: token.text.trim(),
    phonemes: typeof token.phonemes === 'string' && token.phonemes.trim() ? token.phonemes.trim() : null,
  };
}

export function normalizeTokens(value: unknown, fallbackText: string): SentenceToken[] {
  const rawTokens = Array.isArray(value) ? value : fallbackText.split(/\s+/);
  return rawTokens.map(parseToken).filter((token): token is SentenceToken => token !== null);
}

export function parseTokens(value: string): SentenceToken[] {
  try {
    return normalizeTokens(JSON.parse(value), '');
  } catch {
    return [];
  }
}
