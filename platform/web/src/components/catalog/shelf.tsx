import type { ReactNode } from 'react';
import { SectionHeader } from '@/components/ui/section-header';
import { cn } from '@/lib/cn';

/** Horizontally scrolling row (snap scrolling on touch) under a section heading. */
export function Shelf({
  id,
  title,
  subtitle,
  href,
  linkLabel,
  children,
  itemClassName = 'w-36 sm:w-40',
  contained = true,
  className,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  linkLabel?: string;
  children: ReactNode[];
  itemClassName?: string;
  /** False when the shelf sits inside a page that already has the page container. */
  contained?: boolean;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn(contained && 'container-page', 'py-6', className)}>
      <SectionHeader id={id} title={title} description={subtitle} href={href} linkLabel={linkLabel} />
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:px-0">
        {children.map((child, i) => (
          <li key={i} className={cn('flex shrink-0 snap-start', itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Responsive card grid for listing pages. */
export function CardGrid({ children, className }: { children: ReactNode[]; className?: string }) {
  return (
    <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6', className)}>
      {children.map((child, i) => (
        <li key={i} className="flex">
          {child}
        </li>
      ))}
    </ul>
  );
}
