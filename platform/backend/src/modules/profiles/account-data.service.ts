import { Injectable } from '@nestjs/common';

type Exporter = (userId: string) => Promise<unknown>;

/**
 * Registry for "download my data". Each module registers the personal data it owns, so the export
 * stays complete as features are added.
 */
@Injectable()
export class AccountDataService {
  private readonly exporters = new Map<string, Exporter>();

  register(section: string, exporter: Exporter): void {
    this.exporters.set(section, exporter);
  }

  async export(userId: string): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), format: 'boikonika-account-export/1' };
    for (const [section, exporter] of this.exporters) out[section] = await exporter(userId);
    return out;
  }
}
