import { z } from 'zod';
import { BROADCAST_AUDIENCES, NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from '../constants/statuses';

export const notificationListQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z
    .enum(['1', 'true', '0', 'false'])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
});

export const notificationPreferencesSchema = z.object({
  preferences: z
    .array(z.object({ type: z.enum(NOTIFICATION_TYPES), channel: z.enum(NOTIFICATION_CHANNELS), enabled: z.boolean() }))
    .min(1)
    .max(NOTIFICATION_TYPES.length * NOTIFICATION_CHANNELS.length),
});

/** A browser Web Push subscription (PushSubscription.toJSON()) or an Expo push token from the app. */
export const pushSubscriptionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('web'),
    endpoint: z.url({ protocol: /^https$/, error: 'validation.httpsUrl' }).max(1000),
    keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }),
  }),
  z.object({ kind: z.literal('expo'), endpoint: z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/, { error: 'validation.invalidChoice' }) }),
]);

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().min(10).max(1000) });

const bilingual = (min: number, max: number) =>
  z.object({
    bn: z.string().trim().min(min, { error: 'validation.required' }).max(max, { error: 'validation.maxLength' }),
    en: z.string().trim().min(min, { error: 'validation.required' }).max(max, { error: 'validation.maxLength' }),
  });

/** A staff announcement, written in both languages so each reader gets their own. */
export const broadcastSchema = z.object({
  title: bilingual(3, 120),
  body: bilingual(3, 500),
  link: z
    .string()
    .trim()
    .regex(/^\/[A-Za-z0-9/_\-?=&.%]*$/, { error: 'validation.invalidChoice' })
    .max(300)
    .optional(),
  audience: z.enum(BROADCAST_AUDIENCES).default('everyone'),
});
export type BroadcastInput = z.input<typeof broadcastSchema>;
