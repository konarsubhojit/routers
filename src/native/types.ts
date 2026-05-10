export interface NativeScannedFileMetadata {
  uri: string;
  name: string | null;
  sizeBytes: number | null;
  mtime: number | null;
  mimeType: string | null;
}
