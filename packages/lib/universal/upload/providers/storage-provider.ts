export type PresignedUrl = {
  key: string;
  url: string;
};

export type UploadFileInput = {
  name: string;
  type: string;
  body: ArrayBuffer | Buffer;
};

export type UploadFileResult = {
  key: string;
};

export interface StorageProvider {
  /**
   * Generate a presigned URL to upload a file by name. The provider chooses the
   * final object key (typically derived from a slugified file name plus a
   * random prefix) and returns it along with the signed URL.
   */
  getPresignPostUrl(fileName: string, contentType: string, userId?: number): Promise<PresignedUrl>;

  /**
   * Generate a presigned URL to upload to an already-known key (used for flows
   * where the destination has been chosen previously).
   */
  getAbsolutePresignPostUrl(key: string): Promise<PresignedUrl>;

  /**
   * Generate a presigned URL to download a file by key.
   */
  getPresignGetUrl(key: string): Promise<PresignedUrl>;

  /**
   * Server-side upload of a file's bytes. Returns the chosen key.
   */
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;

  /**
   * Server-side delete of a file by key.
   */
  deleteFile(key: string): Promise<void>;
}
