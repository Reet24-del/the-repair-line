module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const { assessRepair } = await import('../assessment.mjs');
  const result = await assessRepair(req.body);
  return res.status(result.status).json(result.body);
};
