import { type ClubCard as Club } from '@boikonika/shared';
import { Stack } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { Chips } from '@/components/chips';
import { ClubCard } from '@/components/community';
import { List } from '@/components/list';
import { EmptyState, ErrorState, Input, Loading, OfflineNotice } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useInfinite } from '@/lib/use-api';

type Filter = 'all' | 'reading' | 'study' | 'mine';

export default function ClubsScreen() {
  const t = useTranslations('clubs');
  const { status } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const clubs = useInfinite<Club>('/clubs', { persist: !search, query: { q: search || undefined, purpose: filter === 'reading' || filter === 'study' ? filter : undefined, mine: filter === 'mine' ? 'true' : undefined } });
  const options: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: t('allTypes') },
    { value: 'reading', label: t('purposes.reading') },
    { value: 'study', label: t('purposes.study') },
    ...(status === 'authenticated' ? [{ value: 'mine' as Filter, label: t('myClubs') }] : []),
  ];
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <List
        data={clubs.items}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ClubCard club={item} />}
        refreshing={clubs.refreshing}
        onRefresh={clubs.reload}
        onEndReached={clubs.loadMore}
        loadingMore={clubs.loadingMore}
        header={
          <>
            <Input value={q} onChangeText={setQ} onSubmitEditing={() => setSearch(q.trim())} placeholder={t('search')} accessibilityLabel={t('search')} returnKeyType="search" />
            <Chips label={t('type')} value={filter} onChange={setFilter} options={options} />
            {clubs.offline ? <OfflineNotice /> : null}
          </>
        }
        empty={clubs.loading ? <Loading /> : clubs.error ? <ErrorState offline={clubs.error.code === 'NETWORK'} onRetry={clubs.reload} /> : <EmptyState icon={Users} title={filter === 'mine' ? t('noMine') : t('none')} />}
      />
    </>
  );
}
