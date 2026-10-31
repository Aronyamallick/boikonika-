'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

export interface ColumnDatum {
  /** Stable key (e.g. ISO day). */
  key: string;
  /** Short category label for the axis and tooltip (already localized). */
  label: string;
  value: number;
  /** Formatted value for the tooltip and table (already localized). */
  display: string;
}

const PLOT_HEIGHT = 168;
const AXIS_HEIGHT = 28;
const TOP = 10;
const LEFT = 44;
const RIGHT = 8;
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;

/** 1/2/5 × 10ⁿ steps so ticks land on clean numbers; whole-number series never get fractional ticks. */
function ticksFor(max: number, integer: boolean): number[] {
  const raw = Math.max(max, integer ? 1 : 0.01) / 4;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
  if (integer) step = Math.max(1, Math.ceil(step));
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}

/** Column with a 4px rounded data-end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Single-series column chart (one measure over days). Thin columns from one baseline, hairline grid,
 * a per-column tooltip on hover and keyboard focus (←/→/Home/End), and a table view of the same values.
 * While `stale`, the previous render stays visible at reduced opacity.
 */
export function ColumnChart({
  title,
  subtitle,
  data,
  integer = false,
  categoryLabel,
  emptyText,
  stale = false,
  className,
}: {
  title: string;
  subtitle?: string;
  data: ColumnDatum[];
  integer?: boolean;
  categoryLabel: string;
  emptyText?: string;
  stale?: boolean;
  className?: string;
}) {
  const t = useTranslations('dashboard');
  const format = useFormatter();
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [table]);

  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = ticksFor(max, integer);
  const top = ticks[ticks.length - 1]!;
  const plotWidth = width - LEFT - RIGHT;
  const band = data.length ? plotWidth / data.length : plotWidth;
  const barWidth = Math.max(1, Math.min(MAX_BAR, band - GAP));
  const y = (v: number) => TOP + PLOT_HEIGHT - (v / top) * PLOT_HEIGHT;
  const center = (i: number) => LEFT + i * band + band / 2;
  // About six date labels, anchored on the latest day.
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotWidth / 90))));
  const empty = max === 0;
  const current = active !== null ? data[active] : undefined;

  const onKey = (e: KeyboardEvent) => {
    if (!data.length) return;
    const last = data.length - 1;
    const from = active ?? last;
    const next = e.key === 'ArrowRight' ? Math.min(last, from + 1) : e.key === 'ArrowLeft' ? Math.max(0, from - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  const tickText = (v: number) => format.number(v, { notation: 'compact', maximumFractionDigits: 1 });

  return (
    <figure className={cn('rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <figcaption>
          <span className="block font-bold text-fg">{title}</span>
          {subtitle ? <span className="block text-sm text-fg-muted">{subtitle}</span> : null}
        </figcaption>
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          aria-pressed={table}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-fg-muted hover:bg-subtle hover:text-fg"
        >
          {table ? t('showChart') : t('showTable')}
        </button>
      </div>

      {table ? (
        <div className={cn('max-h-72 overflow-auto rounded-lg border border-line transition-opacity', stale && 'opacity-50')}>
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface-sunken text-left text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {categoryLabel}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  {title}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((d) => (
                <tr key={d.key}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-fg-muted">
                    {d.label}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums text-fg">{d.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={wrap}
          tabIndex={0}
          role="group"
          aria-roledescription={t('chart')}
          aria-label={title}
          aria-describedby={`${id}-hint`}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? (data.length ? data.length - 1 : null))}
          onBlur={() => setActive(null)}
          className={cn('relative rounded-md transition-opacity', stale && 'opacity-50')}
        >
          <span id={`${id}-hint`} className="sr-only">
            {t('chartHint')}
          </span>
          <span className="sr-only" aria-live="polite">
            {current ? `${current.label}: ${current.display}` : ''}
          </span>
          <svg width={width} height={TOP + PLOT_HEIGHT + AXIS_HEIGHT} aria-hidden="true" className="block overflow-visible" onPointerLeave={() => setActive(null)}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={LEFT} x2={width - RIGHT} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--color-line-strong)' : 'var(--color-line)'} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={LEFT - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-fg-muted text-[11px] tabular-nums">
                  {tickText(v)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const h = (d.value / top) * PLOT_HEIGHT;
              return h > 0 ? (
                <path
                  key={d.key}
                  d={columnPath(center(i) - barWidth / 2, y(d.value), barWidth, h)}
                  fill="var(--color-chart-1)"
                  className={cn('transition-[filter]', active === i && 'brightness-125')}
                />
              ) : null;
            })}
            {data.map((d, i) =>
              (data.length - 1 - i) % every === 0 ? (
                <text key={d.key} x={Math.min(Math.max(center(i), LEFT + 18), width - RIGHT - 18)} y={TOP + PLOT_HEIGHT + 18} textAnchor="middle" className="fill-fg-muted text-[11px]">
                  {d.label}
                </text>
              ) : null,
            )}
            {/* Hit targets span the whole band (taller and wider than the column). */}
            {data.map((d, i) => (
              <rect key={d.key} x={LEFT + i * band} y={TOP} width={band} height={PLOT_HEIGHT} fill="transparent" onPointerEnter={() => setActive(i)} onPointerMove={() => setActive(i)} />
            ))}
            {active !== null ? <line x1={center(active)} x2={center(active)} y1={TOP} y2={TOP + PLOT_HEIGHT} stroke="var(--color-line-strong)" strokeWidth={1} shapeRendering="crispEdges" pointerEvents="none" /> : null}
          </svg>
          {empty && emptyText ? <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-fg-muted">{emptyText}</p> : null}
          {current && active !== null ? (
            <div
              role="presentation"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm shadow-md"
              style={{ left: Math.min(Math.max(center(active), 70), width - 70), top: Math.max(y(current.value) - 8, 40) }}
            >
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded-full bg-chart-1" aria-hidden="true" />
                <span className="font-bold text-fg">{current.display}</span>
              </span>
              <span className="block text-xs text-fg-muted">{current.label}</span>
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}
