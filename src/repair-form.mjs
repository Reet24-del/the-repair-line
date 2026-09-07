export const REPAIR_CITIES = ['Lucknow', 'Kanpur', 'Prayagraj', 'Varanasi'];
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// A range is directional guidance; use its upper end as the funding target.
export function parseRepairCost(value) {
  const normalized = String(value ?? '').trim()
    .replace(/(?:₹|INR|Rs\.?)/gi, '')
    .replace(/^(?:about|approximately|approx\.?|up to)\s*/i, '').trim();
  const amount = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)';
  const match = normalized.match(new RegExp(`^(${amount})(?:\\s*(?:[-–—]|to)\\s*(${amount}))?$`, 'i'));
  if (!match) throw new Error('The assessment needs a clear rupee amount or range before this repair can be submitted. Please assess it again.');
  const lower = Number(match[1].replaceAll(',', ''));
  const upper = Number((match[2] ?? match[1]).replaceAll(',', ''));
  if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper) || lower < 0 || upper <= 0 || lower > upper) {
    throw new Error('The assessment has an invalid cost range. Please assess this repair again.');
  }
  if (upper > 10000) throw new Error('This repair is above the ₹10,000 limit. Please submit a smaller, clearly defined repair.');
  return upper;
}

export function repairTitle(description) {
  const title = description.trim().replace(/\s+/g, ' ').slice(0, 120);
  const words = title.match(/[\p{L}\p{M}]+/gu) ?? [];
  if (title.length < 10 || words.length < 2) throw new Error('Describe the shared item and what is broken in at least a short sentence.');
  return title;
}

export function validatePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP photo.');
  }
  if (file.size > MAX_PHOTO_BYTES) throw new Error('This photo is too large. Choose an image no larger than 2 MB.');
  if (file.size === 0) throw new Error('This photo is empty. Please choose another image.');
}
