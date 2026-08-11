import { describe, expect, it } from 'vitest'
import { tokenizeMarkdown, type MarkdownInline } from './index'

function links(nodes: readonly MarkdownInline[]): Extract<MarkdownInline, { kind: 'link' }>[] {
  return nodes.filter((node): node is Extract<MarkdownInline, { kind: 'link' }> => node.kind === 'link')
}

describe('research controlled Markdown links', () => {
  it('maps a real list contents anchor to the generated heading id', () => {
    const blocks = tokenizeMarkdown(`
- [属性计算顺序](#属性计算顺序)
- [第一个重复章节](#重复章节)
- [重复章节](#heading-重复章节-2)

## 属性计算顺序
正文

## 重复章节
第一段

## 重复章节
第二段
`)
    const list = blocks.find((block) => block.kind === 'list')
    const headings = blocks.filter((block) => block.kind === 'heading')

    expect(headings.map((heading) => heading.id)).toEqual([
      'heading-属性计算顺序',
      'heading-重复章节',
      'heading-重复章节-2'
    ])
    expect(list?.kind === 'list' ? links(list.items[0] ?? []) : []).toEqual([
      { kind: 'link', text: '属性计算顺序', href: '#heading-属性计算顺序' }
    ])
    expect(list?.kind === 'list' ? links(list.items[1] ?? []) : []).toEqual([
      { kind: 'link', text: '第一个重复章节', href: '#heading-重复章节' }
    ])
    expect(list?.kind === 'list' ? links(list.items[2] ?? []) : []).toEqual([
      { kind: 'link', text: '重复章节', href: '#heading-重复章节-2' }
    ])
  })

  it('preserves an allowlisted external link inside a quote', () => {
    const blocks = tokenizeMarkdown(
      '> 参考 [官方研究资料](https://example.com/research?id=42#results) 获取完整说明。'
    )
    const quote = blocks.find((block) => block.kind === 'quote')

    expect(quote?.kind === 'quote' ? links(quote.content) : []).toEqual([
      {
        kind: 'link',
        text: '官方研究资料',
        href: 'https://example.com/research?id=42#results'
      }
    ])
  })

  it('rejects executable protocols in lists and quotes while retaining their labels as text', () => {
    const blocks = tokenizeMarkdown(`
- [脚本链接](javascript:alert(1))
- [数据链接](data:text/html;base64,PHNjcmlwdD4=)

> [混淆协议](java\nscript:alert(1))
`)
    const inline = blocks.flatMap((block) => {
      if (block.kind === 'list') return block.items.flat()
      if (block.kind === 'quote') return block.content
      return []
    })

    expect(links(inline)).toEqual([])
    expect(inline.map((node) => node.text).join(' ')).toContain('脚本链接')
    expect(inline.map((node) => node.text).join(' ')).toContain('数据链接')
    expect(inline.map((node) => node.text).join(' ')).toContain('混淆协议')
  })
})
