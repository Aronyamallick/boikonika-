import { api } from '@/lib/api/client';

export type { NotificationItem, NotificationPreferences } from '@boikonika/shared';

/** Fired after the inbox changes so the header bell refreshes its count. */
export const INBOX_CHANGED = 'bk:inbox-changed';
export const announceInboxChange = () => window.dispatchEvent(new Event(INBOX_CHANGED));

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyBytes(base64url: string): Uint8Array {
  const padded = `${base64url}${'='.repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Asks permission, subscribes this browser and registers it with the API. Returns false when the reader declined. */
export async function enablePush(): Promise<boolean> {
  const { publicKey } = await api<{ publicKey: string | null }>('/push/config', { auth: false });
  if (!publicKey || !pushSupported()) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
  const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api('/me/push-subscriptions', { method: 'POST', body: { kind: 'web', endpoint: json.endpoint, keys: json.keys } });
  return true;
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await api('/me/push-subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } }).catch(() => undefined);
  await subscription.unsubscribe();
}
