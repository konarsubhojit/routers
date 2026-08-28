import {CloudGranularity} from '../settings/appSettings';
import {Classification, FileMeta} from './types';

export interface CloudPayload {
  name: string;
  extension?: string;
  sizeBytes?: number;
  mimeType?: string;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

function extensionOf(name: string): string | undefined {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Builds the exact payload sent to the cloud classification tier. Only
 * structural file metadata is ever included here — file contents are never
 * read or transmitted, and only the base file name (never a full path or
 * folder name) is sent.
 */
export function buildCloudPayload(file: FileMeta, granularity: CloudGranularity): CloudPayload {
  const name = basename(file.path);
  const payload: CloudPayload = {name, extension: extensionOf(name)};

  if (granularity === 'filename+metadata') {
    if (file.sizeBytes != null) {
      payload.sizeBytes = file.sizeBytes;
    }
    if (file.mimeType != null) {
      payload.mimeType = file.mimeType;
    }
  }

  return payload;
}

/** Deterministic, non-cryptographic hash used only as a cache lookup key. */
export function hashCloudPayload(payload: CloudPayload): string {
  const serialized = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < serialized.length; i += 1) {
    hash = Math.imul(31, hash) + serialized.charCodeAt(i);
  }
  return `cloud-${(hash >>> 0).toString(16)}`;
}

export interface CloudClassificationResult {
  classification: Classification;
  confidence: number;
}
