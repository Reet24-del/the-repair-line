import assert from 'node:assert/strict';
import { test } from 'node:test';
import assessHandler from '../api/assess.js';
import { assessRepair, ASSESSMENT_MODEL, ASSESSMENT_SCHEMA, MAX_ASSESSMENT_IMAGE_BYTES, validateAssessmentInput } from '../assessment.mjs';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
const input = { description: 'The shared pump handle is broken.', imageBase64: png, mimeType: 'image/png' };
const assessment = {
  isRepairPhoto: true,
  severity: 'Medium',
  cost: '₹2,000–4,000',
  plausibility: 'Likely genuine',
  reasoning: 'The shared pump handle is visibly disconnected and needs its linkage repaired.'
};

function provider(value) {
  return { apiKey: 'unit-test-only', generateContent: async () => ({ text: JSON.stringify(value) }) };
}

function response() {
  return { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
}

test('the serverless route rejects unsupported methods and missing photos', async () => {
  const method = response();
  await assessHandler({ method: 'GET' }, method);
  assert.equal(method.statusCode, 405);
  const missingPhoto = response();
  await assessHandler({ method: 'POST', body: { description: 'Broken pump.' } }, missingPhoto);
  assert.equal(missingPhoto.statusCode, 400);
});

test('valid photos are sent with the existing model and a required output schema', async () => {
  let request;
  const result = await assessRepair(input, {
    apiKey: 'unit-test-only',
    generateContent: async (value) => { request = value; return { text: JSON.stringify(assessment) }; }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ...assessment, requiresReview: false, source: 'gemini' });
  assert.equal(request.model, ASSESSMENT_MODEL);
  assert.equal(request.model, 'gemini-3.6-flash');
  assert.deepEqual(request.config.responseJsonSchema, ASSESSMENT_SCHEMA);
  assert.deepEqual(request.contents[0].parts[1].inlineData, { mimeType: 'image/png', data: png });
  assert.match(request.contents[0].parts[0].text, /Do not invent damage/);
  assert.match(request.contents[0].parts[0].text, /untrusted data/);
});

test('unsupported, malformed, mismatched, empty, and oversized images never contact the provider', async () => {
  let calls = 0;
  const options = { apiKey: 'unit-test-only', generateContent: async () => { calls++; return { text: JSON.stringify(assessment) }; } };
  const invalid = [
    {}, { imageBase64: '' }, { imageBase64: {} },
    { ...input, mimeType: 'image/gif' },
    { ...input, mimeType: 'image/jpeg' },
    { ...input, imageBase64: '%%%%' },
    { ...input, imageBase64: png.slice(0, -1) },
    { ...input, imageBase64: `data:image/png;base64,${png}` },
    { ...input, imageBase64: Buffer.from('This is text, not an image.').toString('base64') },
    { ...input, imageBase64: Buffer.alloc(MAX_ASSESSMENT_IMAGE_BYTES + 1).toString('base64') },
    { ...input, description: {} },
    { ...input, description: 'x'.repeat(2001) }
  ];
  for (const body of invalid) {
    const result = await assessRepair(body, options);
    assert.equal(result.status, 400);
    assert.equal(Object.hasOwn(result.body, 'cost'), false);
  }
  assert.equal(calls, 0);
});

test('the 2 MiB limit is inclusive and accepts a base64 payload without regex stack errors', () => {
  const bytes = Buffer.alloc(MAX_ASSESSMENT_IMAGE_BYTES);
  bytes.set([0xff, 0xd8, 0xff], 0);
  bytes.set([0xff, 0xd9], bytes.length - 2);
  // This fixture exercises the size/type envelope; the provider still decodes
  // and assesses the actual image content.
  const boundary = { imageBase64: bytes.toString('base64'), mimeType: 'image/jpeg' };
  assert.equal(validateAssessmentInput(boundary).imageBase64, boundary.imageBase64);
});

test('missing configuration returns 503 without a fabricated assessment', async () => {
  const result = await assessRepair(input, { apiKey: '' });
  assert.equal(result.status, 503);
  assert.deepEqual(Object.keys(result.body), ['error']);
});

test('provider failures return 502 or 503 and never leak errors or pretend to succeed', async () => {
  for (const [status, expected] of [[500, 502], [401, 503], [403, 503], [404, 503], [429, 503], [503, 503], [undefined, 502]]) {
    const result = await assessRepair(input, {
      apiKey: 'unit-test-only',
      generateContent: async () => { throw Object.assign(new Error('Private provider error with unit-test-only credentials'), { status }); }
    });
    assert.equal(result.status, expected);
    assert.deepEqual(Object.keys(result.body), ['error']);
    assert.doesNotMatch(result.body.error, /Private|credentials|unit-test|preview/i);
  }
});

test('malformed JSON, missing output fields, and invalid values cannot become assessments', async () => {
  const invalid = [
    null, [], {}, { ...assessment, isRepairPhoto: undefined },
    { ...assessment, isRepairPhoto: 'true' },
    { ...assessment, severity: 'Critical' },
    { ...assessment, severity: null },
    { ...assessment, plausibility: 'Definitely authentic' },
    { ...assessment, cost: null }, { ...assessment, cost: 4000 },
    { ...assessment, cost: '₹8,000–4,000' },
    { ...assessment, cost: '₹0–0' },
    { ...assessment, cost: '₹-100–500' },
    { ...assessment, cost: 'Free' },
    { ...assessment, cost: '₹2,000–4,000 guaranteed quote' },
    { ...assessment, cost: '₹1,000–999999999999999999999' },
    { ...assessment, reasoning: '' },
    { ...assessment, reasoning: 'x'.repeat(1201) }
  ];
  for (const value of invalid) {
    const result = await assessRepair(input, provider(value));
    assert.equal(result.status, 502, JSON.stringify(value));
    assert.deepEqual(Object.keys(result.body), ['error']);
  }
  for (const text of ['not JSON', '```json\n{}\n```', '']) {
    const result = await assessRepair(input, { apiKey: 'unit-test-only', generateContent: async () => ({ text }) });
    assert.equal(result.status, 502);
  }
});

test('an unrelated or unclear photo cannot acquire a severity or repair budget', async () => {
  for (const value of [
    { ...assessment, isRepairPhoto: false },
    { ...assessment, plausibility: 'Unclear' },
    { ...assessment, isRepairPhoto: false, severity: null, cost: null, plausibility: 'Unclear' }
  ]) {
    const result = await assessRepair(input, provider(value));
    assert.equal(result.status, 200);
    assert.equal(result.body.severity, null);
    assert.equal(result.body.cost, null);
    assert.equal(result.body.plausibility, 'Unclear');
    assert.equal(result.body.requiresReview, true);
    assert.match(result.body.reasoning, /human review/);
    assert.doesNotMatch(result.body.reasoning, /linkage/);
  }
});

test('uncertain assessments require review and provider metadata cannot bypass that gate', async () => {
  const result = await assessRepair(input, provider({ ...assessment, plausibility: 'Needs review', requiresReview: false, source: 'preview', extra: 'ignored' }));
  assert.equal(result.status, 200);
  assert.equal(result.body.requiresReview, true);
  assert.equal(result.body.source, 'gemini');
  assert.equal(Object.hasOwn(result.body, 'extra'), false);
});
