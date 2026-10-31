'use client';

import { Coffee, Pause, Play, Square, Timer } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { SessionDraft } from './log-reading-dialog';

const KEY = 'bk-reading-timer';
interface TimerState {
  /** Start of the current running stretch (ms), or null while paused. */
  runningSince: number | null;
  /** Milliseconds banked from earlier stretches. */
  banked: number;
  /** When the session first started (ISO) — sent with the log. */
  startedAt: string;
}

const read = (): TimerState | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
};
const write = (state: TimerState | null) => {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage may be unavailable (private mode); the timer still works for this page view.
  }
};

/**
 * Reading timer that survives reloads (kept in this browser). Stopping hands the minutes to the log
 * dialog. With a break reminder set, it suggests resting the eyes after that many minutes.
 */
export function ReadingTimer({ breakMinutes, onStop }: { breakMinutes: number | null; onStop: (draft: SessionDraft) => void }) {
  const t = useTranslations('library');
  const format = useFormatter();
  const [state, setState] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [breakDismissedAt, setBreakDismissedAt] = useState(0);

  useEffect(() => setState(read()), []);
  useEffect(() => {
    if (!state?.runningSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state?.runningSince]);

  const update = (next: TimerState | null) => {
    setState(next);
    write(next);
  };
  const elapsed = state ? state.banked + (state.runningSince ? now - state.runningSince : 0) : 0;
  const minutes = Math.floor(elapsed / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1000);
  const clock = `${format.number(minutes, { minimumIntegerDigits: 2 })}:${format.number(seconds, { minimumIntegerDigits: 2 })}`;
  const sinceBreak = minutes - breakDismissedAt;
  const needsBreak = !!breakMinutes && !!state?.runningSince && minutes > 0 && sinceBreak >= breakMinutes;

  if (!state) {
    return (
      <Button variant="secondary" onClick={() => update({ runningSince: Date.now(), banked: 0, startedAt: new Date().toISOString() })}>
        <Timer className="h-4 w-4" aria-hidden="true" />
        {t('startTimer')}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 shadow-sm">
        <span className={cn('h-2 w-2 rounded-full', state.runningSince ? 'animate-pulse bg-success' : 'bg-fg-subtle')} aria-hidden="true" />
        <span className="min-w-[4.5rem] text-lg font-bold tabular-nums text-fg" role="timer" aria-label={t('timerLabel')}>
          {clock}
        </span>
        {state.runningSince ? (
          <Button size="icon" variant="ghost" aria-label={t('pause')} onClick={() => update({ ...state, runningSince: null, banked: elapsed })}>
            <Pause className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="icon" variant="ghost" aria-label={t('resume')} onClick={() => update({ ...state, runningSince: Date.now() })}>
            <Play className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            update(null);
            setBreakDismissedAt(0);
            onStop({ minutes: Math.min(600, Math.max(1, Math.round(elapsed / 60_000))), startedAt: state.startedAt, source: 'timer' });
          }}
        >
          <Square className="h-3.5 w-3.5" aria-hidden="true" />
          {t('stopTimer')}
        </Button>
      </div>
      {needsBreak ? (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-soft-fg">
          <Coffee className="h-4 w-4" aria-hidden="true" />
          {t('breakReminder', { minutes: breakMinutes })}
          <button type="button" className="font-semibold underline" onClick={() => setBreakDismissedAt(minutes)}>
            {t('dismiss')}
          </button>
        </p>
      ) : null}
    </div>
  );
}
