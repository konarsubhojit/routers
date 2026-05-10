export interface FileMeta {
  path: string;
}

export type Classification = 'TEMPORARY' | 'PERMANENT' | 'UNKNOWN';

export interface Classifier {
  isAvailable(): Promise<boolean>;
  classify(file: FileMeta): Promise<Classification>;
}
