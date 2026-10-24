import { Inject, Injectable } from '@nestjs/common';
import { formatBdPhone, translate, type Locale } from '@boikonika/shared';
import type { DbOrTx } from '@boikonika/database';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { renderEmail } from './email-template';
import { OutboxService } from './outbox.service';

export type Contact = { kind: 'email' | 'phone'; value: string };

/** Builds and queues the platform's transactional emails and SMS in the recipient's language. */
@Injectable()
export class MessagesService {
  constructor(
    private readonly outbox: OutboxService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async sendOtp(contact: Contact, code: string, minutes: number, locale: Locale, tx?: DbOrTx): Promise<string> {
    const l = (key: string, params: Record<string, string | number> = {}) => translate(locale, key, params);
    if (contact.kind === 'phone') {
      return this.outbox.enqueue({ channel: 'sms', recipient: contact.value, body: l('api.messages.otpSms', { code, minutes }), template: 'otp', sensitive: true }, tx);
    }
    const subject = l('api.messages.otpEmailSubject', { code });
    const intro = l('api.messages.otpEmailIntro');
    const expiry = l('api.messages.otpEmailExpiry', { minutes });
    return this.outbox.enqueue(
      {
        channel: 'email',
        recipient: contact.value,
        subject,
        body: `${intro} ${code}\n\n${expiry}`,
        html: renderEmail({ title: l('api.messages.otpEmailTitle'), paragraphs: [intro], code, footer: `${expiry}\n${l('common.developedBy')}`, lang: locale }),
        template: 'otp',
        sensitive: true,
      },
      tx,
    );
  }

  /** Sent instead of a registration code when the contact already has an account (no account enumeration). */
  async sendAccountExists(contact: Contact, locale: Locale): Promise<string> {
    const url = `${this.config.APP_URL}${locale === 'en' ? '/en' : ''}/login`;
    const l = (key: string, params: Record<string, string | number> = {}) => translate(locale, key, params);
    if (contact.kind === 'phone') {
      return this.outbox.enqueue({ channel: 'sms', recipient: contact.value, body: l('api.messages.accountExistsSms', { url }), template: 'account_exists' });
    }
    const subject = l('api.messages.accountExistsEmailSubject');
    const body = l('api.messages.accountExistsEmailBody', { url });
    return this.outbox.enqueue({
      channel: 'email',
      recipient: contact.value,
      subject,
      body,
      html: renderEmail({ title: subject, paragraphs: [body], action: { label: translate(locale, 'auth.loginButton'), url }, footer: l('common.developedBy'), lang: locale }),
      template: 'account_exists',
    });
  }

  /** Plain notification email (security alerts, account events). */
  async sendNotice(email: string, title: string, body: string, locale: Locale, link?: string): Promise<string> {
    return this.outbox.enqueue({
      channel: 'email',
      recipient: email,
      subject: title,
      body: link ? `${body}\n\n${link}` : body,
      html: renderEmail({ title, paragraphs: [body], action: link ? { label: translate(locale, 'common.details'), url: link } : undefined, footer: translate(locale, 'common.developedBy'), lang: locale }),
      template: 'notice',
    });
  }

  async sendSms(phone: string, text: string, template: string): Promise<string> {
    return this.outbox.enqueue({ channel: 'sms', recipient: phone, body: text, template });
  }
}

/** "+8801712345678" → "017****5678", "reader@gmail.com" → "r***@gmail.com". */
export function maskContact(contact: Contact): string {
  if (contact.kind === 'phone') return formatBdPhone(contact.value, true);
  const [name, domain] = contact.value.split('@');
  return `${name!.slice(0, 1)}***@${domain}`;
}
