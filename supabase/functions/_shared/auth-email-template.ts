import type { AuthEmailMessagePlan } from './auth-email-plan.ts';

export type RenderedAuthEmail = { html: string; text: string };

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isSafeEmailActionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function renderAuthEmail(
  plan: AuthEmailMessagePlan,
  brandName: string
): RenderedAuthEmail {
  const sections = [
    brandName,
    plan.title,
    plan.introduction,
    plan.token,
    plan.actionUrl && plan.actionLabel ? `${plan.actionLabel}: ${plan.actionUrl}` : undefined,
    plan.safetyNotice,
  ].filter((section): section is string => Boolean(section));

  const action = plan.actionUrl && plan.actionLabel
    ? `${isSafeEmailActionUrl(plan.actionUrl)
      ? `<p style="margin:0 0 16px"><a href="${escapeEmailHtml(plan.actionUrl)}" style="display:inline-block;background:#3157d5;border-radius:8px;color:#ffffff;font-size:16px;font-weight:700;padding:13px 20px;text-decoration:none">${escapeEmailHtml(plan.actionLabel)}</a></p>`
      : `<p style="margin:0 0 16px;font-size:16px;font-weight:700">${escapeEmailHtml(plan.actionLabel)}</p>`}<p style="margin:0 0 24px;color:#596276;font-size:13px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">${escapeEmailHtml(plan.actionUrl)}</p>`
    : '';
  const token = plan.token
    ? `<p style="margin:0 0 24px;padding:18px;border-radius:12px;background:#eef2ff;color:#203f9d;font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center">${escapeEmailHtml(plan.token)}</p>`
    : '';

  return {
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f5f7fb;color:#172033;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px">
            <tr>
              <td style="padding:32px">
                <p style="margin:0 0 8px;color:#3157d5;font-size:12px;font-weight:700;letter-spacing:1px">${escapeEmailHtml(brandName)}</p>
                <h1 style="margin:0 0 12px;font-size:25px;line-height:1.25">${escapeEmailHtml(plan.title)}</h1>
                <p style="margin:0 0 24px;color:#596276;font-size:15px;line-height:1.6">${escapeEmailHtml(plan.introduction)}</p>
                ${token}
                ${action}
                <p style="margin:0;color:#596276;font-size:13px;line-height:1.6">${escapeEmailHtml(plan.safetyNotice)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: sections.join('\n\n'),
  };
}
