import type { Env, Subscriber } from '../../lib/types';
import { generateToken, hashIP } from '../../lib/crypto';
import { checkRateLimit } from '../../lib/rate-limit';
import { sendEmail, confirmationEmail } from '../../lib/email';

interface CFPagesContext {
  request: Request;
  env: Env;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const siteUrl = env.SITE_URL || 'https://solarpilled.com';
  const address = env.CANSPAM_ADDRESS || 'solarpilled.com';

  // Parse form data or JSON
  let email: string;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await request.json<{ email: string }>();
    email = body.email?.trim().toLowerCase();
  } else {
    const formData = await request.formData();
    email = (formData.get('email') as string)?.trim().toLowerCase();
  }

  // Validate email
  if (!email || !isValidEmail(email)) {
    return jsonResponse({ error: 'Please provide a valid email address.' }, 400);
  }

  // Rate limit by IP
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipHash = await hashIP(ip);

  const allowed = await checkRateLimit(env, `signup:${ipHash}`);
  if (!allowed) {
    return jsonResponse({ error: 'Too many signup attempts. Please try again later.' }, 429);
  }

  // Check if subscriber already exists
  const existing = await env.DB.prepare(
    `SELECT id, status, confirm_token, unsubscribe_token FROM subscribers WHERE email = ?`
  ).bind(email).first<Subscriber>();

  if (existing) {
    if (existing.status === 'confirmed') {
      // Already subscribed — don't leak this info, just show success
      return jsonResponse({ success: true, message: 'Check your email to confirm your subscription.' });
    }

    if (existing.status === 'pending') {
      // Resend confirmation
      const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${existing.confirm_token}`;
      const unsubUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${existing.unsubscribe_token}`;
      const emailContent = confirmationEmail(confirmUrl, unsubUrl, address);
      await sendEmail(env, { to: email, ...emailContent });

      return jsonResponse({ success: true, message: 'Check your email to confirm your subscription.' });
    }

    if (existing.status === 'unsubscribed') {
      // Re-subscribe: generate new tokens, reset to pending
      const confirmToken = generateToken();
      const unsubToken = generateToken();

      await env.DB.prepare(
        `UPDATE subscribers SET status = 'pending', confirm_token = ?, unsubscribe_token = ?, 
         ip_hash = ?, created_at = datetime('now'), confirmed_at = NULL, unsubscribed_at = NULL,
         welcome_step = 0, welcome_next_at = NULL WHERE id = ?`
      ).bind(confirmToken, unsubToken, ipHash, existing.id).run();

      const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${confirmToken}`;
      const unsubUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${unsubToken}`;
      const emailContent = confirmationEmail(confirmUrl, unsubUrl, address);
      await sendEmail(env, { to: email, ...emailContent });

      return jsonResponse({ success: true, message: 'Check your email to confirm your subscription.' });
    }
  }

  // New subscriber
  const confirmToken = generateToken();
  const unsubToken = generateToken();

  await env.DB.prepare(
    `INSERT INTO subscribers (email, status, confirm_token, unsubscribe_token, ip_hash, signup_source)
     VALUES (?, 'pending', ?, ?, ?, ?)`
  ).bind(email, confirmToken, unsubToken, ipHash, 'website').run();

  // Send confirmation email
  const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${confirmToken}`;
  const unsubUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${unsubToken}`;
  const emailContent = confirmationEmail(confirmUrl, unsubUrl, address);
  const result = await sendEmail(env, { to: email, ...emailContent });

  if (result) {
    // Log the send
    const sub = await env.DB.prepare(`SELECT id FROM subscribers WHERE email = ?`).bind(email).first<{ id: number }>();
    if (sub) {
      await env.DB.prepare(
        `INSERT INTO email_log (subscriber_id, email_type, resend_id) VALUES (?, 'confirmation', ?)`
      ).bind(sub.id, result.id).run();
    }
  }

  // If form POST (not JSON), redirect to thank-you page
  if (!contentType.includes('application/json')) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${siteUrl}/newsletter/check-email` },
    });
  }

  return jsonResponse({ success: true, message: 'Check your email to confirm your subscription.' });
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
