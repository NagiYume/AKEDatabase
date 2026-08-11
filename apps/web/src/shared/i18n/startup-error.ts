import type { AppLocale } from '@ake/r2-contract'

const STARTUP_ERROR_MESSAGES = Object.freeze({
  CH: 'AKEData：应用初始化失败，请刷新页面后重试。',
  EN: 'AKEData: Application initialization failed. Refresh the page and try again.'
})

export function startupErrorMessage(locale: AppLocale): string {
  return locale === 'CH' ? STARTUP_ERROR_MESSAGES.CH : STARTUP_ERROR_MESSAGES.EN
}

export function renderStartupError(root: Element, locale: AppLocale): void {
  root.textContent = startupErrorMessage(locale)
  root.setAttribute('role', 'alert')
}
