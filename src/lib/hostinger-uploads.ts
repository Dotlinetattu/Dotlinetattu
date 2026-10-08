import os from 'node:os';
import path from 'node:path';

const MANAGED_HOSTINGER_DIRECTORIES = new Set(['hbuilds', 'nodejs', 'public_html']);

export function getHostingerUploadDirectory() {
  const configuredDirectory = process.env.HOSTINGER_UPLOAD_DIR?.trim();

  if (!configuredDirectory) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('HOSTINGER_UPLOAD_DIR is required in production.');
    }

    return path.join(os.tmpdir(), 'dotlinetattu-uploads');
  }

  if (process.env.NODE_ENV === 'production' && !path.isAbsolute(configuredDirectory)) {
    throw new Error('HOSTINGER_UPLOAD_DIR must be an absolute path in production.');
  }

  const resolvedDirectory = path.resolve(configuredDirectory);
  const pathSegments = resolvedDirectory.split(/[\\/]+/).map((segment) => segment.toLowerCase());

  if (pathSegments.some((segment) => MANAGED_HOSTINGER_DIRECTORIES.has(segment))) {
    throw new Error('HOSTINGER_UPLOAD_DIR must be outside Hostinger deployment directories.');
  }

  return resolvedDirectory;
}
