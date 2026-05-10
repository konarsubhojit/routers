import {flagOldFiles, isOlderThanThreshold} from '../../src/preprocess/ageFilter';

describe('isOlderThanThreshold', () => {
  const now = new Date('2026-01-01T00:00:00.000Z').getTime();

  it('uses 180 days by default', () => {
    expect(isOlderThanThreshold('2025-05-01T00:00:00.000Z', undefined, now)).toBe(
      true,
    );
  });

  it('returns false for recent files', () => {
    expect(isOlderThanThreshold('2025-12-15T00:00:00.000Z', 30, now)).toBe(false);
  });

  it('supports Date and number inputs', () => {
    expect(isOlderThanThreshold(new Date('2025-01-01T00:00:00.000Z'), 180, now)).toBe(
      true,
    );
    expect(isOlderThanThreshold(new Date('2025-12-20T00:00:00.000Z').getTime(), 30, now)).toBe(
      false,
    );
  });

  it('returns false for invalid dates', () => {
    expect(isOlderThanThreshold('not-a-date', 180, now)).toBe(false);
  });
});

describe('flagOldFiles', () => {
  const now = new Date('2026-01-01T00:00:00.000Z').getTime();

  it('returns empty list for empty input', () => {
    expect(flagOldFiles([], 180, now)).toEqual([]);
  });

  it('flags each file as old or not old', () => {
    expect(
      flagOldFiles(
        [
          {path: 'old.txt', modifiedAt: '2025-01-01T00:00:00.000Z'},
          {path: 'new.txt', modifiedAt: '2025-12-30T00:00:00.000Z'},
        ],
        180,
        now,
      ),
    ).toEqual([
      {path: 'old.txt', modifiedAt: '2025-01-01T00:00:00.000Z', isOld: true},
      {path: 'new.txt', modifiedAt: '2025-12-30T00:00:00.000Z', isOld: false},
    ]);
  });

  it('handles a single file', () => {
    expect(
      flagOldFiles([{path: 'single.txt', modifiedAt: '2020-01-01T00:00:00.000Z'}], 1, now),
    ).toEqual([{path: 'single.txt', modifiedAt: '2020-01-01T00:00:00.000Z', isOld: true}]);
  });
});
