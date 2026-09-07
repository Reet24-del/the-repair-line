const cities = new Set(['Lucknow', 'Kanpur', 'Prayagraj', 'Varanasi']);
const severities = new Set(['Low', 'Medium', 'High']);

export class ValidationError extends Error {}

function positiveInteger(value, message) {
  if (!['string', 'number'].includes(typeof value) || (typeof value === 'string' && !/^\d+$/.test(value.trim()))) throw new ValidationError(message);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new ValidationError(message);
  return number;
}

export function parseRepair(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Complete every repair detail before submitting.');
  const { title, location, severity, reason, imageUrl } = body;
  if (typeof title !== 'string' || title.trim().length < 10 || title.trim().split(/\s+/).length < 2) throw new ValidationError('Describe the repair in at least two words and 10 characters.');
  if (!cities.has(location)) throw new ValidationError('Choose a city for this repair.');
  if (!severities.has(severity)) throw new ValidationError('Repair severity must be Low, Medium, or High.');
  if (typeof reason !== 'string' || !reason.trim()) throw new ValidationError('Include the reason this repair is needed.');
  const cost = positiveInteger(body.cost, 'Repair cost must be a positive whole-rupee amount.');
  if (cost > 10000) throw new ValidationError('Repairs must cost ₹10,000 or less.');
  const people = positiveInteger(body.people, 'People helped must be a positive whole number.');
  if (imageUrl != null) {
    if (typeof imageUrl !== 'string') throw new ValidationError('Upload a JPG, PNG, or WebP repair photo.');
    const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageUrl);
    if (!match || match[1].length % 4 !== 0) throw new ValidationError('Upload a JPG, PNG, or WebP repair photo.');
    if (Buffer.byteLength(match[1], 'base64') > 2 * 1024 * 1024) throw new ValidationError('Repair photos must be 2 MiB or smaller.');
  }
  return { title: title.trim(), location, severity, cost, people, reason: reason.trim(), imageUrl: imageUrl ?? null };
}

export function parsePledge(id, amount = 1000) {
  return {
    id: positiveInteger(id, 'Repair ID must be a positive whole number.'),
    amount: positiveInteger(amount, 'Pledge amount must be a positive whole-rupee amount.')
  };
}
