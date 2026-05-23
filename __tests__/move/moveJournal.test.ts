import {
  clearJournal,
  loadJournal,
  saveJournal,
} from '../../src/move/moveJournal';

describe('moveJournal', () => {
  beforeEach(() => {
    clearJournal();
  });

  afterEach(() => {
    clearJournal();
  });

  it('returns null when no journal has been saved', () => {
    expect(loadJournal()).toBeNull();
  });

  it('persists entries and records a timestamp', () => {
    const before = Date.now();
    saveJournal([
      {
        sourceUri: 'content://docs/1',
        destinationUri: 'content://docs/Docs/1',
        name: 'invoice.pdf',
        resolvedName: 'invoice.pdf',
      },
    ]);
    const after = Date.now();

    const journal = loadJournal();
    expect(journal).not.toBeNull();
    expect(journal!.entries).toHaveLength(1);
    expect(journal!.entries[0]).toEqual({
      sourceUri: 'content://docs/1',
      destinationUri: 'content://docs/Docs/1',
      name: 'invoice.pdf',
      resolvedName: 'invoice.pdf',
    });
    expect(journal!.timestamp).toBeGreaterThanOrEqual(before);
    expect(journal!.timestamp).toBeLessThanOrEqual(after);
  });

  it('overwrites the previous journal on a second save', () => {
    saveJournal([{sourceUri: 'a', destinationUri: 'b', name: 'old.txt', resolvedName: 'old.txt'}]);
    saveJournal([
      {sourceUri: 'c', destinationUri: 'd', name: 'new.txt', resolvedName: 'new.txt'},
      {sourceUri: 'e', destinationUri: 'f', name: 'new2.txt', resolvedName: 'new2.txt'},
    ]);

    const journal = loadJournal();
    expect(journal!.entries).toHaveLength(2);
    expect(journal!.entries[0].name).toBe('new.txt');
  });

  it('clears the journal when saveJournal is called with an empty array', () => {
    saveJournal([{sourceUri: 'a', destinationUri: 'b', name: 'x.txt', resolvedName: 'x.txt'}]);
    saveJournal([]);

    expect(loadJournal()).toBeNull();
  });

  it('clearJournal removes the stored journal', () => {
    saveJournal([{sourceUri: 'a', destinationUri: 'b', name: 'x.txt', resolvedName: 'x.txt'}]);
    clearJournal();

    expect(loadJournal()).toBeNull();
  });
});
