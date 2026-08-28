import {classifyWithCloudEscalation, shouldEscalateToCloud} from '../../src/classify/cloudFallback';
import {Classifier} from '../../src/classify/types';

function buildClassifier(isAvailable: boolean, classify: () => Promise<'TEMPORARY' | 'PERMANENT' | 'UNKNOWN'>): Classifier {
  return {
    isAvailable: jest.fn().mockResolvedValue(isAvailable),
    classify: jest.fn(classify),
  };
}

const file = {path: 'downloads/ticket.pdf'};

describe('shouldEscalateToCloud', () => {
  it('never escalates when the cloud tier is disabled', () => {
    expect(shouldEscalateToCloud('UNKNOWN', false)).toBe(false);
  });

  it('never escalates a confident on-device result', () => {
    expect(shouldEscalateToCloud('TEMPORARY', true)).toBe(false);
    expect(shouldEscalateToCloud('PERMANENT', true)).toBe(false);
  });

  it('escalates only when enabled AND the on-device result is inconclusive', () => {
    expect(shouldEscalateToCloud('UNKNOWN', true)).toBe(true);
  });
});

describe('classifyWithCloudEscalation', () => {
  it('returns the on-device result untouched when cloud tier is disabled', async () => {
    const onDevice = buildClassifier(true, async () => 'UNKNOWN');
    const cloud = buildClassifier(true, async () => 'PERMANENT');

    const result = await classifyWithCloudEscalation(file, onDevice, cloud, {cloudTierEnabled: false});

    expect(result).toEqual({classification: 'UNKNOWN', tier: 'on-device'});
    expect(cloud.classify).not.toHaveBeenCalled();
  });

  it('does not escalate a confident on-device classification even when enabled', async () => {
    const onDevice = buildClassifier(true, async () => 'TEMPORARY');
    const cloud = buildClassifier(true, async () => 'PERMANENT');

    const result = await classifyWithCloudEscalation(file, onDevice, cloud, {cloudTierEnabled: true});

    expect(result).toEqual({classification: 'TEMPORARY', tier: 'on-device'});
    expect(cloud.classify).not.toHaveBeenCalled();
  });

  it('escalates to the cloud tier when on-device is UNKNOWN and cloud is enabled', async () => {
    const onDevice = buildClassifier(true, async () => 'UNKNOWN');
    const cloud = buildClassifier(true, async () => 'PERMANENT');

    const result = await classifyWithCloudEscalation(file, onDevice, cloud, {cloudTierEnabled: true});

    expect(result).toEqual({classification: 'PERMANENT', tier: 'cloud'});
  });

  it('degrades to the on-device result when the cloud tier is unavailable', async () => {
    const onDevice = buildClassifier(true, async () => 'UNKNOWN');
    const cloud = buildClassifier(false, async () => 'PERMANENT');

    const result = await classifyWithCloudEscalation(file, onDevice, cloud, {cloudTierEnabled: true});

    expect(result).toEqual({classification: 'UNKNOWN', tier: 'on-device'});
    expect(cloud.classify).not.toHaveBeenCalled();
  });

  it('degrades to the on-device result on any cloud classification error', async () => {
    const onDevice = buildClassifier(true, async () => 'UNKNOWN');
    const cloud = buildClassifier(true, async () => {
      throw new Error('quota exceeded');
    });

    const result = await classifyWithCloudEscalation(file, onDevice, cloud, {cloudTierEnabled: true});

    expect(result).toEqual({classification: 'UNKNOWN', tier: 'on-device'});
  });

  it('degrades to the on-device result when isAvailable throws', async () => {
    const onDevice = buildClassifier(true, async () => 'UNKNOWN');
    const cloud: Classifier = {
      isAvailable: jest.fn().mockRejectedValue(new Error('network error')),
      classify: jest.fn().mockResolvedValue('PERMANENT'),
    };

    const result = await classifyWithCloudEscalation(file, onDevice, cloud, {cloudTierEnabled: true});

    expect(result).toEqual({classification: 'UNKNOWN', tier: 'on-device'});
  });
});
