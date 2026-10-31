'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** WAI-ARIA tabs with roving focus (←/→/Home/End). */
export function Tabs({ tabs, defaultIndex = 0, className }: { tabs: Array<{ label: ReactNode; content: ReactNode }>; defaultIndex?: number; className?: string }) {
  const [active, setActive] = useState(defaultIndex);
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: KeyboardEvent) => {
    const last = tabs.length - 1;
    const next = e.key === 'ArrowRight' ? (active === last ? 0 : active + 1) : e.key === 'ArrowLeft' ? (active === 0 ? last : active - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line" onKeyDown={onKey}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              active === i ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={i} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={active !== i} className="pt-4">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
