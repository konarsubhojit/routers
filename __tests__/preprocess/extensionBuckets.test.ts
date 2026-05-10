import {
  extensionToBucket,
  normalizeExtension,
} from '../../src/preprocess/extensionBuckets';

describe('normalizeExtension', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeExtension('')).toBe('');
  });

  it('normalizes mixed case and leading dot', () => {
    expect(normalizeExtension('.JpG')).toBe('jpg');
  });

  it('extracts extension from a filename', () => {
    expect(normalizeExtension('folder/archive.TAR.GZ')).toBe('gz');
  });

  it('returns full string when there is no extension separator', () => {
    expect(normalizeExtension('README')).toBe('readme');
  });
});

describe('extensionToBucket', () => {
  it('maps known extensions to buckets', () => {
    expect(extensionToBucket('apk')).toBe('Installers');
    expect(extensionToBucket('zip')).toBe('Archives');
    expect(extensionToBucket('png')).toBe('Images');
    expect(extensionToBucket('pdf')).toBe('Docs');
    expect(extensionToBucket('mp3')).toBe('Audio');
    expect(extensionToBucket('mp4')).toBe('Video');
  });

  it('handles mixed-case filename input', () => {
    expect(extensionToBucket('MyPhoto.JPEG')).toBe('Images');
  });

  it('returns Other for unknown extension', () => {
    expect(extensionToBucket('unknown.xyz')).toBe('Other');
  });

  it('returns Other for file with no extension', () => {
    expect(extensionToBucket('LICENSE')).toBe('Other');
  });
});
