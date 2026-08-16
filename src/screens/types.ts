import {ExtensionBucket} from '../preprocess/extensionBuckets';

export type ReviewBadge = 'DUPLICATE' | 'OLD' | 'TEMPORARY' | 'CLOUD';

export interface ScannedFileViewModel {
  uri: string;
  name: string;
  bucket: ExtensionBucket;
  badges: ReviewBadge[];
  sizeBytes: number | null;
}

export interface BucketGroup {
  bucket: ExtensionBucket;
  files: ScannedFileViewModel[];
}
