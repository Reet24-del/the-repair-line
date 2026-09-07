import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createRepair, pledgeRepair, queryRepairs } from './snowflake/client.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const [key, ...parts] = line.split('=');
    if (key && !key.startsWith('#') && !process.env[key]) process.env[key] = parts.join('=').trim();
  }
}

const app = express();
app.use(express.json({ limit: '8mb' }));
await mkdir('uploads', { recursive: true });
app.use('/uploads', express.static('uploads'));

const demoAssessment = {
  severity: 'High', cost: '₹6,500–8,000', plausibility: 'Likely genuine',
  reasoning: 'The submitted description is consistent with a small, local mechanical repair. Cost includes a mason’s visit and replacement linkage.', source: 'demo'
};

app.get('/api/repairs', async (req, res) => {
  if (!process.env.SNOWFLAKE_ACCOUNT) return res.status(503).json({ error: 'Snowflake is not configured.' });
  try { res.json(await queryRepairs({ city: req.query.city, severity: req.query.severity, sort: req.query.sort })); }
  catch (error) { console.error('Snowflake query failed:', error.message); res.status(502).json({ error: 'Repair feed is temporarily unavailable.' }); }
});

app.post('/api/repairs', async (req, res) => {
  const { title, location, severity, cost, people, reason, imageUrl } = req.body ?? {};
  if (!title || !location || !severity || !cost || !people || !reason) return res.status(400).json({ error: 'Complete every repair detail before submitting.' });
  try { await createRepair({ title, location, severity, cost: Number(cost), people: Number(people), reason, imageUrl }); res.status(201).json({ ok: true }); }
  catch (error) { console.error('Repair creation failed:', error.message); res.status(502).json({ error: 'Could not create this repair.' }); }
});

app.post('/api/repairs/:id/pledges', async (req, res) => {
  const amount = Number(req.body?.amount ?? 1000);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Pledge amount must be positive.' });
  try { const updated = await pledgeRepair(Number(req.params.id), amount); res.json({ ok: true, updated }); }
  catch (error) { console.error('Pledge failed:', error.message); res.status(502).json({ error: 'Could not record this pledge.' }); }
});

app.post('/api/upload', async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body ?? {};
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
  if (!imageBase64 || !extension) return res.status(400).json({ error: 'Upload a JPG, PNG, or WebP image.' });
  const name = `${randomUUID()}.${extension}`;
  await writeFile(`uploads/${name}`, Buffer.from(imageBase64, 'base64'));
  res.status(201).json({ url: `/uploads/${name}` });
});

app.post('/api/assess', async (req, res) => {
  const { description, imageBase64, mimeType = 'image/jpeg' } = req.body ?? {};
  if (!imageBase64) return res.status(400).json({ error: 'Add a clear photo before assessing this repair.' });
  if (!process.env.GEMINI_API_KEY) return res.json(demoAssessment);
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You assess small shared community repairs in India. Inspect the supplied image and description. Return only JSON with severity (Low, Medium, or High), cost (a directional INR range), plausibility (Likely genuine, Needs review, or Unclear), and reasoning (one concise sentence). Never present the cost as a quote. Description: ${description?.trim() || 'No description supplied; assess the image directly.'}`;
    const contents = imageBase64 ? [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }] : prompt;
    const result = await ai.models.generateContent({ model: 'gemini-3.6-flash', contents, config: { responseMimeType: 'application/json' } });
    res.json({ ...JSON.parse(result.text), source: 'gemini' });
  } catch (error) {
    console.error('Gemini assessment failed:', error.message);
    res.status(502).json({ error: 'Assessment is temporarily unavailable. Please try again.' });
  }
});

if (process.env.NODE_ENV === 'production') app.use(express.static('dist'));
else { const { createServer } = await import('vite'); const vite = await createServer({ server: { middlewareMode: true } }); app.use(vite.middlewares); }
app.listen(process.env.PORT || 5173, () => console.log('Repair Line ready'));
