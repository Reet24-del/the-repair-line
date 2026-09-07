const { GoogleGenAI } = require('@google/genai');

const preview = {
  severity: 'Medium',
  cost: '₹2,000–4,000',
  plausibility: 'Needs review',
  reasoning: 'We could not reach the live assessment service, so this is a preview estimate only.',
  source: 'preview'
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const { description, imageBase64, mimeType = 'image/jpeg' } = req.body ?? {};
  if (!imageBase64) return res.status(400).json({ error: 'Add a clear photo before assessing this repair.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Live assessment is not configured yet.' });
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You assess small shared community repairs in India. Inspect the supplied image and description. Return only valid JSON with severity (Low, Medium, or High), cost (a directional INR range), plausibility (Likely genuine, Needs review, or Unclear), and reasoning (one concise sentence). Never call the cost a quote. Description: ${description?.trim() || 'No description supplied; assess the image directly.'}`;
    const contents = imageBase64
      ? [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }]
      : prompt;
    const result = await ai.models.generateContent({ model: 'gemini-3.6-flash', contents, config: { responseMimeType: 'application/json' } });
    const parsed = JSON.parse(result.text);
    return res.status(200).json({ ...parsed, source: 'gemini' });
  } catch (error) {
    console.error('Gemini assessment failed:', error.message);
    return res.status(200).json(preview);
  }
}
