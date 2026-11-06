// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fitWithin,
  hasExif,
  type ImageEncoder,
  prepareFile,
  reencodeImage,
  UploadFailure,
  uploadObject,
} from './storage';

vi.mock('@/lib/env', () => ({
  env: {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'user-token' } } }),
    },
  },
}));

// Fixtures ---------------------------------------------------------------------------------------

type Bytes = Uint8Array<ArrayBuffer>;

/** Bytes from number lists and ASCII strings (file signatures, chunk names). */
function bytes(...parts: (number[] | string)[]): Bytes {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      for (let i = 0; i < part.length; i += 1) out.push(part.charCodeAt(i));
    } else {
      out.push(...part);
    }
  }
  return new Uint8Array(out);
}

/**
 * A JPEG as a phone writes it: SOI, an APP1 "Exif" segment whose IFD0 points to a GPS IFD (tag
 * 0x8825) with a latitude, then the image data and EOI.
 */
function jpegWithGps(): Bytes {
  const tiff = bytes(
    'MM',
    [0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // big-endian TIFF, IFD0 at offset 8
    [0x00, 0x01], // one entry
    [0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a], // GPSInfo → offset 26
    [0x00, 0x00, 0x00, 0x00], // no next IFD
    [0x00, 0x01], // GPS IFD: one entry
    [0x00, 0x02, 0x00, 0x05, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x2c], // GPSLatitude
    [0x00, 0x00, 0x00, 0x00],
    'lat:24.7136N', // stand-in for the rational values
  );
  const payload = bytes('Exif', [0x00, 0x00], [...tiff]);
  const length = payload.length + 2;
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe1, length >> 8, length & 0xff],
    [...payload],
    [0xff, 0xda, 0x00, 0x02], // start of scan
    [0x12, 0x34, 0x56],
    [0xff, 0xd9],
  );
}

/** A JPEG as a canvas encoder writes it: JFIF APP0 only, no metadata. */
function cleanJpeg(): Bytes {
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, 0x00, 0x10],
    'JFIF',
    [0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00],
    [0xff, 0xda, 0x00, 0x02, 0x99],
    [0xff, 0xd9],
  );
}

function webp(withExif: boolean): Bytes {
  const vp8 = bytes('VP8 ', [0x04, 0x00, 0x00, 0x00], [1, 2, 3, 4]);
  const exif = withExif ? bytes('EXIF', [0x04, 0x00, 0x00, 0x00], 'MM\0*') : new Uint8Array();
  const body = bytes('WEBP', [...vp8], [...exif]);
  const size = body.length;
  return bytes('RIFF', [size & 0xff, (size >> 8) & 0xff, 0, 0], [...body]);
}

const file = (data: Bytes | string, name: string, type: string) => new File([data], name, { type });

/**
 * A stand-in for the browser's canvas: decoding gives the pixel size, encoding writes new bytes
 * from pixels only (what a canvas does), in the requested type when supported.
 */
function fakeEncoder(
  options: { width?: number; height?: number; webp?: boolean; output?: Bytes } = {},
) {
  const calls: { width: number; height: number; type: string }[] = [];
  const encoder: ImageEncoder = {
    decode: () =>
      Promise.resolve({
        width: options.width ?? 4000,
        height: options.height ?? 3000,
        source: {} as CanvasImageSource,
      }),
    encode: (_source, width, height, type) => {
      calls.push({ width, height, type });
      if (type === 'image/webp' && options.webp === false) {
        return Promise.resolve(new Blob([cleanJpeg()], { type: 'image/png' }));
      }
      const data = options.output ?? (type === 'image/webp' ? webp(false) : cleanJpeg());
      return Promise.resolve(new Blob([data], { type }));
    },
  };
  return { encoder, calls };
}

// Tests ------------------------------------------------------------------------------------------

describe('EXIF detection', () => {
  it('finds EXIF (with GPS) in a phone JPEG and none in a canvas JPEG', () => {
    expect(hasExif(jpegWithGps())).toBe(true);
    expect(hasExif(cleanJpeg())).toBe(false);
  });

  it('finds an EXIF chunk in WebP', () => {
    expect(hasExif(webp(true))).toBe(true);
    expect(hasExif(webp(false))).toBe(false);
  });
});

