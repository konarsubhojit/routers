export type ExtensionBucket =
  | 'Installers'
  | 'Archives'
  | 'Images'
  | 'Docs'
  | 'Audio'
  | 'Video'
  | 'Other';

const BUCKET_BY_EXTENSION = new Map<string, ExtensionBucket>([
  ['apk', 'Installers'],
  ['msi', 'Installers'],
  ['exe', 'Installers'],
  ['dmg', 'Installers'],
  ['pkg', 'Installers'],
  ['deb', 'Installers'],
  ['rpm', 'Installers'],
  ['zip', 'Archives'],
  ['rar', 'Archives'],
  ['7z', 'Archives'],
  ['tar', 'Archives'],
  ['gz', 'Archives'],
  ['bz2', 'Archives'],
  ['xz', 'Archives'],
  ['jpg', 'Images'],
  ['jpeg', 'Images'],
  ['png', 'Images'],
  ['gif', 'Images'],
  ['webp', 'Images'],
  ['bmp', 'Images'],
  ['pdf', 'Docs'],
  ['doc', 'Docs'],
  ['docx', 'Docs'],
  ['txt', 'Docs'],
  ['rtf', 'Docs'],
  ['md', 'Docs'],
  ['mp3', 'Audio'],
  ['wav', 'Audio'],
  ['flac', 'Audio'],
  ['aac', 'Audio'],
  ['ogg', 'Audio'],
  ['mp4', 'Video'],
  ['mkv', 'Video'],
  ['mov', 'Video'],
  ['avi', 'Video'],
  ['webm', 'Video'],
]);

export function normalizeExtension(input: string): string {
  if (!input) {
    return '';
  }

  const normalized = input.trim().toLowerCase();
  const withoutLeadingDot = normalized.startsWith('.')
    ? normalized.slice(1)
    : normalized;

  if (!withoutLeadingDot.includes('.')) {
    return withoutLeadingDot;
  }

  const parts = withoutLeadingDot.split('.');
  return parts[parts.length - 1];
}

export function extensionToBucket(extensionOrFileName: string): ExtensionBucket {
  const extension = normalizeExtension(extensionOrFileName);
  return BUCKET_BY_EXTENSION.get(extension) ?? 'Other';
}
