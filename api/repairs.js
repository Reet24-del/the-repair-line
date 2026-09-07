module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { parseRepair } = await import('../snowflake/validation.mjs');
    const repairInput = req.method === 'POST' ? parseRepair(req.body) : null;
    const { createRepair, queryRepairs } = await import('../snowflake/client.mjs');
    if (req.method === 'GET') return res.status(200).json(await queryRepairs({ city: req.query?.city, severity: req.query?.severity, sort: req.query?.sort }));
    const repair = await createRepair(repairInput);
    return res.status(201).json({ ok: true, repair });
  } catch (error) {
    const { ValidationError } = await import('../snowflake/validation.mjs');
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    console.error('Repair operation failed:', error.code ?? 'UNKNOWN', error.missing ?? []);
    return res.status(502).json({ error: 'The repair line is temporarily unavailable.' });
  }
}
