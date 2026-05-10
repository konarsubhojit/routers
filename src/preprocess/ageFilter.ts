export interface TimeStampedFile {
  path: string;
  modifiedAt: number | string | Date;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value: number | string | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  return new Date(value).getTime();
}

export function isOlderThanThreshold(
  modifiedAt: number | string | Date,
  thresholdDays = 180,
  now = Date.now(),
): boolean {
  const modifiedAtTimestamp = toTimestamp(modifiedAt);

  if (Number.isNaN(modifiedAtTimestamp)) {
    return false;
  }

  const ageMs = now - modifiedAtTimestamp;
  return ageMs > thresholdDays * DAY_IN_MS;
}

export function flagOldFiles(
  files: TimeStampedFile[],
  thresholdDays = 180,
  now = Date.now(),
): Array<TimeStampedFile & {isOld: boolean}> {
  return files.map(file => ({
    ...file,
    isOld: isOlderThanThreshold(file.modifiedAt, thresholdDays, now),
  }));
}
