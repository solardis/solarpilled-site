import type { Env, Subscriber } from '../../lib/types';

// GET: Show preferences page
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const siteUrl = env.SITE_URL || 'https://solarpilled.com';

  if (!token) {
    return redirect(`${siteUrl}/newsletter/error?reason=missing-token`);
  }

  const subscriber = await env.DB.prepare(
    `SELECT id, email, frequency, status FROM subscribers WHERE unsubscribe_token = ?`
  ).bind(token).first<Subscriber>();

  if (!subscriber || subscriber.status === 'unsubscribed') {
    return redirect(`${siteUrl}/newsletter/error?reason=not-found`);
  }

  const maskedEmail = maskEmail(subscriber.email);
  return new Response(preferencesPage(maskedEmail, subscriber.frequency, token, siteUrl), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

// POST: Update preferences
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const siteUrl = env.SITE_URL || 'https://solarpilled.com';

  const formData = await request.formData();
  const token = formData.get('token') as string;
  const frequency = formData.get('frequency') as string;

  if (!token) {
    return redirect(`${siteUrl}/newsletter/error?reason=missing-token`);
  }

  const validFrequencies = ['all', 'monthly', 'major-only'];
  if (!validFrequencies.includes(frequency)) {
    return redirect(`${siteUrl}/newsletter/error?reason=invalid-preference`);
  }

  const subscriber = await env.DB.prepare(
    `SELECT id, status FROM subscribers WHERE unsubscribe_token = ?`
  ).bind(token).first<Subscriber>();

  if (!subscriber || subscriber.status === 'unsubscribed') {
    return redirect(`${siteUrl}/newsletter/error?reason=not-found`);
  }

  await env.DB.prepare(
    `UPDATE subscribers SET frequency = ? WHERE id = ?`
  ).bind(frequency, subscriber.id).run();

  return new Response(successPage(siteUrl), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const masked = local.length > 2
    ? local[0] + '***' + local[local.length - 1]
    : local[0] + '***';
  return `${masked}@${domain}`;
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { 'Location': url } });
}

function preferencesPage(email: string, currentFreq: string, token: string, siteUrl: string): string {
  const checked = (val: string) => val === currentFreq ? 'checked' : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email Preferences — solarpilled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 60px auto; padding: 0 20px; color: #1e293b; }
    h1 { font-size: 1.5rem; }
    p { color: #64748b; line-height: 1.6; }
    label { display: block; padding: 12px 16px; margin: 8px 0; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; }
    label:hover { border-color: #f59e0b; }
    input[type="radio"] { margin-right: 8px; }
    button { background: #f59e0b; color: #fff; border: none; padding: 12px 32px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 16px; width: 100%; }
    button:hover { background: #d97706; }
    .desc { font-size: 0.875rem; color: #94a3b8; margin-left: 24px; }
    a { color: #d97706; }
  </style>
</head>
<body>
  <h1>☀️ Email Preferences</h1>
  <p>Manage how often you hear from us, <strong>${email}</strong>.</p>
  <form method="POST" action="${siteUrl}/api/newsletter/preferences">
    <input type="hidden" name="token" value="${token}">
    <label>
      <input type="radio" name="frequency" value="all" ${checked('all')}>
      <strong>All emails</strong>
      <div class="desc">Every newsletter we send (~2/month)</div>
    </label>
    <label>
      <input type="radio" name="frequency" value="monthly" ${checked('monthly')}>
      <strong>Monthly digest</strong>
      <div class="desc">One email per month with the highlights</div>
    </label>
    <label>
      <input type="radio" name="frequency" value="major-only" ${checked('major-only')}>
      <strong>Major updates only</strong>
      <div class="desc">Only big announcements and important policy changes</div>
    </label>
    <button type="submit">Save preferences</button>
  </form>
  <p style="margin-top: 24px; font-size: 0.875rem; text-align: center;">
    Or <a href="${siteUrl}/api/newsletter/unsubscribe?token=${token}">unsubscribe entirely</a>.
  </p>
</body>
</html>`;
}

function successPage(siteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Preferences Updated — solarpilled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #1e293b; text-align: center; }
    h1 { font-size: 1.5rem; }
    p { color: #64748b; }
    a { color: #d97706; }
  </style>
</head>
<body>
  <h1>☀️ Preferences saved</h1>
  <p>Your email preferences have been updated.</p>
  <p><a href="${siteUrl}">Back to solarpilled.com</a></p>
</body>
</html>`;
}
