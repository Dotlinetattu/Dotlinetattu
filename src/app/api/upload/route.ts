import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function uploadConfigured() {
  return Boolean(
    process.env.CLOUDINARY_URL
    || (
      process.env.CLOUDINARY_CLOUD_NAME
      && process.env.CLOUDINARY_API_KEY
      && process.env.CLOUDINARY_API_SECRET
    ),
  );
}

function configureCloudinary() {
  // Cloudinary documents CLOUDINARY_URL as its recommended configuration.
  // Prefer it when present so the cloud name, API key, and secret always belong
  // to the same credential pair. The three individual variables remain a fallback.
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config(true);
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  const { cloud_name, api_key, api_secret } = cloudinary.config();
  return Boolean(cloud_name && api_key && api_secret);
}

export async function POST(request: Request) {
  try {
    if (!uploadConfigured()) {
      return NextResponse.json({ error: 'Image upload is not configured.' }, { status: 503 });
    }

    const data = await request.formData();
    const file = data.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Upload a JPG, PNG, or WebP image.' }, { status: 415 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image must be 8 MB or smaller.' }, { status: 413 });
    }

    if (!configureCloudinary()) {
      return NextResponse.json({ error: 'Image upload is not configured.' }, { status: 503 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a Promise to wrap the stream upload
    const uploadResult = await new Promise<unknown>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'booking_references', resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      
      uploadStream.end(buffer);
    });

    return NextResponse.json(uploadResult);
  } catch (error: unknown) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Image upload failed. Check Cloudinary server configuration.' }, { status: 500 });
  }
}
