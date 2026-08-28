import {Classification, Classifier, FileMeta, UNKNOWN} from './types';

export type ClassificationTier = 'on-device' | 'cloud';

export interface TieredClassificationResult {
  classification: Classification;
  tier: ClassificationTier;
}

/**
 * Tier 3 escalation decision: the on-device pipeline (Tier 1/2) only offers
 * the cloud tier when its own result was inconclusive (`UNKNOWN`) — the
 * on-device classifiers don't expose a numeric confidence score, so an
 * `UNKNOWN` result is treated as "confidence below threshold".
 */
export function shouldEscalateToCloud(onDeviceResult: Classification, cloudTierEnabled: boolean): boolean {
  return cloudTierEnabled && onDeviceResult === UNKNOWN;
}

/**
 * Runs the on-device tiered classifier first. Only when the result is
 * inconclusive AND the user has opted in does this escalate to the cloud
 * tier. Any cloud error, unavailability, or rejection degrades safely back
 * to the on-device result — the cloud tier can never make things worse.
 */
export async function classifyWithCloudEscalation(
  file: FileMeta,
  onDeviceClassifier: Classifier,
  cloudTierClassifier: Classifier,
  options: {cloudTierEnabled: boolean},
): Promise<TieredClassificationResult> {
  const onDeviceResult = await onDeviceClassifier.classify(file);

  if (!shouldEscalateToCloud(onDeviceResult, options.cloudTierEnabled)) {
    return {classification: onDeviceResult, tier: 'on-device'};
  }

  try {
    const cloudAvailable = await cloudTierClassifier.isAvailable();
    if (!cloudAvailable) {
      return {classification: onDeviceResult, tier: 'on-device'};
    }

    const cloudResult = await cloudTierClassifier.classify(file);
    return {classification: cloudResult, tier: 'cloud'};
  } catch {
    return {classification: onDeviceResult, tier: 'on-device'};
  }
}
