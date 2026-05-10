import {aicoreClassifier} from '../../src/classify/aicoreClassifier';
import {
  classifyPathWithAICore,
  isAICoreAvailable,
} from '../../src/native/AICoreClassifier';

jest.mock('../../src/native/AICoreClassifier', () => ({
  isAICoreAvailable: jest.fn(),
  classifyPathWithAICore: jest.fn(),
}));

const isAICoreAvailableMock = jest.mocked(isAICoreAvailable);
const classifyPathWithAICoreMock = jest.mocked(classifyPathWithAICore);

describe('aicoreClassifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isAvailable returns true when native module reports availability', async () => {
    isAICoreAvailableMock.mockResolvedValue(true);

    await expect(aicoreClassifier.isAvailable()).resolves.toBe(true);
  });

  it('isAvailable returns false when native availability check fails', async () => {
    isAICoreAvailableMock.mockRejectedValue(new Error('unavailable'));

    await expect(aicoreClassifier.isAvailable()).resolves.toBe(false);
  });

  it('maps temporary-style labels to TEMPORARY', async () => {
    classifyPathWithAICoreMock.mockResolvedValue('boarding pass');

    await expect(aicoreClassifier.classify({path: 'ticket.pdf'})).resolves.toBe(
      'TEMPORARY',
    );
  });

  it('maps permanent-style labels to PERMANENT', async () => {
    classifyPathWithAICoreMock.mockResolvedValue('identity document');

    await expect(aicoreClassifier.classify({path: 'passport.pdf'})).resolves.toBe(
      'PERMANENT',
    );
  });

  it('returns UNKNOWN when native classifier returns null', async () => {
    classifyPathWithAICoreMock.mockResolvedValue(null);

    await expect(aicoreClassifier.classify({path: 'misc.txt'})).resolves.toBe(
      'UNKNOWN',
    );
  });
});
