import {mediapipeClassifier} from '../../src/classify/mediapipeClassifier';
import {
  classifyTextWithMediaPipe,
  isMediaPipeModelAvailable,
} from '../../src/native/MediaPipeClassifier';

jest.mock('../../src/native/MediaPipeClassifier', () => ({
  isMediaPipeModelAvailable: jest.fn(),
  classifyTextWithMediaPipe: jest.fn(),
}));

const isMediaPipeModelAvailableMock = jest.mocked(isMediaPipeModelAvailable);
const classifyTextWithMediaPipeMock = jest.mocked(classifyTextWithMediaPipe);

describe('mediapipeClassifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isAvailable returns true when model asset is available', async () => {
    isMediaPipeModelAvailableMock.mockResolvedValue(true);

    await expect(mediapipeClassifier.isAvailable()).resolves.toBe(true);
  });

  it('isAvailable returns false when native availability check fails', async () => {
    isMediaPipeModelAvailableMock.mockRejectedValue(new Error('unavailable'));

    await expect(mediapipeClassifier.isAvailable()).resolves.toBe(false);
  });

  it('maps boarding-pass style labels to TEMPORARY', async () => {
    classifyTextWithMediaPipeMock.mockResolvedValue('boarding pass');

    await expect(
      mediapipeClassifier.classify({path: 'BOARDING PASS: SFO -> SEA'}),
    ).resolves.toBe('TEMPORARY');
  });

  it('maps permanent-document style labels to PERMANENT', async () => {
    classifyTextWithMediaPipeMock.mockResolvedValue('identity_document');

    await expect(
      mediapipeClassifier.classify({path: 'passport details'}),
    ).resolves.toBe('PERMANENT');
  });

  it('returns UNKNOWN when label does not match heuristics', async () => {
    classifyTextWithMediaPipeMock.mockResolvedValue('misc_note');

    await expect(
      mediapipeClassifier.classify({path: 'some text'}),
    ).resolves.toBe('UNKNOWN');
  });

  it('does not classify labels containing incidental "id" substrings as PERMANENT', async () => {
    classifyTextWithMediaPipeMock.mockResolvedValue('video_clip');

    await expect(
      mediapipeClassifier.classify({path: 'some text'}),
    ).resolves.toBe('UNKNOWN');
  });

  it('returns UNKNOWN without invoking native classify for URI-like paths', async () => {
    await expect(
      mediapipeClassifier.classify({
        path: 'content://downloads/public_downloads/42',
      }),
    ).resolves.toBe('UNKNOWN');

    expect(classifyTextWithMediaPipeMock).not.toHaveBeenCalled();
  });
});
