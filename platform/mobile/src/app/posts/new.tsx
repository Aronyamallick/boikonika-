import { COMPOSER_POST_TYPES, MAX_POST_LENGTH, MAX_QUOTE_LENGTH, radius, spacing, VISIBILITIES, type BookTag, type ComposerPostType } from '@boikonika/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Cover } from '@/components/books';
import { Chips } from '@/components/chips';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { useToast } from '@/components/toast';
import { Button, Field, Input, Screen, Text } from '@/components/ui';
import { api, apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { useTheme } from '@/lib/theme';

/** Artwork needs an image upload, which the website offers; everything else can be written here. */
const TYPES = COMPOSER_POST_TYPES.filter((type) => type !== 'artwork');

export default function NewPostScreen() {
  const t = useTranslations();
  const { c } = useTheme();
  const toast = useToast();
  const { status } = useAuth();
  const [type, setType] = useState<ComposerPostType>('discussion');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [quoteSource, setQuoteSource] = useState('');
  const [percent, setPercent] = useState('');
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]>('public');
  const [book, setBook] = useState<BookTag | null>(null);
  const [bookQuery, setBookQuery] = useState('');
  const [found, setFound] = useState<BookTag[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (bookQuery.trim().length < 2) return setFound([]);
    const handle = setTimeout(() => api<BookTag[]>('/community/books', { query: { q: bookQuery } }).then(setFound, () => setFound([])), 250);
    return () => clearTimeout(handle);
  }, [bookQuery]);

  if (status !== 'authenticated') return <Screen><SignInPrompt text={t('community.joinPrompt')} /></Screen>;

  const post = async () => {
    setPosting(true);
    setErrors({});
    try {
      const form = new FormData();
      form.append(
        'data',
        JSON.stringify({
          type,
          title: title.trim() || undefined,
          body,
          bookId: book?.id,
          quoteSource: type === 'quote' ? quoteSource.trim() || undefined : undefined,
          readingPercent: type === 'reading_progress' && percent ? Number(percent) : undefined,
          visibility,
        }),
      );
      const res = await apiRequest('/posts', { method: 'POST', body: form });
      toast(res.message);
      router.back();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast(errorMessage(error, t), 'danger');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Screen>
      <Field label={t('community.whatKind')}>{() => <Chips label={t('community.whatKind')} value={type} onChange={setType} options={TYPES.map((v) => ({ value: v, label: t(`community.types.${v}`) }))} />}</Field>
      {type !== 'quote' && type !== 'reading_progress' ? <Field label={t('community.titleLabel')} error={errors.title}>{(a) => <Input {...a} value={title} onChangeText={setTitle} maxLength={200} />}</Field> : null}
      <Field label={type === 'quote' ? t('community.quoteLabel') : t('community.bodyLabel')} hint={type === 'quote' ? t('community.quoteHint') : undefined} error={errors.body} required>
        {(a) => <Input {...a} value={body} onChangeText={setBody} placeholder={t(`community.placeholders.${type}` as 'community.placeholders.discussion')} multiline maxLength={type === 'quote' ? MAX_QUOTE_LENGTH : MAX_POST_LENGTH} style={{ minHeight: 160 }} />}
      </Field>
      {type === 'quote' ? (
        <Field label={t('community.quoteSource')} hint={t('community.quoteSourceHint')} error={errors.quoteSource}>
          {(a) => <Input {...a} value={quoteSource} onChangeText={setQuoteSource} maxLength={200} />}
        </Field>
      ) : null}

      <Field label={type === 'reading_progress' ? t('community.whichBook') : t('community.tagBook')} error={errors.bookId} required={type === 'reading_progress'}>
        {(a) =>
          book ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[2], borderRadius: radius.md, backgroundColor: c.bgSubtle }}>
              <Cover uri={book.coverUrl} title={book.title} width={36} rounded={4} />
              <Text size="sm" weight="semibold" style={{ flex: 1 }} numberOfLines={2}>
                {book.title}
              </Text>
              <Button small variant="ghost" title={t('community.removeBook')} onPress={() => setBook(null)} />
            </View>
          ) : (
            <View style={{ gap: spacing[2] }}>
              <Input {...a} value={bookQuery} onChangeText={setBookQuery} placeholder={t('community.findBook')} autoCorrect={false} />
              {found.slice(0, 5).map((b) => (
                <Pressable key={b.id} accessibilityRole="button" onPress={() => (setBook(b), setBookQuery(''), setFound([]))} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 48 }}>
                  <Cover uri={b.coverUrl} title={b.title} width={28} rounded={4} />
                  <View style={{ flex: 1 }}>
                    <Text size="sm" numberOfLines={1}>
                      {b.title}
                    </Text>
                    <Text size="xs" tone="muted" numberOfLines={1}>
                      {b.authors.join(', ')}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        }
      </Field>
      {type === 'reading_progress' ? (
        <Field label={t('community.howFar')} error={errors.readingPercent} required>
          {(a) => <Input {...a} value={percent} onChangeText={setPercent} keyboardType="number-pad" maxLength={3} placeholder="%" />}
        </Field>
      ) : null}

      <Field label={t('community.whoCanSee')}>{() => <Chips label={t('community.whoCanSee')} value={visibility} onChange={setVisibility} options={VISIBILITIES.map((v) => ({ value: v, label: t(`community.visibility.${v}`) }))} />}</Field>
      <Text size="sm" tone="muted">
        {t('community.guidelinesShort')}
      </Text>
      <Button title={t('community.post')} loading={posting} disabled={!body.trim()} onPress={post} />
    </Screen>
  );
}
