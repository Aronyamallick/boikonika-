'use client';

import { ACADEMIC_LEVELS, STUDY_SUBJECTS } from '@boikonika/shared';
import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { QuizCard } from '@/components/student/quiz-card';
import { Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/states';
import { api } from '@/lib/api/client';
import type { QuizCard as Quiz } from '@/lib/student';

export function QuizBrowser({ initial }: { initial: Quiz[] }) {
  const t = useTranslations();
  const { status } = useAuth();
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [items, setItems] = useState(initial);
  const first = useRef(true);
  useEffect(() => {
    if (first.current && status !== 'authenticated' && !subject && !level) return;
    first.current = false;
    api<Quiz[]>('/quizzes', { query: { subject: subject || undefined, level: level || undefined, pageSize: 48 } }).then(setItems, () => undefined);
  }, [subject, level, status]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <label htmlFor="quiz-subject" className="sr-only">
          {t('community.subject')}
        </label>
        <Select id="quiz-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto">
          <option value="">{t('student.allSubjects')}</option>
          {STUDY_SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {t(`subjects.${s}`)}
            </option>
          ))}
        </Select>
        <label htmlFor="quiz-level" className="sr-only">
          {t('student.level')}
        </label>
        <Select id="quiz-level" value={level} onChange={(e) => setLevel(e.target.value)} className="w-auto">
          <option value="">{t('student.allLevels')}</option>
          {ACADEMIC_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`student.levels.${l}`)}
            </option>
          ))}
        </Select>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<HelpCircle className="h-6 w-6" />} title={t('student.noQuizzes')} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((q) => (
            <li key={q.id}>
              <QuizCard quiz={q} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
