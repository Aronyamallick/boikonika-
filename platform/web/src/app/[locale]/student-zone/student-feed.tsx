'use client';

import { STUDY_SUBJECTS, type StudySubject } from '@boikonika/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Composer } from '@/components/community/composer';
import { PostFeed } from '@/components/community/post-feed';
import { Select } from '@/components/ui/field';
import type { PostView } from '@/lib/community';

/** Student Zone posts (study tips, questions, notes), filterable by subject. */
export function StudentFeed() {
  const t = useTranslations();
  const [subject, setSubject] = useState<StudySubject | ''>('');
  const [mine, setMine] = useState<PostView[]>([]);
  return (
    <div className="space-y-4">
      <Composer studentZone defaultSubject={subject || undefined} onPosted={(p) => setMine((l) => [p, ...l])} />
      <div className="flex items-center gap-2">
        <label htmlFor="student-subject" className="text-sm font-semibold text-fg">
          {t('community.subject')}
        </label>
        <Select id="student-subject" value={subject} onChange={(e) => setSubject(e.target.value as StudySubject | '')} className="h-9 w-auto py-0 text-sm">
          <option value="">{t('student.allSubjects')}</option>
          {STUDY_SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {t(`subjects.${s}`)}
            </option>
          ))}
        </Select>
      </div>
      <PostFeed endpoint="/feed" query={{ tab: 'latest', studentZone: 'true', subject: subject || undefined }} prepend={mine} label={t('student.feed')} empty={t('student.feedEmpty')} />
    </div>
  );
}
