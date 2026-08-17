import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src', 'styles.css'), 'utf8')

describe('contrato de responsividade', () => {
  it('possui tratamento para notebook/tablet, celular e telas grandes', () => {
    expect(css).toContain('@media(max-width:1100px)')
    expect(css).toContain('@media(max-width:700px)')
    expect(css).toContain('@media(max-width:480px)')
    expect(css).toContain('@media(min-width:1600px)')
  })

  it('impede overflow estrutural e adapta modais em celular', () => {
    expect(css).toContain('overflow-x:hidden')
    expect(css).toContain('max-height:100dvh')
    expect(css).toContain('.bottom-nav')
  })
})
