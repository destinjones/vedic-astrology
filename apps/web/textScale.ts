import type { Plugin } from 'postcss'

/**
 * Lets the reader's text-size setting reach every stylesheet without editing each one.
 * At build time, `font-size: 13px` becomes `font-size: calc(13px * var(--text-scale, 1))`,
 * and the size inside a `font:` shorthand is rewritten the same way.
 *
 * Text drawn inside the SVG charts and wheels is left alone: it is measured in the
 * drawing's own units and already grows with the drawing, and larger glyphs would collide.
 */
const SVG_TEXT = /\.(chart-|wheel-|kp-wheel|sky-label)/

const scaled = (n: string) => `calc(${n}px * var(--text-scale, 1))`

export function textScale(): Plugin {
  return {
    postcssPlugin: 'text-scale',
    Declaration(decl) {
      if (decl.prop !== 'font-size' && decl.prop !== 'font') return
      if (decl.value.includes('--text-scale')) return
      const rule = decl.parent
      const selector = rule && rule.type === 'rule' ? (rule as unknown as { selector: string }).selector : ''
      if (SVG_TEXT.test(selector)) return
      if (decl.prop === 'font-size') {
        const m = /^(\d+(?:\.\d+)?)px$/.exec(decl.value.trim())
        if (m) decl.value = scaled(m[1])
        return
      }
      // font shorthand: the first <number>px token, optionally followed by /line-height
      decl.value = decl.value.replace(/(^|\s)(\d+(?:\.\d+)?)px(?=\/|\s|$)/, (_, pre: string, n: string) => `${pre}${scaled(n)}`)
    },
  }
}
