const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface EmailContent {
  title: string;
  paragraphs: string[];
  /** Shown large and spaced, e.g. a one-time code. */
  code?: string;
  action?: { label: string; url: string };
  footer: string;
  lang: string;
}

/** Minimal, accessible HTML email with inline styles (email clients ignore <style> blocks). */
export function renderEmail(content: EmailContent): string {
  const paragraphs = content.paragraphs
    .flatMap((p) => p.split('\n\n'))
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#0F172A">${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const code = content.code
    ? `<p style="margin:8px 0 24px;font-size:32px;font-weight:700;letter-spacing:8px;color:#1E40AF;font-family:ui-monospace,Menlo,Consolas,monospace">${escape(content.code)}</p>`
    : '';
  const action = content.action
    ? `<p style="margin:8px 0 24px"><a href="${escape(content.action.url)}" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escape(content.action.label)}</a></p>`
    : '';
  return `<!doctype html><html lang="${escape(content.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(content.title)}</title></head>
<body style="margin:0;background:#F8FAFC;font-family:'Noto Sans Bengali','Inter',Segoe UI,Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#2563EB">বইকণিকা · Boikonika</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.4;color:#0F172A">${escape(content.title)}</h1>
${paragraphs}${code}${action}
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748B">${escape(content.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}
