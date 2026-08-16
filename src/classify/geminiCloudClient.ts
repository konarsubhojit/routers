import {GoogleGenAI, Type} from '@google/genai';
import {Classification} from './types';
import {CloudClassificationResult, CloudPayload} from './cloudMetadata';

const MODEL = 'gemini-2.5-flash';

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          classification: {
            type: Type.STRING,
            enum: ['TEMPORARY', 'PERMANENT', 'UNKNOWN'],
          },
          confidence: {type: Type.NUMBER},
        },
        required: ['classification', 'confidence'],
      },
    },
  },
  required: ['results'],
};

function isClassification(value: unknown): value is Classification {
  return value === 'TEMPORARY' || value === 'PERMANENT' || value === 'UNKNOWN';
}

function buildPrompt(payloads: CloudPayload[]): string {
  const fileList = payloads
    .map((payload, index) => `${index}: ${JSON.stringify(payload)}`)
    .join('\n');

  return [
    'Classify each downloaded file below as TEMPORARY (safe to clean up, e.g. tickets,',
    'installers, screenshots) or PERMANENT (should be kept, e.g. identity documents,',
    'contracts, statements) using only the filename, extension, size, and MIME type',
    'provided. If unsure, respond UNKNOWN. Respond with one result per input file, in',
    'the same order, each with a confidence between 0 and 1.',
    '',
    fileList,
  ].join('\n');
}

/**
 * Production Gemini client. Sends only the structural metadata payloads
 * (never file contents) and requests structured JSON output matching
 * `RESPONSE_SCHEMA`.
 */
export async function classifyBatchWithGemini(
  payloads: CloudPayload[],
  apiKey: string,
): Promise<CloudClassificationResult[]> {
  const client = new GoogleGenAI({apiKey});

  const response = await client.models.generateContent({
    model: MODEL,
    contents: buildPrompt(payloads),
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (text == null) {
    throw new Error('Gemini response did not contain any text output.');
  }

  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== 'object' ||
    parsed == null ||
    !Array.isArray((parsed as {results?: unknown}).results)
  ) {
    throw new Error('Gemini response did not match the expected {results: [...]} schema.');
  }

  const results = (parsed as {results: unknown[]}).results.map(item => {
    if (typeof item !== 'object' || item == null) {
      throw new Error('Gemini result entry was not an object.');
    }
    const {classification, confidence} = item as {classification?: unknown; confidence?: unknown};
    if (!isClassification(classification) || typeof confidence !== 'number') {
      throw new Error('Gemini result entry did not match the expected shape.');
    }
    return {classification, confidence};
  });

  return results;
}
