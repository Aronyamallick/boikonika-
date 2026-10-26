import { getRandomBytes } from 'expo-crypto';

/** A random key per checkout attempt, so a retried "Place order" can never create a second order. */
export const idempotencyKey = () => `chk_${Array.from(getRandomBytes(18), (b) => b.toString(16).padStart(2, '0')).join('')}`;
