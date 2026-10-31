import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

export function SectionHeader({ title, href, linkLabel, description, id }: { title: ReactNode; href?: string; linkLabel?: string; description?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-xl font-bold text-fg sm:text-2xl">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {linkLabel}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
