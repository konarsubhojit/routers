import {NativeModules} from 'react-native';

interface MediaPipeClassifierModuleSpec {
  isModelAvailable(): Promise<boolean>;
  classifyText(text: string): Promise<string | null>;
}

function getMediaPipeClassifierModule(): MediaPipeClassifierModuleSpec {
  const module = NativeModules
    .MediaPipeClassifierModule as MediaPipeClassifierModuleSpec | undefined;
  if (module == null) {
    throw new Error('MediaPipeClassifierModule is not available on this platform.');
  }

  return module;
}

export async function isMediaPipeModelAvailable(): Promise<boolean> {
  return getMediaPipeClassifierModule().isModelAvailable();
}

export async function classifyTextWithMediaPipe(
  text: string,
): Promise<string | null> {
  return getMediaPipeClassifierModule().classifyText(text);
}
