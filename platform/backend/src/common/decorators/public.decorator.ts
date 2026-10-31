import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Marks a route as reachable without an access token (the auth guard still attaches the user if one is sent). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
