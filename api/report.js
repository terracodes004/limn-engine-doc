export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookUrl = process.env.WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('[report] WEBHOOK_URL env var is missing');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const reports = Array.isArray(body && body.reports) ? body.reports : [];
  if (reports.length === 0) {
    return res.status(400).json({ error: 'No reports provided' });
  }

  const embeds = reports.slice(0, 10).map(r => ({
    title: String(r.description || 'Bug report').slice(0, 250),
    color: 0xff4757,
    fields: [
      { name: 'Error', value: String(r.error || 'N/A').slice(0, 1000) },
      { name: 'File',  value: `\`${r.file || 'N/A'}:${r.line || 'N/A'}\``, inline: true },
      { name: 'Time',  value: String(r.timestamp || '?'), inline: true },
    ],
    timestamp: r.timestamp || new Date().toISOString(),
  }));

  try {
    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Limn Bug Reporter',
        content: '🚨 **Limn Engine — Offline Bug Report(s)**',
        embeds,
      }),
    });

    if (!webhookRes.ok) {
      const detail = await webhookRes.text();
      console.error('[report] Webhook error', webhookRes.status, detail);
      return res.status(webhookRes.status).json({
        error: 'Webhook rejected the request',
        detail,
      });
    }

    return res.status(200).json({ ok: true, count: reports.length });
  } catch (err) {
    console.error('[report] fetch failed', err);
    return res.status(500).json({
      error: 'Failed to reach webhook',
      detail: err.message,
    });
  }
}
