/**
 * Project files in the two private buckets (SCRUM-27). The database decides who may write and read
 * (storage.objects policies); this module only checks files early, so a mistake is explained before
 * anything is sent, and reports progress.
 *
 * Images are always re-encoded through a canvas before upload. A canvas encoder writes pixels only,
 * so EXIF data (camera, time, GPS location) never leaves the browser; the longest side is scaled to
 * PROJECT_FILES.image.maxSide. As a second layer, the encoded bytes are scanned and refused if they
 * still carry EXIF.
 */
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { PROJECT_FILES, type ProjectFileKind } from './options';

export type UploadErrorKind = 'wrongType' | 'tooLarge' | 'network' | 'notAllowed' | 'unexpected';
export class UploadFailure extends Error {
  constructor(readonly kind: UploadErrorKind) {
    super(kind);
    this.name = 'UploadFailure';
  }
}

/** Originals above this are refused before decoding (re-encoding a huge photo can exhaust memory). */
const MAX_ORIGINAL_IMAGE_BYTES = 25 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// Byte checks ---------------------------------------------------------------------------------------

/** True when the bytes at `at` spell the given ASCII text (file signatures and chunk names). */
function ascii(bytes: Uint8Array, at: number, text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[at + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * True when the bytes carry EXIF metadata: a JPEG APP1 "Exif" segment, or a WebP "EXIF" chunk.
 * PNG eXIf chunks are checked too, although the encoder never produces PNG.
 */
export function hasExif(bytes: Uint8Array): boolean {
  // JPEG: walk the segments until the image data starts.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 4 <= bytes.length && bytes[at] === 0xff) {
      const marker = bytes[at + 1] ?? 0;
      if (marker === 0xda || marker === 0xd9) break;
      const length = ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0);
      if (marker === 0xe1 && ascii(bytes, at + 4, 'Exif')) return true;
      at += 2 + length;
    }
    return false;
  }
  // WebP: RIFF....WEBP, then chunks.
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    let at = 12;
    while (at + 8 <= bytes.length) {
      if (ascii(bytes, at, 'EXIF')) return true;
      const size =
        (bytes[at + 4] ?? 0) |
        ((bytes[at + 5] ?? 0) << 8) |
        ((bytes[at + 6] ?? 0) << 16) |
        ((bytes[at + 7] ?? 0) << 24);
      at += 8 + size + (size % 2);
    }
    return false;
  }
  // PNG: 8-byte signature, then length/type chunks.
  if (bytes[0] === 0x89 && ascii(bytes, 1, 'PNG')) {
    let at = 8;
    while (at + 8 <= bytes.length) {
      const size =
        ((bytes[at] ?? 0) << 24) |
        ((bytes[at + 1] ?? 0) << 16) |
        ((bytes[at + 2] ?? 0) << 8) |
        (bytes[at + 3] ?? 0);
      if (ascii(bytes, at + 4, 'eXIf')) return true;
      at += 12 + size;
    }
  }
  return false;
}

async function readBytes(blob: Blob, count?: number): Promise<Uint8Array> {
  const part = count === undefined ? blob : blob.slice(0, count);
  return new Uint8Array(await part.arrayBuffer());
}

// Image re-encoding ---------------------------------------------------------------------------------

/** The browser pieces re-encoding needs; tests pass their own (jsdom has no canvas). */
export interface ImageEncoder {
  decode: (file: Blob) => Promise<{ width: number; height: number; source: CanvasImageSource }>;
  encode: (
    source: CanvasImageSource,
    width: number,
    height: number,
    type: string,
  ) => Promise<Blob | null>;
}

/**
 * Draws the image for the target type. JPEG has no alpha channel: transparent pixels would turn
 * black, so the canvas is filled white first. WebP keeps the transparency.
 */
export function drawForType(
  context: Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect' | 'drawImage'>,
  source: CanvasImageSource,
  width: number,
  height: number,
  type: string,
) {
  if (type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(source, 0, 0, width, height);
}

export const browserEncoder: ImageEncoder = {
  // createImageBitmap applies the EXIF orientation, so a rotated phone photo stays upright.
  decode: async (file) => {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, source: bitmap };
  },
  encode: (source, width, height, type) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return Promise.resolve(null);
    drawForType(context, source, width, height, type);
    return new Promise((resolve) => {
      canvas.toBlob(resolve, type, 0.85);
    });
  },
};

/** Fits width × height inside a square of maxSide, never scaling up. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export interface EncodedImage {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * The image as uploaded: pixels only (no metadata), at most maxSide on its longest side, as WebP,
 * or JPEG (on white) where the browser cannot encode WebP. Returns the final dimensions too, for
 * the preview.
 */
export async function reencodeImage(
  file: Blob,
  encoder: ImageEncoder = browserEncoder,
): Promise<EncodedImage> {
  let decoded;
  try {
    decoded = await encoder.decode(file);
  } catch {
    throw new UploadFailure('wrongType'); // Not an image the browser can read.
  }
  const { width, height } = fitWithin(decoded.width, decoded.height, PROJECT_FILES.image.maxSide);
  let blob = await encoder.encode(decoded.source, width, height, 'image/webp');
  // A browser that cannot encode WebP falls back to PNG; ask for JPEG instead.
  if (blob?.type !== 'image/webp') {
    blob = await encoder.encode(decoded.source, width, height, 'image/jpeg');
  }
  if (!blob || !(PROJECT_FILES.image.types as readonly string[]).includes(blob.type)) {
    throw new UploadFailure('unexpected');
  }
  if (hasExif(await readBytes(blob))) throw new UploadFailure('unexpected');
  return { blob, width, height };
}

