import type { Tone } from '@/components/ui/badge';

/** Badge colour for an account status, shared by the user list and the user page. */
export const USER_STATUS_TONE: Record<string, Tone> = { active: 'success', suspended: 'warning', banned: 'danger', deleted: 'neutral' };
