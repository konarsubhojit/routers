import {
  DEFAULT_COLLISION_POLICY,
  resolveCollisionName,
} from '../../src/move/collisionPolicy';

describe('resolveCollisionName', () => {
  it('inserts the index before the extension', () => {
    expect(resolveCollisionName('invoice.pdf', 1)).toBe('invoice (1).pdf');
    expect(resolveCollisionName('invoice.pdf', 2)).toBe('invoice (2).pdf');
    expect(resolveCollisionName('invoice.pdf', 99)).toBe('invoice (99).pdf');
  });

  it('handles multi-part extensions by only replacing the last dot segment', () => {
    expect(resolveCollisionName('archive.tar.gz', 1)).toBe('archive.tar (1).gz');
  });

  it('appends the index when the name has no extension', () => {
    expect(resolveCollisionName('Makefile', 1)).toBe('Makefile (1)');
    expect(resolveCollisionName('archive', 3)).toBe('archive (3)');
  });

  it('treats dot-files (no base before the dot) as having no extension', () => {
    expect(resolveCollisionName('.bashrc', 1)).toBe('.bashrc (1)');
    expect(resolveCollisionName('.gitignore', 2)).toBe('.gitignore (2)');
  });

  it('handles names with spaces', () => {
    expect(resolveCollisionName('my document.docx', 1)).toBe(
      'my document (1).docx',
    );
  });

  it('handles names with parentheses in the stem', () => {
    expect(resolveCollisionName('report (old).pdf', 1)).toBe(
      'report (old) (1).pdf',
    );
  });
});

describe('DEFAULT_COLLISION_POLICY', () => {
  it('is rename', () => {
    expect(DEFAULT_COLLISION_POLICY).toBe('rename');
  });
});