// Preparing a file ---------------------------------------------------------------------------------

export interface PreparedFile {
  blob: Blob;
  contentType: string;
  extension: string;
  /** The original file name, kept as object metadata so the document can be shown by name. */
  originalName: string;
  /** Images only: the re-encoded dimensions, shown in the preview. */
  width?: number;
  height?: number;
}

/** Checks type and size and, for images, re-encodes. Throws UploadFailure before any request. */
export async function prepareFile(
  kind: ProjectFileKind,
  file: File,
  encoder: ImageEncoder = browserEncoder,
): Promise<PreparedFile> {
  const rules = PROJECT_FILES[kind];
  if (!(rules.types as readonly string[]).includes(file.type)) {
    throw new UploadFailure('wrongType');
  }
  let blob: Blob = file;
  let size: { width: number; height: number } | undefined;
  if (kind === 'image') {
    if (file.size > MAX_ORIGINAL_IMAGE_BYTES) throw new UploadFailure('tooLarge');
    const encoded = await reencodeImage(file, encoder);
    blob = encoded.blob;
    size = { width: encoded.width, height: encoded.height };
  } else if (!ascii(await readBytes(file, 5), 0, '%PDF-')) {
    // Declared as a PDF but is not one.
    throw new UploadFailure('wrongType');
  }
  if (blob.size > rules.maxBytes) throw new UploadFailure('tooLarge');
  return {
    blob,
    contentType: blob.type,
    extension: EXTENSIONS[blob.type] ?? 'bin',
    originalName: file.name.slice(0, 150),
    ...size,
  };
}

// Uploading ------------------------------------------------------------------------------------------

/** UTF-8 safe base64, for the x-metadata header (Arabic file names included). */
function base64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** A new object name in the project's folder; the policies accept only this shape. */
export function objectName(projectId: string, kind: ProjectFileKind, extension: string): string {
  return `${projectId}/${kind}-${crypto.randomUUID()}.${extension}`;
}

/**
 * Uploads to the Storage API with XMLHttpRequest, which reports upload progress (supabase-js does
 * not). The user's session token makes the storage.objects policies apply. Never overwrites.
 */
export async function uploadObject(
  kind: ProjectFileKind,
  name: string,
  file: PreparedFile,
  onProgress: (percent: number) => void,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new UploadFailure('notAllowed');
  const url = `${env.VITE_SUPABASE_URL}/storage/v1/object/${PROJECT_FILES[kind].bucket}/${name}`;

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('apikey', env.VITE_SUPABASE_PUBLISHABLE_KEY);
    request.setRequestHeader('Content-Type', file.contentType);
    request.setRequestHeader('x-upsert', 'false');
    request.setRequestHeader('cache-control', '3600');
    request.setRequestHeader('x-metadata', base64(JSON.stringify({ name: file.originalName })));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => {
      reject(new UploadFailure('network'));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      console.error('Upload refused', { status: request.status, body: request.responseText });
      const body = request.responseText.toLowerCase();
      reject(
        new UploadFailure(
          request.status === 413 || body.includes('size')
            ? 'tooLarge'
            : request.status === 415 || body.includes('mime')
              ? 'wrongType'
              : request.status === 401 || request.status === 403 || body.includes('security')
                ? 'notAllowed'
                : 'unexpected',
        ),
      );
    };
    request.send(file.blob);
  });
}

/** Removes objects; a failure is reported to the caller. */
export async function removeObjects(kind: ProjectFileKind, names: string[]): Promise<void> {
  if (names.length === 0) return;
  const { error } = await supabase.storage.from(PROJECT_FILES[kind].bucket).remove(names);
  if (error) throw error;
}

/** Every object in a project's folder in one bucket (the owner may list it under the policies). */
export async function listProjectObjects(
  kind: ProjectFileKind,
  projectId: string,
): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES[kind].bucket)
    .list(projectId, { limit: 100 });
  if (error) throw error;
  return data.map((item) => `${projectId}/${item.name}`);
}

/** A short-lived signed URL for display or download. */
export async function signedUrl(kind: ProjectFileKind, name: string, download?: string) {
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES[kind].bucket)
    .createSignedUrl(name, SIGNED_URL_SECONDS, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
export const SIGNED_URL_SECONDS = 300;

/**
 * Signed URLs for several files in ONE request (the directory signs a page of cards at once).
 * Keyed by object name; a file the caller may not read (or that is gone) is simply missing.
 */
export async function signedUrls(
  kind: ProjectFileKind,
  names: readonly string[],
): Promise<Record<string, string>> {
  if (names.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES[kind].bucket)
    .createSignedUrls([...names], SIGNED_URL_SECONDS);
  if (error) throw error;
  const urls: Record<string, string> = {};
  for (const item of data) {
    if (!item.error && item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

/** Size and original name of a stored document. */
export async function objectInfo(kind: ProjectFileKind, name: string) {
  const { data, error } = await supabase.storage.from(PROJECT_FILES[kind].bucket).info(name);
  if (error) throw error;
  const metadata = (data as { metadata?: { name?: unknown } | null }).metadata;
  return {
    size: data.size ?? null,
    name: typeof metadata?.name === 'string' ? metadata.name : null,
  };
}
