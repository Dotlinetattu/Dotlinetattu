const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64Url(new Uint8Array(signed));
}

function sameValue(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function createAdminSession() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured.');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `admin:${expiresAt}`;
  return { value: `${expiresAt}.${await signature(payload, secret)}`, expiresAt, maxAge: SESSION_MAX_AGE_SECONDS };
}

export async function verifyAdminSession(value: string | undefined) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !value) return false;
  const [expiry, receivedSignature, ...extra] = value.split('.');
  const expiresAt = Number(expiry);
  if (extra.length || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !receivedSignature) return false;
  const expectedSignature = await signature(`admin:${expiresAt}`, secret);
  return sameValue(receivedSignature, expectedSignature);
}
