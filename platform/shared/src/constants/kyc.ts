import type { Role } from './roles';
import type { KycDocumentType, KycPurpose } from './statuses';

export interface KycRequirement {
  /** Roles that may be requested with this purpose. */
  roles: Role[];
  /** Each inner list is "one of these"; every group must be satisfied. */
  required: KycDocumentType[][];
  optional: KycDocumentType[];
  /** Business/institution name is required for these purposes. */
  needsOrganisation: boolean;
}

const IDENTITY: KycDocumentType[] = ['nid', 'passport', 'driving_license'];

/** What each verification needs. Shared by the API (enforcement) and the apps (forms and help text). */
export const KYC_REQUIREMENTS: Record<KycPurpose, KycRequirement> = {
  seller: { roles: ['book_seller', 'general_seller'], required: [IDENTITY], optional: ['trade_license', 'tin', 'selfie'], needsOrganisation: false },
  author: { roles: ['author'], required: [IDENTITY], optional: ['selfie'], needsOrganisation: false },
  publisher: { roles: ['publisher'], required: [IDENTITY, ['trade_license', 'publisher_document']], optional: ['tin'], needsOrganisation: true },
  student: { roles: ['student'], required: [['student_id']], optional: IDENTITY, needsOrganisation: false },
  teacher: { roles: ['teacher'], required: [['teacher_id']], optional: IDENTITY, needsOrganisation: false },
  institution: { roles: ['institution'], required: [['institution_document'], IDENTITY], optional: ['trade_license', 'tin'], needsOrganisation: true },
};

/** Document types that carry a number we store (encrypted, last 4 visible). */
export const KYC_NUMBERED_DOCUMENTS: readonly KycDocumentType[] = ['nid', 'passport', 'driving_license', 'trade_license', 'tin', 'student_id', 'teacher_id'];

/** Bangladesh NID numbers have 10, 13 or 17 digits. */
export function isValidNid(value: string): boolean {
  return /^(\d{10}|\d{13}|\d{17})$/.test(value);
}

export const KYC_UPLOAD = {
  maxFiles: 6,
  maxBytes: 8 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
} as const;

/** Missing document groups for a set of uploaded types (empty when complete). */
export function missingKycDocuments(purpose: KycPurpose, uploaded: readonly KycDocumentType[]): KycDocumentType[][] {
  return KYC_REQUIREMENTS[purpose].required.filter((group) => !group.some((type) => uploaded.includes(type)));
}
