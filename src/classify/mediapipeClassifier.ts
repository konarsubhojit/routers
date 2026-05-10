import {
  classifyTextWithMediaPipe,
  isMediaPipeModelAvailable,
} from '../native/MediaPipeClassifier';
import {Classification, Classifier, FileMeta, UNKNOWN} from './types';

function mapLabelToClassification(label: string | null): Classification {
  if (label == null) {
    return UNKNOWN;
  }

  const normalizedLabel = label.trim().toLowerCase();
  if (normalizedLabel.length === 0) {
    return UNKNOWN;
  }

  if (
    normalizedLabel.includes('temporary') ||
    normalizedLabel.includes('boarding') ||
    normalizedLabel.includes('ticket') ||
    normalizedLabel.includes('itinerary') ||
    normalizedLabel.includes('travel') ||
    normalizedLabel.includes('reservation')
  ) {
    return 'TEMPORARY';
  }

  if (
    normalizedLabel.includes('permanent') ||
    normalizedLabel.includes('identity') ||
    normalizedLabel.includes('id') ||
    normalizedLabel.includes('certificate') ||
    normalizedLabel.includes('statement') ||
    normalizedLabel.includes('contract')
  ) {
    return 'PERMANENT';
  }

  return UNKNOWN;
}

export const mediapipeClassifier: Classifier = {
  async isAvailable(): Promise<boolean> {
    try {
      return await isMediaPipeModelAvailable();
    } catch {
      return false;
    }
  },

  async classify(file: FileMeta): Promise<Classification> {
    try {
      const label = await classifyTextWithMediaPipe(file.path);
      return mapLabelToClassification(label);
    } catch {
      return UNKNOWN;
    }
  },
};
