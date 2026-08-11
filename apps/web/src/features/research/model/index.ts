export interface ResearchDocument {
  id: string
  name: string
  contentFile: string
  hidden: boolean
  priority: number
  category: string
  categoryOrder: number
  summary: string
  token: string
}

export type MarkdownInline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'emphasis'; text: string }
  | { kind: 'delete'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'image'; text: string; src: string }
  | { kind: 'break'; text: '' }

export type MarkdownBlock =
  | { kind: 'heading'; level: number; id: string; content: readonly MarkdownInline[] }
  | { kind: 'paragraph'; content: readonly MarkdownInline[] }
  | { kind: 'quote'; content: readonly MarkdownInline[] }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'list'; ordered: boolean; items: readonly (readonly MarkdownInline[])[] }
  | {
      kind: 'table'
      headers: readonly (readonly MarkdownInline[])[]
      rows: readonly (readonly (readonly MarkdownInline[])[])[]
    }
  | { kind: 'rule' }

function safeUrl(value: string, image: boolean): string {
  const raw = value.trim()
  if (
    !raw ||
    [...raw].some((character) => character.charCodeAt(0) <= 0x1f || character.charCodeAt(0) === 0x7f)
  )
    return ''
  if (raw.startsWith('#')) return image ? '' : raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return ''
  return raw.replace(/^\.\//, '')
}

export function slugifyHeading(value: string): string {
  const slug = value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
  return `heading-${slug || 'section'}`
}

export function tokenizeInline(value: string): MarkdownInline[] {
  const source = String(value ?? '')
  const output: MarkdownInline[] = []
  const pattern =
    /(!?\[([^\]]*)\]\(([^)]+)\)|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|`([^`\n]+)`|\*([^*\n]+)\*|\r?\n)/g
  let cursor = 0
  for (const match of source.matchAll(pattern)) {
    const index = match.index
    if (index > cursor) output.push({ kind: 'text', text: source.slice(cursor, index) })
    const token = match[0]
    if (token === '\n' || token === '\r\n') {
      output.push({ kind: 'break', text: '' })
    } else if (token.startsWith('![')) {
      const src = safeUrl(match[3] ?? '', true)
      output.push(src ? { kind: 'image', text: match[2] ?? '', src } : { kind: 'text', text: match[2] ?? '' })
    } else if (token.startsWith('[')) {
      const href = safeUrl(match[3] ?? '', false)
      output.push(
        href ? { kind: 'link', text: match[2] ?? '', href } : { kind: 'text', text: match[2] ?? '' }
      )
    } else if (match[4] !== undefined) output.push({ kind: 'strong', text: match[4] })
    else if (match[5] !== undefined) output.push({ kind: 'delete', text: match[5] })
    else if (match[6] !== undefined) output.push({ kind: 'code', text: match[6] })
    else if (match[7] !== undefined) output.push({ kind: 'emphasis', text: match[7] })
    cursor = index + token.length
  }
  if (cursor < source.length) output.push({ kind: 'text', text: source.slice(cursor) })
  return output
}

function inlineGroups(block: MarkdownBlock): readonly (readonly MarkdownInline[])[] {
  if (block.kind === 'heading' || block.kind === 'paragraph' || block.kind === 'quote') {
    return [block.content]
  }
  if (block.kind === 'list') return block.items
  if (block.kind === 'table') {
    return [...block.headers, ...block.rows.flatMap((row) => row)]
  }
  return []
}

function decodedFragment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function remapInternalAnchors(blocks: MarkdownBlock[]): void {
  const headingIds = new Set(blocks.flatMap((block) => (block.kind === 'heading' ? [block.id] : [])))
  const headingAliases = new Map<string, string>()
  for (const block of blocks) {
    if (block.kind !== 'heading') continue
    const label = block.content.map((node) => node.text).join('')
    const generated = slugifyHeading(label)
    if (!headingAliases.has(generated)) headingAliases.set(generated, block.id)
    headingAliases.set(block.id, block.id)
  }
  for (const block of blocks) {
    for (const group of inlineGroups(block)) {
      for (const node of group) {
        if (node.kind !== 'link' || !node.href.startsWith('#')) continue
        const fragment = decodedFragment(node.href.slice(1)).trim()
        const candidate = headingIds.has(fragment) ? fragment : slugifyHeading(fragment)
        const target = headingAliases.get(candidate)
        if (target) node.href = `#${target}`
      }
    }
  }
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function tokenizeMarkdown(markdown: string): MarkdownBlock[] {
  const lines = String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const blocks: MarkdownBlock[] = []
  const headingIds = new Map<string, number>()
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      continue
    }
    if (trimmed.startsWith('```')) {
      const language = trimmed
        .slice(3)
        .trim()
        .replace(/[^a-z\d_-]/gi, '')
      const code: string[] = []
      index += 1
      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        code.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ kind: 'code', language, text: code.join('\n') })
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (heading) {
      const label = heading[2] ?? ''
      const baseId = slugifyHeading(label)
      const count = headingIds.get(baseId) ?? 0
      headingIds.set(baseId, count + 1)
      blocks.push({
        kind: 'heading',
        level: heading[1]?.length ?? 1,
        id: count ? `${baseId}-${count + 1}` : baseId,
        content: tokenizeInline(label)
      })
      index += 1
      continue
    }
    if (/^([-*_])(?:\s*\1){2,}$/.test(trimmed)) {
      blocks.push({ kind: 'rule' })
      index += 1
      continue
    }
    if (trimmed.startsWith('>')) {
      const quote: string[] = []
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('>')) {
        quote.push((lines[index] ?? '').trim().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ kind: 'quote', content: tokenizeInline(quote.join('\n')) })
      continue
    }
    const listMatch = /^(?:([-*+])|(\d+)\.)\s+(.+)$/.exec(trimmed)
    if (listMatch) {
      const ordered = Boolean(listMatch[2])
      const items: MarkdownInline[][] = []
      while (index < lines.length) {
        const match = /^(?:([-*+])|(\d+)\.)\s+(.+)$/.exec((lines[index] ?? '').trim())
        if (!match || Boolean(match[2]) !== ordered) break
        items.push(tokenizeInline(match[3] ?? ''))
        index += 1
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && index + 1 < lines.length) {
      const separator = tableCells(lines[index + 1] ?? '')
      if (separator.length > 0 && separator.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        const headers = tableCells(trimmed).map(tokenizeInline)
        const rows: MarkdownInline[][][] = []
        index += 2
        while (
          index < lines.length &&
          (lines[index] ?? '').trim().startsWith('|') &&
          (lines[index] ?? '').trim().endsWith('|')
        ) {
          rows.push(tableCells(lines[index] ?? '').map(tokenizeInline))
          index += 1
        }
        blocks.push({ kind: 'table', headers, rows })
        continue
      }
    }
    const paragraph = [trimmed]
    index += 1
    while (index < lines.length) {
      const next = (lines[index] ?? '').trim()
      if (
        !next ||
        /^(#{1,6})\s+/.test(next) ||
        next.startsWith('```') ||
        next.startsWith('>') ||
        /^(?:[-*+]|\d+\.)\s+/.test(next)
      )
        break
      paragraph.push(next)
      index += 1
    }
    blocks.push({ kind: 'paragraph', content: tokenizeInline(paragraph.join('\n')) })
  }
  remapInternalAnchors(blocks)
  return blocks
}

export function filterResearchDocuments(
  documents: readonly ResearchDocument[],
  options: { search: string; showHidden: boolean; unlockedTokens: ReadonlySet<string>; category?: string }
): ResearchDocument[] {
  const search = options.search.trim().toLocaleLowerCase()
  return documents.filter((document) => {
    if (!options.showHidden && document.hidden) return false
    if (document.token && !options.unlockedTokens.has(document.token)) return false
    if (options.category === '__general__' && document.category) return false
    if (
      options.category &&
      !['all', '__general__'].includes(options.category) &&
      document.category !== options.category
    )
      return false
    if (!search) return true
    return [document.id, document.name, document.summary, document.category].some((value) =>
      value.toLocaleLowerCase().includes(search)
    )
  })
}
