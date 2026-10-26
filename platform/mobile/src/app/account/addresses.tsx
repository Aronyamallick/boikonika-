import { spacing, type Address } from '@boikonika/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MapPin, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { AddressForm, AddressLines } from '@/components/address';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, Screen } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { useApi } from '@/lib/use-api';

export default function AddressesScreen() {
  const t = useTranslations();
  const toast = useToast();
  const { status } = useAuth();
  const params = useLocalSearchParams<{ add?: string }>();
  const list = useApi<Address[]>(status === 'authenticated' ? '/me/addresses' : null);
  const [editing, setEditing] = useState<Address | 'new' | null>(params.add ? 'new' : null);

  if (status === 'anonymous') return <Screen><SignInPrompt /></Screen>;
  if (list.loading && !list.data) return <Loading />;

  const remove = (a: Address) =>
    Alert.alert(t('addresses.confirmDelete'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('addresses.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            toast((await apiRequest(`/me/addresses/${a.id}`, { method: 'DELETE' })).message || t('addresses.deleted'));
            list.reload();
          } catch (error) {
            toast(errorMessage(error, t), 'danger');
          }
        },
      },
    ]);

  const saved = () => {
    setEditing(null);
    list.reload();
    // Opened from checkout: go straight back with the new address selected there.
    if (params.add && router.canGoBack()) router.back();
  };

  return (
    <Screen refreshing={list.refreshing} onRefresh={list.reload}>
      <Stack.Screen options={{ title: editing === 'new' ? t('addresses.add') : editing ? t('addresses.edit') : t('addresses.title') }} />
      {editing ? (
        <AddressForm initial={editing === 'new' ? undefined : editing} onSaved={saved} onCancel={() => setEditing(null)} />
      ) : (
        <>
          {list.error && !list.data ? <ErrorState offline={list.error.code === 'NETWORK'} onRetry={list.reload} /> : null}
          {list.data?.length === 0 ? <EmptyState icon={MapPin} title={t('addresses.empty')} text={t('addresses.text')} /> : null}
          {list.data?.map((a) => (
            <Card key={a.id} style={{ gap: spacing[2] }}>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                <Badge label={t(`addresses.labels.${a.label}`)} tone="primary" />
                {a.isDefault ? <Badge label={t('addresses.default')} tone="success" /> : null}
              </View>
              <AddressLines address={a} />
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                <Button small variant="outline" title={t('common.edit')} onPress={() => setEditing(a)} />
                <Button small variant="ghost" title={t('addresses.delete')} onPress={() => remove(a)} />
              </View>
            </Card>
          ))}
          <Button icon={Plus} title={t('addresses.add')} onPress={() => setEditing('new')} />
        </>
      )}
    </Screen>
  );
}
