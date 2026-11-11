// The Content-Security-Policy of the built app's page. The page only ever needs its own bundled
// scripts and styles, images it embeds as data: URLs (a chosen background), and nothing from the
// network. Inline styles are allowed because the editor and React set element styles.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'"
].join('; ')

// Vite plugin: adds the policy to the built page only. The dev server needs inline scripts and a
// socket for hot reload, so it is left alone.
export function contentSecurityPolicyPlugin() {
  return {
    name: 'tessera-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [{
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
      injectTo: 'head-prepend'
    }]
  }
}
