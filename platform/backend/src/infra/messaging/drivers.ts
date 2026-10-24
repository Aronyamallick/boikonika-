import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { AppConfig } from '../../config/config.module';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmsMessage {
  /** E.164, e.g. +8801712345678 */
  to: string;
  text: string;
}

export interface MailDriver {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

export interface SmsDriver {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}

export interface CapturedMessage {
  channel: 'email' | 'sms';
  to: string;
  subject?: string;
  text: string;
  at: string;
}

/**
 * Development/test drivers print messages to the log and keep the latest ones in memory so OTP codes
 * can be read without a real SMS gateway or mailbox (see GET /api/v1/dev/outbox, never in production).
 */
export class CapturedMessages {
  private static readonly items: CapturedMessage[] = [];

  static push(item: CapturedMessage): void {
    this.items.unshift(item);
    this.items.length = Math.min(this.items.length, 100);
  }

  static list(to?: string): CapturedMessage[] {
    return to ? this.items.filter((m) => m.to === to) : [...this.items];
  }

  static clear(): void {
    this.items.length = 0;
  }
}

export class LogMailDriver implements MailDriver {
  readonly name = 'log';
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage): Promise<void> {
    CapturedMessages.push({ channel: 'email', to: message.to, subject: message.subject, text: message.text, at: new Date().toISOString() });
    if (process.env.NODE_ENV !== 'test') this.logger.log(`to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}

export class SmtpMailDriver implements MailDriver {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig) {
    this.transporter = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
      pool: true,
      maxConnections: 3,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.config.MAIL_FROM, to: message.to, subject: message.subject, text: message.text, html: message.html });
  }
}

export class LogSmsDriver implements SmsDriver {
  readonly name = 'log';
  private readonly logger = new Logger('SMS');

  async send(message: SmsMessage): Promise<void> {
    CapturedMessages.push({ channel: 'sms', to: message.to, text: message.text, at: new Date().toISOString() });
    if (process.env.NODE_ENV !== 'test') this.logger.log(`to=${message.to} ${message.text}`);
  }
}

/**
 * HTTP SMS gateway. Most Bangladeshi providers (BulkSMSBD, Alpha SMS, SSL Wireless, …) accept a POST
 * with an API key, sender id, number (8801XXXXXXXXX) and message; set SMS_API_URL, SMS_API_KEY and
 * SMS_SENDER_ID from your provider's dashboard. Any non-2xx response counts as a failure and is retried.
 */
export class HttpSmsDriver implements SmsDriver {
  readonly name = 'http';

  constructor(private readonly config: AppConfig) {}

  async send(message: SmsMessage): Promise<void> {
    const body = new URLSearchParams({
      api_key: this.config.SMS_API_KEY ?? '',
      senderid: this.config.SMS_SENDER_ID ?? '',
      number: message.to.replace(/^\+/, ''),
      message: message.text,
    });
    const res = await fetch(this.config.SMS_API_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`SMS gateway responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export function createMailDriver(config: AppConfig): MailDriver {
  return config.MAIL_DRIVER === 'smtp' ? new SmtpMailDriver(config) : new LogMailDriver();
}

export function createSmsDriver(config: AppConfig): SmsDriver {
  return config.SMS_DRIVER === 'http' ? new HttpSmsDriver(config) : new LogSmsDriver();
}
