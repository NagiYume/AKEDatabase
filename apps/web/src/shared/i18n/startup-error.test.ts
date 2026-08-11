import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderStartupError, startupErrorMessage } from './startup-error'

describe('startup error fallback', () => {
  it('renders a stable generic message without accepting technical details', () => {
    const root = document.createElement('div')

    renderStartupError(root, 'EN')

    expect(root.getAttribute('role')).toBe('alert')
    expect(root.textContent).toBe(
      'AKEData: Application initialization failed. Refresh the page and try again.'
    )
    expect(root.textContent).not.toContain('https://')
    expect(startupErrorMessage('CH')).toBe('AKEData：应用初始化失败，请刷新页面后重试。')
    expect(startupErrorMessage('JP')).toBe(
      'AKEData: Application initialization failed. Refresh the page and try again.'
    )
  })

  it('keeps the original exception in the console path only', () => {
    const mainSource = readFileSync(resolve(process.cwd(), 'apps/web/src/main.ts'), 'utf8')

    expect(mainSource).toContain("console.error('AKEData startup failed', error)")
    expect(mainSource).toContain('renderStartupError(root, startupLocale)')
    expect(mainSource).not.toContain('error.message')
    expect(mainSource).not.toContain('String(error)')
  })
})
