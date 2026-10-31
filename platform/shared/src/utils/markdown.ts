/**
 * A small, safe Markdown reader for staff-written pages, articles and FAQ answers. It returns a
 * tree (never HTML), so the web and mobile apps render it with their own components and no markup
 * from the text can reach the page. Supported: headings, paragraphs, bullet and numbered lists,
 * quotes, horizontal rules, **bold**, *italic*, `code` and [links](/path).
 */

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: MdInline[] }
  | { type: 'em'; children: MdInline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: MdInline[] }
  | { type: 'break' };

export type MdBlock =
  | { type: 'heading'; level: 2 | 3 | 4; children: MdInline[]; id: string }
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'list'; ordered: boolean; start: number; items: MdInline[][] }
  | { type: 'quote'; children: MdBlock[] }
  | { type: 'rule' };

/** Links may go to a page on this site, a section of this page, a web address or an email address. */
export function safeHref(raw: string): string | null {
  const href = raw.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (/^\/(?![/\\])/.test(href) || href.startsWith('#')) return href;
  if (/^https?:\/\/[^\s]+$/i.test(href) || /^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return href;
  return null;
}

/** A heading's anchor: lower-case words joined by "-", Bangla letters kept. */
export function headingId(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

export function parseInline(source: string): MdInline[] {
  const out: MdInline[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ type: 'text', text });
    text = '';
  };
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    // Backslash escapes a punctuation character; a backslash at the end of a line is a line break.
    if (ch === '\\' && i + 1 < source.length) {
      const next = source[i + 1]!;
      if (next === '\n') {
        flush();
        out.push({ type: 'break' });
        i += 2;
        continue;
      }
      if (/[\\`*_[\]()#+\-.!>]/.test(next)) {
        text += next;
        i += 2;
        continue;
      }
    }
    if (ch === '`') {
      const end = source.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: 'code', text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && source[i + 1] === ch) {
      const end = source.indexOf(ch + ch, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: 'strong', children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === '*' || ch === '_') {
      // An underscore inside a word (snake_case) is just an underscore.
      const opens = source[i + 1] !== undefined && source[i + 1] !== ' ' && (ch === '*' || i === 0 || !/[\p{L}\p{N}]/u.test(source[i - 1]!));
      if (opens) {
        let end = i + 1;
        while ((end = source.indexOf(ch, end)) !== -1 && (source[end + 1] === ch || source[end - 1] === ' ')) end += source[end + 1] === ch ? 2 : 1;
        if (end > i + 1 && (ch === '*' || end + 1 >= source.length || !/[\p{L}\p{N}]/u.test(source[end + 1]!))) {
          flush();
          out.push({ type: 'em', children: parseInline(source.slice(i + 1, end)) });
          i = end + 1;
          continue;
        }
      }
    }
    if (ch === '[') {
      const close = findClosing(source, i);
      if (close !== -1 && source[close + 1] === '(') {
        const end = findClosing(source, close + 1, '(', ')');
        if (end !== -1) {
          const label = parseInline(source.slice(i + 1, close));
          const href = safeHref(source.slice(close + 2, end));
          flush();
          // An unsafe address keeps its words but loses the link.
          if (href) out.push({ type: 'link', href, children: label });
          else out.push(...label);
          i = end + 1;
          continue;
        }
      }
    }
    if (ch === '\n') {
      text += ' ';
      i += 1;
      continue;
    }
    text += ch;
    i += 1;
  }
  flush();
  return merge(out);
}

/** Index of the bracket closing the one at `open`, allowing nested pairs ("[a [b]]", "(x(1))"). */
function findClosing(source: string, open: number, opener = '[', closer = ']'): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '\\') i++;
    else if (source[i] === opener) depth++;
    else if (source[i] === closer && --depth === 0) return i;
  }
  return -1;
}

function merge(nodes: MdInline[]): MdInline[] {
  const out: MdInline[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.type === 'text' && last?.type === 'text') last.text += n.text;
    else out.push(n);
  }
  return out;
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const BULLET = /^ {0,3}[-*+][ \t]+(.*)$/;
const NUMBERED = /^ {0,3}(\d{1,9})[.)][ \t]+(.*)$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;

export function parseMarkdown(source: string | null | undefined): MdBlock[] {
  const lines = (source ?? '').normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;
  let quote: string[] | null = null;

  const endParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };
  const endList = () => {
    if (list) blocks.push({ type: 'list', ordered: list.ordered, start: list.start, items: list.items.map((item) => parseInline(item)) });
    list = null;
  };
  const endQuote = () => {
    if (quote) blocks.push({ type: 'quote', children: parseMarkdown(quote.join('\n')) });
    quote = null;
  };
  const endAll = () => (endParagraph(), endList(), endQuote());

  for (const line of lines) {
    const quoted = QUOTE.exec(line);
    if (quoted) {
      endParagraph();
      endList();
      (quote ??= []).push(quoted[1]!);
      continue;
    }
    if (quote && line.trim()) {
      // A line straight after a quote continues it ("lazy" continuation).
      quote.push(line);
      continue;
    }
    endQuote();
    if (!line.trim()) {
      endParagraph();
      endList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      endAll();
      const children = parseInline(heading[2]!);
      blocks.push({ type: 'heading', level: Math.min(Math.max(heading[1]!.length, 2), 4) as 2 | 3 | 4, children, id: headingId(plainText(children)) });
      continue;
    }
    if (RULE.test(line)) {
      endAll();
      blocks.push({ type: 'rule' });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      endParagraph();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) endList();
      list ??= { ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      list.items.push(bullet ? bullet[1]! : numbered![2]!);
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      // An indented line belongs to the list item above it.
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      continue;
    }
    endList();
    paragraph.push(line.trim());
  }
  endAll();
  return blocks;
}

/** The words of an inline tree, for headings' anchors, excerpts and search snippets. */
export function plainText(nodes: MdInline[]): string {
  return nodes.map((n) => (n.type === 'text' || n.type === 'code' ? n.text : n.type === 'break' ? ' ' : plainText(n.children))).join('');
}

/** A Markdown document as plain words (for excerpts and meta descriptions). */
export function markdownToText(source: string | null | undefined, maxLength = 300): string {
  const words = parseMarkdown(source)
    .map(function text(b: MdBlock): string {
      if (b.type === 'heading' || b.type === 'paragraph') return plainText(b.children);
      if (b.type === 'list') return b.items.map(plainText).join(' ');
      if (b.type === 'quote') return b.children.map(text).join(' ');
      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return words.length > maxLength ? `${words.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…` : words;
}
