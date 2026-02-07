import type { Env, Subscriber } from '../../lib/types';

// GET: Show unsubscribe confirmation page (one-click from email)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const confirm = url.searchParams.get('confirm');
  const siteUrl = env.SITE_URL || 'https://solarpilled.com';

  if (!token) {
    return redirect(`${siteUrl}/newsletter/error?reason=missing-token`);
  }

  const subscriber = await env.DB.prepare(
    `SELECT id, email, status FROM subscribers WHERE unsubscribe_token = ?`
  ).bind(token).first<Subscriber>();

  if (!subscriber) {
    return redirect(`${siteUrl}/newsletter/error?reason=invalid-token`);
  }

  // If confirm=1, process unsubscribe immediately (one-click)
  if (confirm === '1') {
    if (subscriber.status !== 'unsubscribed') {
      await env.DB.prepare(
        `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE id = ?`
      ).bind(subscriber.id).run();
    }
    return redirect(`${siteUrl}/newsletter/unsubscribed`);
  }

  // Otherwise show a confirmation page with the unsubscribe button
  const maskedEmail = maskEmail(subscriber.email);
  return new Response(unsubscribePage(maskedEmail, token, siteUrl), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

// POST: Process unsubscribe (from the confirmation page form)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const siteUrl = env.SITE_URL || 'https://solarpilled.com';

  const formData = await request.formData();
  const token = formData.get('token') as string;

  if (!token) {
    return redirect(`${siteUrl}/newsletter/error?reason=missing-token`);
  }

  const subscriber = await env.DB.prepare(
    `SELECT id, status FROM subscribers WHERE unsubscribe_token = ?`
  ).bind(token).first<Subscriber>();

  if (!subscriber) {
    return redirect(`${siteUrl}/newsletter/error?reason=invalid-token`);
  }

  if (subscriber.status !== 'unsubscribed') {
    await env.DB.prepare(
      `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE id = ?`
    ).bind(subscriber.id).run();
  }

  return redirect(`${siteUrl}/newsletter/unsubscribed`);
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const masked = local.length > 2
    ? local[0] + '***' + local[local.length - 1]
    : local[0] + '***';
  return `${masked}@${domain}`;
}

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { 'Location': url },
  });
}

function unsubscribePage(email: string, token: string, siteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribe — solarpilled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #1e293b; text-align: center; }
    h1 { font-size: 1.5rem; }
    p { color: #64748b; line-height: 1.6; }
    button { background: #ef4444; color: #fff; border: none; padding: 12px 32px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 16px; }
    button:hover { background: #dc2626; }
    a { color: #d97706; }
  </style>
</head>
<body>
  <h1>☀️ Unsubscribe</h1>
  <p>Unsubscribe <strong>${email}</strong> from the solarpilled newsletter?</p>
  <form method="POST" action="${siteUrl}/api/newsletter/unsubscribe">
    <input type="hidden" name="token" value="${token}">
    <button type="submit">Yes, unsubscribe me</button>
  </form>
  <p style="margin-top: 24px; font-size: 0.875rem;">Changed your mind? Just close this page.</p>
</body>
</html>`;
}
