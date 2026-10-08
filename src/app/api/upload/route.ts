import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getHostingerUploadDirectory } from '@/lib/hostinger-uploads';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function hasExpectedSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return bytes.length >= 8
      && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && bytes.toString('ascii', 0, 4) === 'RIFF'
      && bytes.toString('ascii', 8, 12) === 'WEBP';
  }

  return false;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Image must be 8 MB or smaller.' }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file was provided.' }, { status: 400 });
    }

    const extension = ACCEPTED_IMAGE_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json({ error: 'Upload a JPG, PNG, or WebP image.' }, { status: 415 });
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image must be between 1 byte and 8 MB.' }, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedSignature(bytes, file.type)) {
      return NextResponse.json({ error: 'The selected file is not a valid supported image.' }, { status: 415 });
    }

    const directory = getHostingerUploadDirectory();
    await mkdir(directory, { recursive: true });

    const filename = randomUUID() + '.' + extension;
    await writeFile(path.join(directory, filename), bytes, { flag: 'wx', mode: 0o600 });

    return NextResponse.json({ url: '/api/uploads/' + filename });
  } catch (error) {
    console.error('Local image upload failed:', error);

    if (error instanceof Error && error.message.includes('HOSTINGER_UPLOAD_DIR')) {
      return NextResponse.json(
        { error: 'Persistent image storage is not configured. Add HOSTINGER_UPLOAD_DIR in Hostinger.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: 'Image upload failed. Check the Hostinger upload folder and try again.' }, { status: 500 });
  }
}
