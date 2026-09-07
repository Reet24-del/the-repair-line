module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const amount = Number(req.body?.amount ?? 1000);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Pledge amount must be positive.' });
  try {
    const { pledgeRepair } = await import('../../../snowflake/client.mjs');
    await pledgeRepair(Number(req.query.id), amount);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Pledge failed:', error.message);
    return res.status(502).json({ error: 'Could not record this pledge.' });
  }
}
