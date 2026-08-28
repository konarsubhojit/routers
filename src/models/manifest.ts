import {ModelManifest} from './types';

function isModelManifest(value: unknown): value is ModelManifest {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.sha256 === 'string' &&
    typeof candidate.size === 'number'
  );
}

/**
 * Fetches and validates a model manifest of the shape
 * `{version, url, sha256, size}`. Intended for a Cloudflare R2 (or any
 * static HTTP host) hosted JSON file describing the current model release.
 */
export async function fetchModelManifest(manifestUrl: string): Promise<ModelManifest> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Manifest request failed with status ${response.status}`);
  }

  const json: unknown = await response.json();
  if (!isModelManifest(json)) {
    throw new Error('Manifest response did not match {version, url, sha256, size}');
  }

  return json;
}
