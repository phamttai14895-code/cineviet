/**
 * Xác minh Cloudflare Turnstile token (server-side).
 * POST https://challenges.cloudflare.com/turnstile/v0/siteverify
 */
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, remoteip = null) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret || !token || typeof token !== 'string') return false;
  const body = new URLSearchParams({ secret, response: token.trim() });
  if (remoteip) body.append('remoteip', remoteip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    return data?.success === true;
  } catch (err) {
    console.error('[Turnstile] verify error:', err?.message);
    return false;
  }
}

export function isTurnstileEnabled() {
  return !!(process.env.TURNSTILE_SECRET && process.env.TURNSTILE_SECRET.trim());
}
