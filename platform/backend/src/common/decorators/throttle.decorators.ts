import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLED = 'authThrottled';
/** Applies the stricter per-IP "auth" rate limit (AUTH_RATE_LIMIT_MAX per minute) to a route. */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLED, true);
