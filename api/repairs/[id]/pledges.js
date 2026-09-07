module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { parsePledge } = await import('../../../snowflake/validation.mjs');
    const { id, amount } = parsePledge(req.query?.id ?? req.params?.id, req.body?.amount);
    const { pledgeRepair } = await import('../../../snowflake/client.mjs');
    const repair = await pledgeRepair(id, amount);
    if (!repair) return res.status(404).json({ error: 'Repair not found.' });
    return res.status(200).json({ ok: true, updated: 1, repair });
  } catch (error) {
    const { ValidationError } = await import('../../../snowflake/validation.mjs');
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    console.error('Pledge failed:', error.code ?? 'UNKNOWN', error.missing ?? []);
    return res.status(502).json({ error: 'Could not record this pledge.' });
  }
}
