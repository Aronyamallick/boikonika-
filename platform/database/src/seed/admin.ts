import { hash } from '@node-rs/argon2';
import { ARGON2_OPTIONS, passwordProblems } from '@boikonika/shared';
import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import { auditLogs, userProfiles, userRoles, users } from '../schema';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates the first super admin from SEED_ADMIN_* environment variables. Idempotent: when the
 * account already exists it only makes sure the super_admin role is present and never touches the
 * password, so re-running the seed cannot reset a changed password.
 */
export async function seedSuperAdmin(db: Database, log: (message: string) => void): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    log('super admin: skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)');
    return;
  }
  if (!EMAIL_RE.test(email)) throw new Error('SEED_ADMIN_EMAIL is not a valid email address');
  const problems = passwordProblems(password);
  if (problems.length || password.length < 12) {
    throw new Error(`SEED_ADMIN_PASSWORD is too weak (${[...problems, password.length < 12 ? 'admin passwords need 12+ characters' : ''].filter(Boolean).join(', ')})`);
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    await db.insert(userRoles).values({ userId: existing.id, role: 'super_admin' }).onConflictDoNothing();
    log(`super admin: ${email} already exists (role ensured, password unchanged)`);
    return;
  }

  const username = (process.env.SEED_ADMIN_USERNAME ?? 'admin').trim();
  const displayName = (process.env.SEED_ADMIN_NAME ?? 'Boikonika Admin').trim();
  const passwordHash = await hash(password, ARGON2_OPTIONS);
  await db.transaction(async (tx) => {
    const now = new Date();
    const [user] = await tx
      .insert(users)
      .values({ email, username, displayName, passwordHash, emailVerifiedAt: now, onboardedAt: now, locale: 'bn' })
      .returning({ id: users.id });
    await tx.insert(userProfiles).values({ userId: user!.id, profileVisibility: 'private' });
    await tx.insert(userRoles).values([{ userId: user!.id, role: 'super_admin' }]);
    await tx.insert(auditLogs).values({ actorId: null, action: 'user.create_super_admin', entityType: 'user', entityId: user!.id, after: { email, username, source: 'seed' } });
  });
  log(`super admin: created ${email} (username "${username}") — enable two-step verification after the first login`);
}
