import {Injectable} from '@angular/core';
import {addDoc, Bytes, collection, doc, Firestore, getDoc} from '@angular/fire/firestore';
import {IMAGE_REF_PREFIX} from 'types';

import {AuthService} from './auth.service';

// Uploads live in Firestore rather than Cloud Storage (the project has no
// bucket), so each image has to fit in one document.
const MAX_STORED_BYTES = 900 * 1024;
// Longest edge of a stored still image — tiles never render larger than this.
const MAX_EDGE = 512;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export const ACCEPTED_IMAGE_TYPES = ACCEPTED_TYPES.join(',');

/**
 * Stores images uploaded for word lists as /wordlistImages docs and turns
 * their `ctimg:<id>` refs back into something an <img> can show.
 */
@Injectable({providedIn: 'root'})
export class ImageStoreService {
  // ref -> object URL, kept for the life of the page so a board's images are
  // fetched once no matter how many places render them
  private readonly urls = new Map<string, Promise<string>>();

  constructor(
      private readonly firestore: Firestore,
      private readonly authService: AuthService,
  ) {}

  /**
   * Get a file ready to store: stills are scaled down and re-encoded, GIFs
   * are kept as they are so they stay animated. Throws an Error with a
   * player-readable message when the file can't be used.
   */
  async prepare(file: File): Promise<Blob> {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      throw new Error(`${file.name} isn't a PNG, JPEG, GIF or WebP image`);
    }
    const blob = file.type === 'image/gif' ? file : await this.shrink(file);
    if (blob.size > MAX_STORED_BYTES) {
      throw new Error(
          `${file.name} is too large to upload (max ${
              Math.round(MAX_STORED_BYTES / 1024)} KB) — link to it instead`);
    }
    return blob;
  }

  /** Store a prepared image and return its ref. */
  async upload(blob: Blob): Promise<string> {
    const data = Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
    const ref = await addDoc(collection(this.firestore, 'wordlistImages'), {
      data,
      contentType: blob.type,
      createdBy: this.authService.currentUserId,
      createdAt: Date.now(),
    });
    const imageRef = IMAGE_REF_PREFIX + ref.id;
    this.urls.set(imageRef, Promise.resolve(URL.createObjectURL(blob)));
    return imageRef;
  }

  /** Resolve an upload ref to a URL usable as an image src. */
  resolve(imageRef: string): Promise<string> {
    let url = this.urls.get(imageRef);
    if (!url) {
      url = this.fetch(imageRef);
      this.urls.set(imageRef, url);
      // don't cache a failure — let the next render try again
      url.catch(() => this.urls.delete(imageRef));
    }
    return url;
  }

  private async fetch(imageRef: string): Promise<string> {
    const id = imageRef.slice(IMAGE_REF_PREFIX.length);
    const snap = await getDoc(doc(this.firestore, 'wordlistImages', id));
    const image = snap.data() as {data: Bytes, contentType: string} | undefined;
    if (!image) {
      throw new Error(`image ${id} not found`);
    }
    // copy into a fresh buffer: BlobPart wants a plain ArrayBuffer-backed view
    const bytes = new Uint8Array(image.data.toUint8Array());
    return URL.createObjectURL(new Blob([bytes], {type: image.contentType}));
  }

  private async shrink(file: File): Promise<Blob> {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (_e) {
      throw new Error(`${file.name} couldn't be read as an image`);
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // WebP keeps transparency and is small; browsers that can't encode it
    // hand back a PNG instead, which is fine too
    const blob = await new Promise<Blob|null>(
        resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob) {
      throw new Error(`${file.name} couldn't be processed`);
    }
    return blob;
  }
}
