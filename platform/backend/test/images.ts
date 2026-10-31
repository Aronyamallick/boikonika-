import sharp from 'sharp';

/** A real JPEG with EXIF metadata (camera/author tags), like a phone photo. */
export function photoWithExif(width = 900, height = 600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 160, b: 200 } } })
    .jpeg({ quality: 80 })
    .withExif({ IFD0: { Artist: 'Test Phone Owner', Copyright: 'Private', Make: 'TestCam', Model: 'X1' } })
    .toBuffer();
}

export function pngImage(width = 400, height = 400): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 30, g: 100, b: 60, alpha: 1 } } }).png().toBuffer();
}

export const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
