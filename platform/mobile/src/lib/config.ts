import { Platform } from 'react-native';

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL for each build (e.g. https://api.boikonika.com).
 * In development an Android emulator reaches the host machine at 10.0.2.2.
 */
const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fallback).replace(/\/$/, '');
/** The website, for links that open in the browser (payments, policies shared from the app). */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://boikonika.com').replace(/\/$/, '');
