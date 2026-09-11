import { Zip, ZipPassThrough } from 'fflate';

export type ZipFileEntry = {
  /**
   * The path of the file within the archive. Forward slashes create folders.
   * Individual path segments should be sanitized with
   * {@link sanitizeZipPathSegment} when derived from user-controlled values.
   */
  filename: string;
  data: Blob;
};

/**
 * Sanitizes a single path segment (folder or file name) for use inside a zip
 * archive, replacing characters that are path separators or invalid on
 * Windows extraction.
 */
export const sanitizeZipPathSegment = (segment: string): string => {
  const sanitized = segment
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, '-')
    .trim()
    // Windows cannot extract folders or files ending with a dot.
    .replace(/\.+$/, '');

  return sanitized || 'untitled';
};

export type ZipWriter = {
  /**
   * Adds a file to the zip stream. Files are written incrementally so the
   * input blob can be garbage collected once this resolves.
   */
  addFile: (entry: ZipFileEntry) => Promise<void>;

  /**
   * Finishes the zip stream and returns the archive as a blob.
   */
  finalize: () => Blob;

  /**
   * Discards the zip stream and any buffered output.
   */
  abort: () => void;
};

/**
 * How many bytes of a blob to materialise into the JS heap per read. Blobs
 * (e.g. fetch responses) can be disk-backed by the browser, it is only
 * `arrayBuffer()` that forces them into memory, so we read in slices.
 */
const READ_SLICE_BYTES = 4 * 1024 * 1024;

/**
 * Once this many bytes of zip output have accumulated in the JS heap they are
 * coalesced into an intermediate blob. Browsers can page blob storage to disk
 * under memory pressure, and the final `new Blob(parts)` composes parts by
 * reference, so this keeps the heap bounded regardless of archive size.
 */
const OUTPUT_COALESCE_BYTES = 16 * 1024 * 1024;

/**
 * Creates an incremental client-side zip writer.
 *
 * Files are stored without compression (PDFs are already internally
 * compressed) and streamed through the archive as they are added, so peak JS
 * heap usage is bounded by roughly one read slice plus one output buffer
 * rather than the total size of the archive.
 */
export const createZipWriter = (): ZipWriter => {
  const usedNames = new Set<string>();

  const outputParts: Blob[] = [];
  let pendingChunks: Uint8Array[] = [];
  let pendingSize = 0;

  let zipError: Error | null = null;

  const flushPendingChunks = () => {
    if (pendingChunks.length === 0) {
      return;
    }

    outputParts.push(new Blob(pendingChunks));
    pendingChunks = [];
    pendingSize = 0;
  };

  // ZipPassThrough is synchronous (no workers), so output callbacks have
  // always fired by the time `push`/`end` return.
  const zipStream = new Zip((error, chunk, isFinal) => {
    if (error) {
      zipError = error;
      return;
    }

    pendingChunks.push(chunk);
    pendingSize += chunk.length;

    if (pendingSize >= OUTPUT_COALESCE_BYTES || isFinal) {
      flushPendingChunks();
    }
  });

  /**
   * Deduplicates filenames case-insensitively (Windows extraction is
   * case-insensitive) by appending " (n)" before the extension.
   */
  const deduplicateFilename = (filename: string) => {
    const match = filename.match(/^(.*?)(\.[^./]+)?$/);

    const baseName = match?.[1] ?? filename;
    const extension = match?.[2] ?? '';

    let candidate = filename;
    let counter = 1;

    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${baseName} (${counter})${extension}`;
      counter += 1;
    }

    usedNames.add(candidate.toLowerCase());

    return candidate;
  };

  const addFile = async ({ filename, data }: ZipFileEntry) => {
    if (zipError) {
      throw zipError;
    }

    const file = new ZipPassThrough(deduplicateFilename(filename));

    zipStream.add(file);

    for (let offset = 0; offset < data.size; offset += READ_SLICE_BYTES) {
      const slice = data.slice(offset, offset + READ_SLICE_BYTES);

      file.push(new Uint8Array(await slice.arrayBuffer()));

      if (zipError) {
        throw zipError;
      }
    }

    file.push(new Uint8Array(0), true);

    if (zipError) {
      throw zipError;
    }
  };

  const finalize = () => {
    zipStream.end();

    if (zipError) {
      throw zipError;
    }

    flushPendingChunks();

    return new Blob(outputParts, { type: 'application/zip' });
  };

  const abort = () => {
    zipStream.terminate();

    pendingChunks = [];
    pendingSize = 0;
    outputParts.length = 0;
  };

  return {
    addFile,
    finalize,
    abort,
  };
};
