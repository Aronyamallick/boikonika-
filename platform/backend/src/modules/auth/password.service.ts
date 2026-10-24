import { Injectable, OnModuleInit } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { ARGON2_OPTIONS } from '@boikonika/shared';

/** Argon2id hashing (OWASP parameters from the shared package). */
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    // Used when the account does not exist so the response time does not reveal that.
    this.dummyHash = await this.hash(randomBytes(16).toString('hex'));
  }

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string | null | undefined, password: string): Promise<boolean> {
    if (!passwordHash) {
      await this.burn(password);
      return false;
    }
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Spends the same time as a real verification. */
  async burn(password: string): Promise<void> {
    await verify(this.dummyHash || (await this.hash('x')), password).catch(() => false);
  }

  /** True when the stored hash uses weaker parameters than the current policy. */
  needsRehash(passwordHash: string): boolean {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(passwordHash);
    if (!match) return true;
    const [, m, t, p] = match.map(Number);
    return m! < ARGON2_OPTIONS.memoryCost || t! < ARGON2_OPTIONS.timeCost || p! !== ARGON2_OPTIONS.parallelism;
  }
}
