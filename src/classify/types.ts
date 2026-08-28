export interface FileMeta {
  path: string;
  /** File size in bytes, if known. Metadata only — never file contents. */
  sizeBytes?: number;
  /** MIME type, if known. */
  mimeType?: string;
}

export type Classification = 'TEMPORARY' | 'PERMANENT' | 'UNKNOWN';
export const UNKNOWN: Classification = 'UNKNOWN';

export interface Classifier {
  isAvailable(): Promise<boolean>;
  classify(file: FileMeta): Promise<Classification>;
}

export function createUnavailableClassifier(): Classifier {
  return {
    async isAvailable(): Promise<boolean> {
      return false;
    },
    async classify(_file: FileMeta): Promise<Classification> {
      return UNKNOWN;
    },
  };
}
