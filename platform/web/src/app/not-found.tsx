'use client';

import NextError from 'next/error';

// Requests that never reach a locale (rare) still get a proper 404 document.
export default function GlobalNotFound() {
  return (
    <html lang="bn">
      <body>
        <NextError statusCode={404} />
      </body>
    </html>
  );
}
