import express from 'express';
import repairsHandler from './api/repairs.js';
import pledgesHandler from './api/repairs/[id]/pledges.js';
import { assessRepair } from './assessment.mjs';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

if (existsSync('.env')) process.loadEnvFile('.env');

const app = express();
app.use(express.json({ limit: '8mb' }));
await mkdir('uploads', { recursive: true });
app.use('/uploads', express.static('uploads'));

app.get('/api/repairs', repairsHandler);
app.post('/api/repairs', repairsHandler);
app.post('/api/repairs/:id/pledges', pledgesHandler);

app.post('/api/upload', async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body ?? {};
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
  if (!imageBase64 || !extension) return res.status(400).json({ error: 'Upload a JPG, PNG, or WebP image.' });
  const name = `${randomUUID()}.${extension}`;
  await writeFile(`uploads/${name}`, Buffer.from(imageBase64, 'base64'));
  res.status(201).json({ url: `/uploads/${name}` });
});

app.post('/api/assess', async (req, res) => {
  const result = await assessRepair(req.body);
  res.status(result.status).json(result.body);
});

if (process.env.NODE_ENV === 'production') app.use(express.static('dist'));
else { const { createServer } = await import('vite'); const vite = await createServer({ server: { middlewareMode: true } }); app.use(vite.middlewares); }
app.listen(process.env.PORT || 5173, () => console.log('Repair Line ready'));
