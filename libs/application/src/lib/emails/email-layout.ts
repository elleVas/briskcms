/**
 * Table-based layout + inline styles — email clients largely ignore
 * `<style>` blocks and external CSS, so this is the one place in the
 * codebase where that's the correct choice, not a shortcut. Single accent
 * color (indigo): no visual identity exists yet elsewhere in the project
 * (apps/editor-app has no styling of its own before this), so this picks
 * something clean and neutral rather than guessing a brand.
 */

const ACCENT_COLOR = '#4f46e5';

export function ctaButtonHtml(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:${ACCENT_COLOR};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;margin-top:8px;">${label}</a>`;
}

export function renderEmailLayout(bodyHtml: string): string {
  return `<table role="presentation" width="100%" style="background:#f4f4f5;padding:32px 0;font-family:-apple-system,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" style="background:#ffffff;border-radius:8px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 24px;font-size:20px;color:#111827;">Brisk</h1>
        ${bodyHtml}
        <p style="margin-top:24px;color:#9ca3af;font-size:12px;">Se non hai richiesto questa email, ignorala.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}
