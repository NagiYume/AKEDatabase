const EXPORT_HIDE_SELECTOR = [
  'aside',
  '.research-toc',
  '[class*="mobile-list-button"]',
  '[class*="mobile-button"]',
  '[class*="toc-toggle"]',
  '[data-export-ignore]'
].join(',')

const EXPAND_SELECTOR = [
  '.ake-module-shell',
  '.ake-module-shell__main',
  '.ake-module-shell__content',
  '.activity-module',
  '.activity-detail',
  '.achievement-module',
  '.baker-module',
  '.baker-conversation',
  '.catalog-module',
  '.catalog-detail',
  '.combat-module',
  '.combat-detail',
  '.mission-module',
  '.mission-detail',
  '.research-module',
  '.research-detail',
  '.season-tower-module',
  '.season-tower-content'
].join(',')

export function sanitizeExportFilename(value: string, fallback = 'AKEData'): string {
  const sanitized = value.trim().replaceAll(/[/?<>\\:*|"]/g, '_')
  return sanitized || fallback
}

export function exportTitle(element: HTMLElement, fallback: string): string {
  const heading = element.querySelector<HTMLElement>('h1, h2')?.textContent?.trim()
  return sanitizeExportFilename(heading || fallback)
}

function expandClone(document: Document, element: HTMLElement): void {
  document.querySelectorAll(EXPORT_HIDE_SELECTOR).forEach((entry) => entry.remove())
  document.querySelectorAll<HTMLDetailsElement>('details').forEach((details) => {
    details.open = true
  })
  for (const entry of document.querySelectorAll<HTMLElement>(EXPAND_SELECTOR)) {
    entry.style.width = '100%'
    entry.style.maxWidth = 'none'
    entry.style.height = 'auto'
    entry.style.maxHeight = 'none'
    entry.style.overflow = 'visible'
  }
  const view = document.defaultView
  if (view) {
    for (const entry of document.querySelectorAll<HTMLElement>('*')) {
      const style = view.getComputedStyle(entry)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        entry.style.height = 'auto'
        entry.style.maxHeight = 'none'
        entry.style.overflowY = 'visible'
      }
    }
  }
  element.style.width = '100%'
  element.style.maxWidth = 'none'
  element.style.height = 'auto'
  element.style.maxHeight = 'none'
  element.style.margin = '0'
  element.style.overflow = 'visible'
  document.body.style.margin = '0'
}

function addWatermark(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d')
  if (!context) return
  context.font = '700 40px "Microsoft YaHei", sans-serif'
  context.fillStyle = 'rgba(150, 150, 150, 0.1)'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (let y = 50; y < canvas.height; y += 600) {
    for (let x = 50; x < canvas.width; x += 800) {
      context.save()
      context.translate(x, y)
      context.rotate(-0.5)
      context.fillText('AKEData.top', 0, 0)
      context.restore()
    }
  }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG export returned an empty image'))
    }, 'image/png')
  })
}

export async function downloadLongImage(element: HTMLElement, title: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')
  const exportArea =
    Math.max(element.scrollWidth, element.clientWidth) * Math.max(element.scrollHeight, element.clientHeight)
  const canvas = await html2canvas(element, {
    scale: exportArea > 8_000_000 ? 1 : 2,
    useCORS: true,
    logging: false,
    allowTaint: false,
    imageTimeout: 8_000,
    scrollY: 0,
    onclone: expandClone
  })
  addWatermark(canvas)
  const blob = await canvasBlob(canvas)
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `${sanitizeExportFilename(title)}.png`
  link.href = objectUrl
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}
