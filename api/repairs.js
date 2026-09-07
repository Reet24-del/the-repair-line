module.exports = async function handler(req, res) {
  try {
    const { createRepair, queryRepairs } = await import('../snowflake/client.mjs');
    if (req.method === 'GET') return res.status(200).json(await queryRepairs({ city: req.query.city, severity: req.query.severity, sort: req.query.sort }));
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
    const { title, location, severity, cost, people, reason, imageUrl } = req.body ?? {};
    if (!title || !location || !severity || !cost || !people || !reason) return res.status(400).json({ error: 'Complete every repair detail before submitting.' });
    await createRepair({ title, location, severity, cost: Number(cost), people: Number(people), reason, imageUrl });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Repair operation failed:', error.message);
    return res.status(502).json({ error: 'The repair line is temporarily unavailable.' });
  }
}
