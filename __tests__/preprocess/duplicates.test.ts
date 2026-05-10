import {
  duplicateHashes,
  flagDuplicates,
  groupByHash,
} from '../../src/preprocess/duplicates';

describe('groupByHash', () => {
  it('returns an empty map for an empty list', () => {
    expect(groupByHash([])).toEqual(new Map());
  });

  it('groups files by hash', () => {
    const grouped = groupByHash([
      {path: 'a.txt', hash: 'h1'},
      {path: 'b.txt', hash: 'h2'},
      {path: 'c.txt', hash: 'h1'},
    ]);

    expect(grouped.get('h1')).toEqual([
      {path: 'a.txt', hash: 'h1'},
      {path: 'c.txt', hash: 'h1'},
    ]);
    expect(grouped.get('h2')).toEqual([{path: 'b.txt', hash: 'h2'}]);
  });

  it('keeps a single file under its own hash', () => {
    const grouped = groupByHash([{path: 'single.txt', hash: 'only'}]);
    expect(grouped.get('only')).toEqual([{path: 'single.txt', hash: 'only'}]);
  });
});

describe('duplicateHashes', () => {
  it('returns only hashes with multiple files', () => {
    const grouped = new Map([
      ['h1', [{path: 'a', hash: 'h1'}]],
      [
        'h2',
        [
          {path: 'b', hash: 'h2'},
          {path: 'c', hash: 'h2'},
        ],
      ],
    ]);

    expect(duplicateHashes(grouped)).toEqual(new Set(['h2']));
  });
});

describe('flagDuplicates', () => {
  it('marks duplicate files and keeps singletons unflagged', () => {
    const files = [
      {path: 'a.txt', hash: 'h1'},
      {path: 'b.txt', hash: 'h1'},
      {path: 'c.txt', hash: 'h3'},
    ];

    expect(flagDuplicates(files)).toEqual([
      {path: 'a.txt', hash: 'h1', isDuplicate: true},
      {path: 'b.txt', hash: 'h1', isDuplicate: true},
      {path: 'c.txt', hash: 'h3', isDuplicate: false},
    ]);
  });
});
