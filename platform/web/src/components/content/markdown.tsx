import { parseMarkdown, type MdBlock, type MdInline } from '@boikonika/shared';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * Renders staff-written Markdown as React elements. The parser returns a tree, never HTML, so text
 * can't inject markup; links are limited to site paths, anchors, web and mail addresses.
 */
export function Markdown({ source, className, compact }: { source: string | null | undefined; className?: string; compact?: boolean }) {
  const blocks = parseMarkdown(source);
  return <div className={cn('text-fg', compact ? 'space-y-2 text-sm leading-relaxed' : 'space-y-4 leading-relaxed sm:text-[1.05rem]', className)}>{blocks.map((b, i) => block(b, i, compact))}</div>;
}

/** The page's second-level headings, for a table of contents. */
export function headings(source: string | null | undefined): Array<{ id: string; text: string }> {
  return parseMarkdown(source)
    .filter((b): b is Extract<MdBlock, { type: 'heading' }> => b.type === 'heading' && b.level === 2)
    .map((b) => ({ id: b.id, text: b.children.map(plain).join('') }));
}

function plain(n: MdInline): string {
  return n.type === 'text' || n.type === 'code' ? n.text : n.type === 'break' ? ' ' : n.children.map(plain).join('');
}

function block(b: MdBlock, key: number, compact?: boolean): ReactNode {
  switch (b.type) {
    case 'heading': {
      const Tag = `h${b.level}` as 'h2' | 'h3' | 'h4';
      const size = compact ? 'text-base' : b.level === 2 ? 'text-xl sm:text-2xl' : b.level === 3 ? 'text-lg' : 'text-base';
      return (
        <Tag key={key} id={b.id || undefined} className={cn('scroll-mt-24 font-bold text-fg', size, compact ? 'pt-1' : b.level === 2 ? 'pt-4' : 'pt-2')}>
          {inline(b.children)}
        </Tag>
      );
    }
    case 'paragraph':
      return <p key={key}>{inline(b.children)}</p>;
    case 'list': {
      const items = b.items.map((item, i) => (
        <li key={i} className="pl-1">
          {inline(item)}
        </li>
      ));
      return b.ordered ? (
        <ol key={key} start={b.start} className="list-decimal space-y-1.5 pl-6 marker:text-fg-subtle">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-1.5 pl-6 marker:text-fg-subtle">
          {items}
        </ul>
      );
    }
    case 'quote':
      return (
        <blockquote key={key} className="space-y-2 border-l-4 border-primary/50 bg-subtle py-2 pl-4 pr-3 text-fg-muted">
          {b.children.map((c, i) => block(c, i, compact))}
        </blockquote>
      );
    case 'rule':
      return <hr key={key} className="my-6 border-line" />;
  }
}

function inline(nodes: MdInline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text':
        return n.text;
      case 'strong':
        return (
          <strong key={i} className="font-semibold text-fg">
            {inline(n.children)}
          </strong>
        );
      case 'em':
        return <em key={i}>{inline(n.children)}</em>;
      case 'code':
        return (
          <code key={i} className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[0.9em]">
            {n.text}
          </code>
        );
      case 'break':
        return <br key={i} />;
      case 'link': {
        const cls = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';
        if (n.href.startsWith('/'))
          return (
            <Link key={i} href={n.href} className={cls}>
              {inline(n.children)}
            </Link>
          );
        return (
          <a key={i} href={n.href} className={cls} {...(n.href.startsWith('#') || n.href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
            {inline(n.children)}
          </a>
        );
      }
    }
  });
}
