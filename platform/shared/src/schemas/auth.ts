import { z } from 'zod';
import { bdPhoneSchema, contactSchema, displayNameSchema, emailSchema, identifierSchema, localeSchema, otpCodeSchema, passwordSchema, usernameSchema } from './common';

export const OTP_REQUEST_PURPOSES = ['register', 'login', 'reset_password', 'verify_email', 'verify_phone'] as const;
export type OtpRequestPurpose = (typeof OTP_REQUEST_PURPOSES)[number];

/** Clients identify themselves so the API knows where the refresh token goes (cookie vs body). */
export const CLIENT_KINDS = ['web', 'android', 'ios'] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

const deviceFields = {
  /** Shown in "Active devices", e.g. "Chrome on Windows" or "Pixel 8". */
  deviceName: z.string().trim().max(160).optional(),
  /** Stable random id the client stores (cookie / SecureStore) — used for new-device alerts. */
  deviceId: z.string().trim().regex(/^[A-Za-z0-9_-]{16,64}$/).optional(),
  client: z.enum(CLIENT_KINDS).default('web'),
  rememberDevice: z.boolean().default(true),
};

export const otpRequestSchema = z.object({
  target: contactSchema,
  purpose: z.enum(OTP_REQUEST_PURPOSES),
  locale: localeSchema.optional(),
});
export type OtpRequestInput = z.input<typeof otpRequestSchema>;

/** Registration needs the code sent to the email or phone first (proves the contact is real). */
export const registerSchema = z.object({
  name: displayNameSchema,
  target: contactSchema,
  code: otpCodeSchema,
  password: passwordSchema,
  username: usernameSchema.optional(),
  acceptTerms: z.literal(true, { error: 'validation.acceptTerms' }),
  /** Readers can say they are students up front; other roles are applied for later. */
  isStudent: z.boolean().default(false),
  locale: localeSchema.optional(),
  ...deviceFields,
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string({ error: 'validation.required' }).min(1, { error: 'validation.required' }).max(128),
  ...deviceFields,
});
export type LoginInput = z.input<typeof loginSchema>;

export const otpLoginSchema = z.object({ target: contactSchema, code: otpCodeSchema, ...deviceFields });
export type OtpLoginInput = z.input<typeof otpLoginSchema>;

export const twoFactorLoginSchema = z
  .object({
    challengeToken: z.string().min(20).max(2000),
    code: otpCodeSchema.optional(),
    recoveryCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/, { error: 'validation.recoveryCode' })
      .optional(),
  })
  .refine((v) => !!v.code !== !!v.recoveryCode, { error: 'validation.otp', path: ['code'] });
export type TwoFactorLoginInput = z.input<typeof twoFactorLoginSchema>;

export const googleLoginSchema = z.object({ idToken: z.string().min(100).max(5000), ...deviceFields });
export type GoogleLoginInput = z.input<typeof googleLoginSchema>;

/** Mobile apps send the refresh token in the body; browsers use the HTTP-only cookie. */
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200).optional() });

export const forgotPasswordSchema = z.object({ target: contactSchema, locale: localeSchema.optional() });
export const resetPasswordSchema = z.object({ target: contactSchema, code: otpCodeSchema, password: passwordSchema });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  /** Optional only for accounts created with Google that never had a password. */
  currentPassword: z.string().max(128).optional(),
  newPassword: passwordSchema,
  signOutOtherDevices: z.boolean().default(true),
});

export const verifyContactSchema = z.object({ target: contactSchema, code: otpCodeSchema });

export const twoFactorEnableSchema = z.object({ code: otpCodeSchema });
export const twoFactorDisableSchema = z.object({ password: z.string().max(128).optional(), code: otpCodeSchema });

export const logoutAllSchema = z.object({ keepCurrent: z.boolean().default(false) });

export const updateContactSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('email'), email: emailSchema }),
  z.object({ kind: z.literal('phone'), phone: bdPhoneSchema }),
]);

/** What the API returns after any successful sign-in. */
export interface AuthTokens {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  /** Only for mobile clients; web clients receive it as an HTTP-only cookie. */
  refreshToken?: string;
}

export interface AuthUser {
  id: string;
  displayName: string;
  username: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatarUrl: string | null;
  locale: string;
  theme: string;
  roles: string[];
  permissions: string[];
  twoFactorEnabled: boolean;
  hasPassword: boolean;
  onboarded: boolean;
  personalizationEnabled: boolean;
  createdAt: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

/** Returned instead of AuthResult when the account has two-step verification on. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
  expiresIn: number;
}

export interface OtpSentResult {
  /** Masked destination, e.g. "017****5678" or "r***@gmail.com". */
  sentTo: string;
  expiresIn: number;
  resendIn: number;
}
