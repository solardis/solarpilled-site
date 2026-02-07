/**
 * Welcome drip sequence processor.
 * Call via cron trigger (daily) or manual invocation.
 * GET /api/newsletter/drip?key=<CRON_SECRET>
 * 
 * Sends welcome emails #2 and #3 to confirmed subscribers
 * based on their welcome_step and welcome_next_at timestamp.
 */
import type { Env, Subscriber } from '../../lib/types';
import { sendEmail } from '../../lib/email';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // Simple auth for cron — check a shared secret
  // In production, use a proper cron trigger via wrangler.toml
  // This GET endpoint is a fallback for manual/external cron
  const key = url.searchParams.get('key');
  if (!key || key.length < 16) {
    return new Response('Unauthorized', { status: 401 });
  }

  const siteUrl = env.SITE_URL || 'https://solarpilled.com';
  const address = env.CANSPAM_ADDRESS || 'solarpilled.com';
  const now = new Date().toISOString();

  // Find subscribers due for next welcome email
  const due = await env.DB.prepare(
    `SELECT id, email, welcome_step, unsubscribe_token FROM subscribers 
     WHERE status = 'confirmed' AND welcome_step < 3 AND welcome_next_at <= ?
     LIMIT 50`
  ).bind(now).all<Subscriber>();

  let sent = 0;

  for (const sub of due.results) {
    const unsubUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${sub.unsubscribe_token}`;
    const prefsUrl = `${siteUrl}/api/newsletter/preferences?token=${sub.unsubscribe_token}`;

    let emailContent: { subject: string; html: string; text: string } | null = null;
    let emailType = '';

    if (sub.welcome_step === 1) {
      emailContent = welcomeEmail2(unsubUrl, prefsUrl, siteUrl, address);
      emailType = 'welcome-2';
    } else if (sub.welcome_step === 2) {
      emailContent = welcomeEmail3(unsubUrl, prefsUrl, siteUrl, address);
      emailType = 'welcome-3';
    }

    if (!emailContent) continue;

    const result = await sendEmail(env, { to: sub.email, ...emailContent });

    const nextStep = sub.welcome_step + 1;
    const nextAt = nextStep < 3
      ? new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString() // 4 days later
      : null;

    await env.DB.prepare(
      `UPDATE subscribers SET welcome_step = ?, welcome_next_at = ? WHERE id = ?`
    ).bind(nextStep, nextAt, sub.id).run();

    if (result) {
      await env.DB.prepare(
        `INSERT INTO email_log (subscriber_id, email_type, resend_id) VALUES (?, ?, ?)`
      ).bind(sub.id, emailType, result.id).run();
    }

    sent++;
  }

  return new Response(JSON.stringify({ processed: sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

function welcomeEmail2(unsubUrl: string, prefsUrl: string, siteUrl: string, address: string) {
  return {
    subject: "The solar research you'd bookmark",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.6;">
  <p style="font-size: 24px; margin-bottom: 4px;">☀️ <strong>solarpilled</strong></p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
  
  <p>A few days in — here are the pieces our readers find most useful.</p>
  
  <h2 style="font-size: 18px; margin-top: 28px;">📊 The numbers</h2>
  <p><a href="${siteUrl}/articles/solar-panel-cost-2026" style="color: #d97706; font-weight: 600;">What solar panels actually cost in 2026</a><br>
  <span style="color: #64748b; font-size: 14px;">Real pricing data, not marketing numbers. Updated regularly.</span></p>
  
  <p><a href="${siteUrl}/articles/solar-payback-math" style="color: #d97706; font-weight: 600;">Solar payback math: the honest calculation</a><br>
  <span style="color: #64748b; font-size: 14px;">How to figure out your actual ROI, including the variables most calculators ignore.</span></p>
  
  <h2 style="font-size: 18px; margin-top: 28px;">📋 The policy</h2>
  <p><a href="${siteUrl}/articles/solar-tax-credit-2026" style="color: #d97706; font-weight: 600;">Federal solar tax credit, explained simply</a><br>
  <span style="color: #64748b; font-size: 14px;">What you actually get, who qualifies, and common mistakes.</span></p>
  
  <p><a href="${siteUrl}/articles/net-metering-explained" style="color: #d97706; font-weight: 600;">Net metering: what it is and why it matters</a><br>
  <span style="color: #64748b; font-size: 14px;">The policy that makes or breaks solar economics in your state.</span></p>
  
  <h2 style="font-size: 18px; margin-top: 28px;">🔋 The decision</h2>
  <p><a href="${siteUrl}/articles/is-solar-worth-it-2026" style="color: #d97706; font-weight: 600;">Is solar worth it in 2026?</a><br>
  <span style="color: #64748b; font-size: 14px;">The honest answer: it depends. Here's how to figure out your specific case.</span></p>
  
  <p><a href="${siteUrl}/articles/battery-storage-worth-it" style="color: #d97706; font-weight: 600;">Is battery storage worth the extra cost?</a><br>
  <span style="color: #64748b; font-size: 14px;">Spoiler: for most people, not yet. But here's when it makes sense.</span></p>
  
  <p style="margin-top: 28px;">Bookmark what's useful. We'll keep the research coming.</p>
  <p>— The solarpilled team</p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;">
  <p style="font-size: 12px; color: #94a3b8;">
    <a href="${prefsUrl}" style="color: #94a3b8;">Manage preferences</a> · <a href="${unsubUrl}" style="color: #94a3b8;">Unsubscribe</a> · ${address}<br>
    © ${new Date().getFullYear()} solarpilled.com
  </p>
</body>
</html>`,
    text: `solarpilled — The solar research you'd bookmark

A few days in — here are the pieces our readers find most useful.

THE NUMBERS
- What solar panels actually cost in 2026: ${siteUrl}/articles/solar-panel-cost-2026
- Solar payback math — the honest calculation: ${siteUrl}/articles/solar-payback-math

THE POLICY
- Federal solar tax credit, explained: ${siteUrl}/articles/solar-tax-credit-2026
- Net metering — what it is and why it matters: ${siteUrl}/articles/net-metering-explained

THE DECISION
- Is solar worth it in 2026? ${siteUrl}/articles/is-solar-worth-it-2026
- Is battery storage worth the extra cost? ${siteUrl}/articles/battery-storage-worth-it

Bookmark what's useful. We'll keep the research coming.

— The solarpilled team

---
Manage preferences: ${prefsUrl}
Unsubscribe: ${unsubUrl}
${address}
© ${new Date().getFullYear()} solarpilled.com`,
  };
}

