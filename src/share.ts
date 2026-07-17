// Shareable URLs: the whole song, deflate-compressed and base64url-encoded
// into the location hash. No server involved.
import type { Song } from './engine';
import { songFromFileText } from './persist';

const HASH_PREFIX = '#s=';

async function streamToBytes(stream: ReadableStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function songToHash(song: Song): Promise<string> {
  const json = JSON.stringify(song);
  const compressed = await streamToBytes(
    new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  );
  return HASH_PREFIX + toBase64Url(compressed);
}

export async function songFromHash(hash: string): Promise<Song | null> {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    const bytes = fromBase64Url(hash.slice(HASH_PREFIX.length));
    const stream = new Blob([bytes.slice().buffer as ArrayBuffer]).stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    const json = await new Response(stream).text();
    return songFromFileText(json);
  } catch {
    return null;
  }
}
