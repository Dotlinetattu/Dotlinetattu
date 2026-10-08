import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getHostingerUploadDirectory } from '@/lib/hostinger-uploads';

export const runtime = 'nodejs';

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }

  try {
    const image = await readFile(path.join(getHostingerUploadDirectory(), filename));
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    return new NextResponse(image, {
      headers: {
        'Content-Type': IMAGE_TYPES[extension],
        'Content-Length': String(image.byteLength),
        'Cache-Control': 'private, max-age=3600, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline; filename="' + filename + '"',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }
}
