import {requireNativeModule} from './requireNativeModule';

interface MediaPipeClassifierModuleSpec {
  isModelAvailable(): Promise<boolean>;
  classifyText(text: string): Promise<string | null>;
}

function getMediaPipeClassifierModule(): MediaPipeClassifierModuleSpec {
  return requireNativeModule<MediaPipeClassifierModuleSpec>(
    'MediaPipeClassifierModule',
  );
}

export async function isMediaPipeModelAvailable(): Promise<boolean> {
  return getMediaPipeClassifierModule().isModelAvailable();
}

export async function classifyTextWithMediaPipe(
  text: string,
): Promise<string | null> {
  return getMediaPipeClassifierModule().classifyText(text);
}
