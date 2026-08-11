import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(resolve(process.cwd(), 'apps/web/src/features/shop/ui/ShopPage.vue'), 'utf8')
const productSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/shop/ui/ShopProductCard.vue'),
  'utf8'
)
const rotationSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/shop/ui/ShopRotationTable.vue'),
  'utf8'
)

function templateDocument(source: string): Document {
  const start = source.indexOf('<template>') + '<template>'.length
  const end = source.lastIndexOf('</template>')
  const html = source
    .slice(start, end)
    .replace(/<\/?template\b[^>]*>/g, '')
    .replace(/<([A-Z][\w]*)\b([^<>]*?)\/>/g, '<$1$2></$1>')
  return new DOMParser().parseFromString(html, 'text/html')
}

function attributeOrder(document: Document, attribute: string): string[] {
  return [...document.querySelectorAll(`[${attribute}]`)].map(
    (element) => element.getAttribute(attribute) ?? ''
  )
}

describe('shop legacy layout contract', () => {
  it('keeps the 282px search then shop-group directory and shared mobile drawer', () => {
    const document = templateDocument(pageSource)

    expect(attributeOrder(document, 'data-shop-directory-block')).toEqual(['search', 'groups'])
    expect(pageSource).toContain('grid-template-columns: 282px minmax(0, 1fr)')
    expect(pageSource).toContain('width: 282px')
    expect(document.querySelector('responsivedrawer')).not.toBeNull()
    expect(document.querySelector('.shop-mobile-button')).not.toBeNull()
    expect(pageSource).toContain(':aria-label="tr(\'groupList\')"')
  })

  it('keeps group header, context, tabs, and active shop in legacy order', () => {
    const document = templateDocument(pageSource)

    expect(attributeOrder(document, 'data-shop-detail-block')).toEqual([
      'group-header',
      'context',
      'tabs',
      'active-shop'
    ])
    expect(document.querySelector('.shop-group-header h1 + small')).not.toBeNull()
    expect(document.querySelector('.shop-tabs[role="tablist"]')).not.toBeNull()
    expect(document.querySelector('[data-shop-products]')).not.toBeNull()
  })

  it('restores product field and weapon rotation sequences without generic catalog additions', () => {
    const product = templateDocument(productSource)
    const page = templateDocument(pageSource)

    expect(attributeOrder(product, 'data-shop-product-block')).toEqual([
      'identity',
      'price',
      'rewards',
      'bonus',
      'monthly',
      'pool',
      'hint',
      'lock',
      'limit'
    ])
    expect(attributeOrder(page, 'data-shop-rotation-block')).toEqual([
      'weekly-current',
      'weekly-next',
      'daily-current',
      'daily-next'
    ])
    expect(rotationSource).toContain('v-for="key in dayKeys"')
    expect(rotationSource).toContain('v-for="(weapons, day) in row.days"')
    for (const forbidden of ['ModuleHeader', 'MetricGrid', 'RawDataInspector', 'CatalogTools']) {
      expect(pageSource).not.toContain(forbidden)
    }
  })

  it('uses canonical query links, explicit client image resolution, and no nested main', () => {
    const document = templateDocument(pageSource)

    expect(document.querySelector('main')).toBeNull()
    expect(pageSource).toContain("params: { moduleId: 'v3_shop' }")
    expect(pageSource).toContain('query: { ...route.query, id: group.id }')
    expect(productSource).toContain('client.resolveImageUrl(')
    expect(rotationSource).toContain('client.resolveImageUrl(')
    expect(productSource).not.toContain('src="/public/images')
    expect(rotationSource).not.toContain('src="/public/images')
  })
})
