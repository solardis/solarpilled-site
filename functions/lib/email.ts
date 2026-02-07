import type { Env } from './types';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(env: Env, params: SendEmailParams): Promise<{ id: string } | null> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'solarpilled <newsletter@solarpilled.com>',
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!res.ok) {
    console.error('Resend API error:', res.status, await res.text());
    return null;
  }

  return res.json();
}

export function confirmationEmail(confirmUrl: string, unsubUrl: string, address: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Confirm your solarpilled subscription',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.6;">
  <p style="font-size: 24px; margin-bottom: 4px;">☀️ <strong>solarpilled</strong></p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
  <p>Someone (hopefully you) signed up for the solarpilled newsletter.</p>
  <p>Click below to confirm — we use double opt-in because we respect your inbox:</p>
  <p style="margin: 28px 0;">
    <a href="${confirmUrl}" style="background: #f59e0b; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Confirm subscription</a>
  </p>
  <p style="font-size: 14px; color: #64748b;">If you didn't sign up, just ignore this email. No action needed.</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;">
  <p style="font-size: 12px; color: #94a3b8;">
    <a href="${unsubUrl}" style="color: #94a3b8;">Unsubscribe</a> · ${address}<br>
    © ${new Date().getFullYear()} solarpilled.com
  </p>
</body>
</html>`,
    text: `solarpilled — Confirm your subscription

Someone (hopefully you) signed up for the solarpilled newsletter.

Confirm your subscription: ${confirmUrl}

If you didn't sign up, just ignore this email.

---
Unsubscribe: ${unsubUrl}
${address}
© ${new Date().getFullYear()} solarpilled.com`,
  };
}

export function welcomeEmail1(unsubUrl: string, prefsUrl: string, address: string): { subject: string; html: string; text: string } {
  return {
    subject: "You're in — here's what to expect from solarpilled",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.6;">
  <p style="font-size: 24px; margin-bottom: 4px;">☀️ <strong>solarpilled</strong></p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
  <p>Welcome to solarpilled. You're now subscribed to solar research that respects your intelligence.</p>
  <p><strong>Here's what you'll get:</strong></p>
  <ul>
    <li><strong>Market data & analysis</strong> — panel prices, battery costs, policy changes. Numbers with context.</li>
    <li><strong>Deep dives</strong> — net metering, financing options, installer red flags. The research that saves you hours.</li>
    <li><strong>Tools & calculators</strong> — early access to everything we build.</li>
  </ul>
  <p><strong>How often:</strong> ~2 emails per month. We only write when we have something worth your time.</p>
  <p>In the meantime, here are some good starting points:</p>
  <ul>
    <li><a href="https://solarpilled.com/articles/is-solar-worth-it-2026" style="color: #d97706;">Is solar worth it in 2026?</a></li>
    <li><a href="https://solarpilled.com/articles/solar-panel-cost-2026" style="color: #d97706;">What solar panels actually cost right now</a></li>
    <li><a href="https://solarpilled.com/articles/solar-tax-credit-2026" style="color: #d97706;">The federal solar tax credit, explained</a></li>
  </ul>
  <p>Reply to this email anytime — it goes to a real person.</p>
  <p>— The solarpilled team</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;">
  <p style="font-size: 12px; color: #94a3b8;">
    <a href="${prefsUrl}" style="color: #94a3b8;">Manage preferences</a> · <a href="${unsubUrl}" style="color: #94a3b8;">Unsubscribe</a> · ${address}<br>
    © ${new Date().getFullYear()} solarpilled.com
  </p>
</body>
</html>`,
    text: `solarpilled — Welcome!

Welcome to solarpilled. You're now subscribed to solar research that respects your intelligence.

HERE'S WHAT YOU'LL GET:
- Market data & analysis — panel prices, battery costs, policy changes. Numbers with context.
- Deep dives — net metering, financing options, installer red flags.
- Tools & calculators — early access to everything we build.

HOW OFTEN: ~2 emails per month. We only write when we have something worth your time.

GOOD STARTING POINTS:
- Is solar worth it in 2026? https://solarpilled.com/articles/is-solar-worth-it-2026
- What solar panels actually cost: https://solarpilled.com/articles/solar-panel-cost-2026
- Federal solar tax credit: https://solarpilled.com/articles/solar-tax-credit-2026

Reply to this email anytime — it goes to a real person.

— The solarpilled team

---
Manage preferences: ${prefsUrl}
Unsubscribe: ${unsubUrl}
${address}
© ${new Date().getFullYear()} solarpilled.com`,
  };
}
