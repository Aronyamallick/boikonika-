import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { prefs } from './storage';

const TOKEN_KEY = 'bk.pushToken';

// Notices that arrive while the app is open still show as a banner; no badge counts are set.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export type PushState = 'on' | 'off' | 'denied' | 'unavailable';

/** Push needs a real device and the EAS project the build was made with (it routes Expo's push service). */
const projectId = (): string | undefined => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
export const pushAvailable = () => Platform.OS !== 'web' && Device.isDevice && !!projectId();

export async function pushState(): Promise<PushState> {
  if (!pushAvailable()) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'denied') return 'denied';
  return status === 'granted' && (await prefs.get<string>(TOKEN_KEY)) ? 'on' : 'off';
}

/**
 * Asks once for permission (only when the reader turns push on — never at launch), gets this
 * phone's Expo push token and registers it with the account.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushAvailable()) return 'unavailable';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Boikonika', importance: Notifications.AndroidImportance.DEFAULT });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  await api('/me/push-subscriptions', { method: 'POST', body: { kind: 'expo', endpoint: token } });
  await prefs.set(TOKEN_KEY, token);
  return 'on';
}

/** Stops push to this phone (also called on sign-out so the next person doesn't get the notices). */
export async function disablePush(): Promise<void> {
  const token = await prefs.get<string>(TOKEN_KEY);
  if (!token) return;
  await api('/me/push-subscriptions', { method: 'DELETE', body: { endpoint: token } }).catch(() => undefined);
  await prefs.remove(TOKEN_KEY);
}
