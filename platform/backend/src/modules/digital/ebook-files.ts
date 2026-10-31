import { DIGITAL_FILE_MAX_MB, type DigitalFileType } from '@boikonika/shared';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { AppException } from '../../common/errors/app-exception';

export interface EbookFile {
  type: DigitalFileType;
  extension: 'pdf' | 'epub';
  sha256: string;
  pageCount: number | null;
}

/** An EPUB is a zip whose first entry is an uncompressed `mimetype` file reading application/epub+zip. */
function isEpub(buffer: Buffer): boolean {
  if (buffer.length < 60 || buffer.readUInt32LE(0) !== 0x04034b50) return false;
  const nameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);
  if (buffer.subarray(30, 30 + nameLength).toString('ascii') !== 'mimetype') return false;
  const start = 30 + nameLength + extraLength;
  return buffer.subarray(start, start + 20).toString('ascii') === 'application/epub+zip';
}

/**
 * Checks an uploaded e-book by its content (never the client's name or type): a readable, unlocked
 * PDF or a well-formed EPUB container, within the size limit.
 */
export async function inspectEbook(buffer: Buffer): Promise<EbookFile> {
  if (buffer.length > DIGITAL_FILE_MAX_MB * 1024 * 1024) throw new AppException('PAYLOAD_TOO_LARGE', 'validation.fileTooLarge').withParams({ max: `${DIGITAL_FILE_MAX_MB} MB` });
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    try {
      const pdf = await PDFDocument.load(buffer, { updateMetadata: false });
      const pageCount = pdf.getPageCount();
      if (pageCount < 1) throw new Error('empty');
      return { type: 'application/pdf', extension: 'pdf', sha256, pageCount };
    } catch (error) {
      if ((error as Error).name === 'EncryptedPDFError') throw AppException.validation([{ field: 'file', code: 'encrypted', message: 'validation.pdfLocked' }]);
      throw AppException.validation([{ field: 'file', code: 'unreadable', message: 'validation.ebookUnreadable' }]);
    }
  }
  if (isEpub(buffer)) return { type: 'application/epub+zip', extension: 'epub', sha256, pageCount: null };
  throw new AppException('UNSUPPORTED_MEDIA_TYPE', 'validation.ebookType');
}

/** Number of sample pages for a share of the book: at least one, never the whole book. */
export function samplePageCount(total: number, percent: number): number {
  if (total <= 1) return 1;
  return Math.max(1, Math.min(total - 1, Math.ceil((total * percent) / 100)));
}

/** A new PDF holding only the first pages of the book, used as the free "look inside" sample. */
export async function buildSamplePdf(source: Buffer, percent: number, title: string): Promise<{ body: Buffer; pages: number }> {
  const book = await PDFDocument.load(source, { updateMetadata: false });
  const pages = samplePageCount(book.getPageCount(), percent);
  const sample = await PDFDocument.create();
  const copied = await sample.copyPages(book, Array.from({ length: pages }, (_, i) => i));
  for (const page of copied) sample.addPage(page);
  sample.setTitle(`${title} (sample)`);
  sample.setProducer('Boikonika');
  sample.setCreator('Boikonika');
  return { body: Buffer.from(await sample.save()), pages };
}
