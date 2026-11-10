import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY, contentSecurityPolicyPlugin } from '../scripts/contentSecurityPolicy.mjs'

const directive = name => CONTENT_SECURITY_POLICY.split('; ').find(part => part.startsWith(`${name} `))

describe('content security policy', () => {
  it('allows scripts only from the app itself', () => {
    expect(directive('script-src')).toBe("script-src 'self'")
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-eval/)
    expect(directive('script-src')).not.toMatch(/unsafe-inline/)
  })

  it('allows nothing from the network, frames or plugins', () => {
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:|\*/)
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('frame-src')).toBe("frame-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'none'")
  })

  it('is added to the built page only, never the dev server', () => {
    const plugin = contentSecurityPolicyPlugin()
    expect(plugin.apply).toBe('build')
    expect(plugin.transformIndexHtml()[0].attrs.content).toBe(CONTENT_SECURITY_POLICY)
  })

  it('leaves no remote stylesheet or font in the renderer sources', () => {
    const root = path.resolve(import.meta.dirname, '../src/renderer')
    const offenders = []
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(css|html|jsx?)$/.test(entry.name) && /(?:@import\s+url\(|href=|src=)\s*["']?https?:\/\//.test(fs.readFileSync(full, 'utf8'))) offenders.push(full)
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
