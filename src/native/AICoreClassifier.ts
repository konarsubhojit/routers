import {NativeModules} from 'react-native';

interface AICoreClassifierModuleSpec {
  isAvailable(): Promise<boolean>;
  classifyPath(path: string): Promise<string | null>;
}

function getAICoreClassifierModule(): AICoreClassifierModuleSpec {
  const module = NativeModules
    .AICoreClassifierModule as AICoreClassifierModuleSpec | undefined;
  if (module == null) {
    throw new Error('AICoreClassifierModule is not available on this platform.');
  }

  return module;
}

export async function isAICoreAvailable(): Promise<boolean> {
  return getAICoreClassifierModule().isAvailable();
}

export async function classifyPathWithAICore(
  path: string,
): Promise<string | null> {
  return getAICoreClassifierModule().classifyPath(path);
}
