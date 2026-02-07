import type { Env, Subscriber } from '../../lib/types';
import { sendEmail, welcomeEmail1 } from '../../lib/email';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const siteUrl = env.SITE_URL || 'https://solarpilled.com';
  const address = env.CANSPAM_ADDRESS || 'solarpilled.com';

  if (!token) {
    return redirect(`${siteUrl}/newsletter/error?reason=missing-token`);
  }

  // Find subscriber by confirm token
  const subscriber = await env.DB.prepare(
    `SELECT id, email, status, unsubscribe_token FROM subscribers WHERE confirm_token = ?`
  ).bind(token).first<Subscriber>();

  if (!subscriber) {
    return redirect(`${siteUrl}/newsletter/error?reason=invalid-token`);
  }

  if (subscriber.status === 'confirmed') {
    return redirect(`${siteUrl}/newsletter/confirmed?already=true`);
  }

  // Confirm the subscriber
  const welcomeNextAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days

  await env.DB.prepare(
    `UPDATE subscribers SET 
       status = 'confirmed', 
       confirm_token = NULL, 
       confirmed_at = datetime('now'),
       welcome_step = 1,
       welcome_next_at = ?
     WHERE id = ?`
  ).bind(welcomeNextAt, subscriber.id).run();

  // Send welcome email #1
  const unsubUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${subscriber.unsubscribe_token}`;
  const prefsUrl = `${siteUrl}/api/newsletter/preferences?token=${subscriber.unsubscribe_token}`;
  const emailContent = welcomeEmail1(unsubUrl, prefsUrl, address);
  const result = await sendEmail(env, { to: subscriber.email, ...emailContent });

  if (result) {
    await env.DB.prepare(
      `INSERT INTO email_log (subscriber_id, email_type, resend_id) VALUES (?, 'welcome-1', ?)`
    ).bind(subscriber.id, result.id).run();
  }

  return redirect(`${siteUrl}/newsletter/confirmed`);
};

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { 'Location': url },
  });
}