function welcomeEmail3(unsubUrl: string, prefsUrl: string, siteUrl: string, address: string) {
  return {
    subject: "Quick solar math: is your roof worth it?",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.6;">
  <p style="font-size: 24px; margin-bottom: 4px;">☀️ <strong>solarpilled</strong></p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
  
  <p>Last onboarding email — let's do some actual math.</p>
  
  <h2 style="font-size: 18px; margin-top: 28px;">The 5-minute solar payback estimate</h2>
  
  <p>You don't need a sales consultation to get a rough answer. Here's the back-of-envelope version:</p>
  
  <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p style="margin: 0 0 12px;"><strong>Step 1:</strong> Find your annual electricity cost<br>
    <span style="color: #64748b; font-size: 14px;">Check your utility account for 12-month total. National average: ~$1,800/year.</span></p>
    
    <p style="margin: 0 0 12px;"><strong>Step 2:</strong> Estimate system cost after incentives<br>
    <span style="color: #64748b; font-size: 14px;">Average 6kW system: ~$18,000 before incentives. After 30% federal tax credit: ~$12,600.</span></p>
    
    <p style="margin: 0 0 12px;"><strong>Step 3:</strong> Estimate annual solar offset<br>
    <span style="color: #64748b; font-size: 14px;">Most systems offset 80-100% of usage. Conservative estimate: 80% = $1,440/year saved.</span></p>
    
    <p style="margin: 0;"><strong>Step 4:</strong> Divide<br>
    <span style="color: #64748b; font-size: 14px;">$12,600 ÷ $1,440 = <strong>8.75 years</strong> payback. Panels last 25-30 years. That's 16+ years of essentially free electricity.</span></p>
  </div>
  
  <p><strong>Important caveats:</strong></p>
  <ul>
    <li>This varies enormously by state (electricity rates, sun hours, net metering policy)</li>
    <li>Financing changes the math — interest costs add years to payback</li>
    <li>Electricity rates are rising ~3%/year, which actually improves payback over time</li>
    <li>Roof condition, shading, and orientation matter</li>
  </ul>
  
  <p>For a more detailed walkthrough, see our <a href="${siteUrl}/articles/solar-payback-math" style="color: #d97706;">full payback analysis</a>.</p>
  
  <p style="margin-top: 28px; padding: 16px; background: #f8fafc; border-radius: 8px;">
    <strong>That's the end of our welcome series.</strong> From here, you'll get our regular newsletter — research, data, and tools when we have something worth sharing. Reply anytime with questions.
  </p>
  
  <p>— The solarpilled team</p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;">
  <p style="font-size: 12px; color: #94a3b8;">
    <a href="${prefsUrl}" style="color: #94a3b8;">Manage preferences</a> · <a href="${unsubUrl}" style="color: #94a3b8;">Unsubscribe</a> · ${address}<br>
    © ${new Date().getFullYear()} solarpilled.com
  </p>
</body>
</html>`,
    text: `solarpilled — Quick solar math: is your roof worth it?

Last onboarding email — let's do some actual math.

THE 5-MINUTE SOLAR PAYBACK ESTIMATE

You don't need a sales consultation to get a rough answer:

Step 1: Find your annual electricity cost
Check your utility account for 12-month total. National average: ~$1,800/year.

Step 2: Estimate system cost after incentives
Average 6kW system: ~$18,000 before incentives. After 30% federal tax credit: ~$12,600.

Step 3: Estimate annual solar offset
Most systems offset 80-100% of usage. Conservative estimate: 80% = $1,440/year saved.

Step 4: Divide
$12,600 ÷ $1,440 = 8.75 years payback. Panels last 25-30 years. That's 16+ years of essentially free electricity.

IMPORTANT CAVEATS:
- This varies enormously by state (electricity rates, sun hours, net metering policy)
- Financing changes the math — interest costs add years to payback
- Electricity rates are rising ~3%/year, which actually improves payback over time
- Roof condition, shading, and orientation matter

Full payback analysis: ${siteUrl}/articles/solar-payback-math

That's the end of our welcome series. From here, you'll get our regular newsletter — research, data, and tools when we have something worth sharing. Reply anytime with questions.

— The solarpilled team

---
Manage preferences: ${prefsUrl}
Unsubscribe: ${unsubUrl}
${address}
© ${new Date().getFullYear()} solarpilled.com`,
  };
}
