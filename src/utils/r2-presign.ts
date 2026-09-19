const REGION = 'auto';
const SERVICE = 's3';
const EXPIRES_IN = 900;

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(parameters: Record<string, string>): string {
  return Object.entries(parameters)
    .map(([name, value]) => [encode(name), encode(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(value: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}

async function signingKey(secret: string, date: string): Promise<ArrayBuffer> {
  const dateKey = await hmac(new TextEncoder().encode(`AWS4${secret}`), date);
  const regionKey = await hmac(dateKey, REGION);
  const serviceKey = await hmac(regionKey, SERVICE);
  return hmac(serviceKey, 'aws4_request');
}

export async function createPresignedPutUrl(key: string, contentType: string, env: Env): Promise<{ uploadUrl: string; expiresIn: number } | null> {
  return createPresignedPutUrlForObject(`topics/${key}`, contentType, env);
}

export async function createPresignedPutUrlForObject(objectKey: string, contentType: string, env: Env): Promise<{ uploadUrl: string; expiresIn: number } | null> {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) return null;
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = `${date}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`;
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const path = `/${['english-kids-bucket', ...objectKey.split('/')].map(encode).join('/')}`;
  const credential = `${env.R2_ACCESS_KEY_ID}/${date}/${REGION}/${SERVICE}/aws4_request`;
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(EXPIRES_IN),
    'X-Amz-SignedHeaders': 'content-type;host',
  };
  const canonicalRequest = ['PUT', path, canonicalQuery(query), `content-type:${contentType}\nhost:${host}\n`, 'content-type;host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, `${date}/${REGION}/${SERVICE}/aws4_request`, await digest(canonicalRequest)].join('\n');
  const signature = hex(await hmac(await signingKey(env.R2_SECRET_ACCESS_KEY, date), stringToSign));
  return { uploadUrl: `https://${host}${path}?${canonicalQuery({ ...query, 'X-Amz-Signature': signature })}`, expiresIn: EXPIRES_IN };
}

export function topicImageKey(topicId: number): string {
  return `${topicId}/image.avif`;
}

export function topicImageUrl(env: Env, topicId: number): string {
  return `${env.ASSET_BASE_URL.replace(/\/$/u, '')}/topics/${topicImageKey(topicId)}`;
}

export function instructionAudioKey(instructionId: string, voiceId: string): string {
  return `instructions/${instructionId}/${voiceId}.opus`;
}

export function instructionAudioUrl(env: Env, instructionId: string, voiceId: string): string {
  return `${env.ASSET_BASE_URL.replace(/\/$/u, '')}/${instructionAudioKey(instructionId, voiceId)}`;
}

export function lexicalGroupImageKey(groupId: string): string {
  return `lexical-groups/${groupId}/image.avif`;
}

export function lexicalGroupAudioKey(groupId: string): string {
  return `lexical-groups/${groupId}/audio.opus`;
}

export function lexicalGroupImageUrl(env: Env, groupId: string): string {
  return `${env.ASSET_BASE_URL.replace(/\/$/u, '')}/${lexicalGroupImageKey(groupId)}`;
}

export function lexicalGroupAudioUrl(env: Env, groupId: string): string {
  return `${env.ASSET_BASE_URL.replace(/\/$/u, '')}/${lexicalGroupAudioKey(groupId)}`;
}

async function deleteAsset(env: Env, url: string | null): Promise<void> {
  if (!url || !env.ASSETS) return;
  const baseUrl = env.ASSET_BASE_URL.replace(/\/$/u, '');
  if (url.startsWith(`${baseUrl}/`)) await env.ASSETS.delete(url.slice(baseUrl.length + 1));
}

export async function deleteTopicImage(env: Env, url: string | null): Promise<void> {
  return deleteAsset(env, url);
}

export async function deleteInstructionAudio(env: Env, url: string | null, instructionId?: string, voiceId?: string): Promise<void> {
  if (!env.ASSETS) return;
  const keys = new Set<string>();
  const baseUrl = env.ASSET_BASE_URL.replace(/\/$/u, '');
  if (url?.startsWith(`${baseUrl}/`)) keys.add(url.slice(baseUrl.length + 1));
  if (instructionId && voiceId) keys.add(instructionAudioKey(instructionId, voiceId));
  await Promise.all([...keys].map(key => env.ASSETS.delete(key)));
}

export async function deleteLexicalGroupAssets(env: Env, groupId: string, image: string | null, audio: string | null): Promise<void> {
  if (!env.ASSETS) return;
  const baseUrl = env.ASSET_BASE_URL.replace(/\/$/u, '');
  const keys = new Set([lexicalGroupImageKey(groupId), lexicalGroupAudioKey(groupId)]);
  for (const url of [image, audio]) {
    if (url?.startsWith(`${baseUrl}/`)) keys.add(url.slice(baseUrl.length + 1));
  }
  await Promise.all([...keys].map(key => env.ASSETS.delete(key)));
}