describe('image re-encoding', () => {
  it('scales the longest side to 1600 px, never up', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1000, 3000, 1600)).toEqual({ width: 533, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('a JPEG with EXIF/GPS comes out as WebP without it, scaled down', async () => {
    const original = file(jpegWithGps(), 'IMG_0001.jpg', 'image/jpeg');
    expect(hasExif(new Uint8Array(await original.arrayBuffer()))).toBe(true);
    const { encoder, calls } = fakeEncoder();

    const prepared = await prepareFile('image', original, encoder);

    const out = new Uint8Array(await prepared.blob.arrayBuffer());
    expect(hasExif(out)).toBe(false);
    expect(prepared.contentType).toBe('image/webp');
    expect(prepared.extension).toBe('webp');
    expect(calls[0]).toEqual({ width: 1600, height: 1200, type: 'image/webp' });
    // The original bytes are never what gets uploaded.
    expect(out).not.toEqual(jpegWithGps());
  });

  it('falls back to JPEG where the browser cannot encode WebP', async () => {
    const { encoder, calls } = fakeEncoder({ webp: false });
    const blob = await reencodeImage(file(jpegWithGps(), 'a.jpg', 'image/jpeg'), encoder);
    expect(blob.type).toBe('image/jpeg');
    expect(calls.map((call) => call.type)).toEqual(['image/webp', 'image/jpeg']);
    expect(hasExif(new Uint8Array(await blob.arrayBuffer()))).toBe(false);
  });

  it('refuses to upload if the encoded bytes still carry EXIF (second layer)', async () => {
    const { encoder } = fakeEncoder({ output: webp(true) });
    await expect(
      reencodeImage(file(jpegWithGps(), 'a.jpg', 'image/jpeg'), encoder),
    ).rejects.toEqual(new UploadFailure('unexpected'));
  });

  it('a file the browser cannot decode is the wrong type', async () => {
    const encoder: ImageEncoder = {
      decode: () => Promise.reject(new Error('not an image')),
      encode: () => Promise.resolve(null),
    };
    await expect(
      prepareFile('image', file('not really', 'x.png', 'image/png'), encoder),
    ).rejects.toEqual(new UploadFailure('wrongType'));
  });
});

describe('file checks before any request', () => {
  it.each([
    ['image', 'photo.gif', 'image/gif'],
    ['image', 'logo.svg', 'image/svg+xml'],
    [
      'document',
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['document', 'page.html', 'text/html'],
  ] as const)('%s: %s is the wrong type', async (kind, name, type) => {
    await expect(prepareFile(kind, file('x', name, type), fakeEncoder().encoder)).rejects.toEqual(
      new UploadFailure('wrongType'),
    );
  });

  it('a "PDF" that is not one is the wrong type', async () => {
    await expect(
      prepareFile('document', file('<html>', 'fake.pdf', 'application/pdf')),
    ).rejects.toEqual(new UploadFailure('wrongType'));
  });

  it('a PDF over 10 MB is too large; one under keeps its name', async () => {
    const big = new File(['%PDF-1.7\n', new Uint8Array(10 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    await expect(prepareFile('document', big)).rejects.toEqual(new UploadFailure('tooLarge'));

    const ok = await prepareFile(
      'document',
      file('%PDF-1.7\nhello', 'تقرير المشروع.pdf', 'application/pdf'),
    );
    expect(ok.extension).toBe('pdf');
    expect(ok.originalName).toBe('تقرير المشروع.pdf');
  });

  it('an image still over 2 MB after re-encoding is too large', async () => {
    const { encoder } = fakeEncoder({ output: new Uint8Array(2 * 1024 * 1024 + 1) });
    await expect(
      prepareFile('image', file(jpegWithGps(), 'a.jpg', 'image/jpeg'), encoder),
    ).rejects.toEqual(new UploadFailure('tooLarge'));
  });

  it('an original image over 25 MB is refused before decoding', async () => {
    const huge = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.jpg', {
      type: 'image/jpeg',
    });
    await expect(prepareFile('image', huge, fakeEncoder().encoder)).rejects.toEqual(
      new UploadFailure('tooLarge'),
    );
  });
});

// Upload with progress -----------------------------------------------------------------------------

class FakeXhr {
  static last: FakeXhr | null = null;
  static respond: { status: number; body?: string } | 'error' = { status: 200 };
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = null;
  status = 0;
  responseText = '';
  upload: {
    onprogress:
      ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
    FakeXhr.last = this;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    const respond = FakeXhr.respond;
    if (respond === 'error') {
      this.onerror?.();
      return;
    }
    this.status = respond.status;
    this.responseText = respond.body ?? '';
    this.onload?.();
  }
}

describe('uploadObject', () => {
  const prepared = {
    blob: new Blob(['x'], { type: 'image/webp' }),
    contentType: 'image/webp',
    extension: 'webp',
    originalName: 'شعار.png',
  };

  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.respond = { status: 200 };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts to the bucket as the user, never overwriting, and reports progress', async () => {
    const progress: number[] = [];
    await uploadObject('image', 'p1/image-u1.webp', prepared, (percent) => progress.push(percent));
    const xhr = FakeXhr.last;
    expect(xhr?.method).toBe('POST');
    expect(xhr?.url).toBe(
      'http://127.0.0.1:54321/storage/v1/object/project-images/p1/image-u1.webp',
    );
    expect(xhr?.headers).toMatchObject({
      Authorization: 'Bearer user-token',
      apikey: 'sb_publishable_test',
      'Content-Type': 'image/webp',
      'x-upsert': 'false',
    });
    // The original name travels as UTF-8 JSON in base64 (Arabic included).
    const metadata = Buffer.from(xhr?.headers['x-metadata'] ?? '', 'base64').toString('utf8');
    expect(JSON.parse(metadata)).toEqual({ name: 'شعار.png' });
    expect(progress).toEqual([50, 100]);
  });

  it.each([
    [
      { status: 413, body: '{"message":"The object exceeded the maximum allowed size"}' },
      'tooLarge',
    ],
    [{ status: 400, body: '{"message":"mime type text/html is not supported"}' }, 'wrongType'],
    [
      { status: 403, body: '{"message":"new row violates row-level security policy"}' },
      'notAllowed',
    ],
    [{ status: 500, body: 'boom' }, 'unexpected'],
    ['error', 'network'],
  ] as const)('a %j answer is %s', async (respond, kind) => {
    FakeXhr.respond = respond;
    await expect(
      uploadObject('image', 'p1/image-u1.webp', prepared, () => undefined),
    ).rejects.toEqual(new UploadFailure(kind));
  });
});
