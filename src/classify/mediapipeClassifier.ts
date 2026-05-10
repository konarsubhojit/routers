import {
  classifyTextWithMediaPipe,
  isMediaPipeModelAvailable,
} from '../native/MediaPipeClassifier';
import {Classification, Classifier, FileMeta, UNKNOWN} from './types';

function extractTextCandidate(file: FileMeta): string | null {
  const candidate = file.path.trim();
  if (candidate.length === 0) {
    return null;
  }

  if (
    candidate.startsWith('content://') ||
    candidate.startsWith('file://') ||
    candidate.includes('/') ||
    candidate.includes('\\')
  ) {
    return null;
  }

  return candidate;
}

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
    /\bid\b/.test(normalizedLabel.replace(/[_-]+/g, ' ')) ||
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
      const textCandidate = extractTextCandidate(file);
      if (textCandidate == null) {
        return UNKNOWN;
      }

      const label = await classifyTextWithMediaPipe(textCandidate);
      return mapLabelToClassification(label);
    } catch {
      return UNKNOWN;
    }
  },
};
