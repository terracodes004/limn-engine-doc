export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'Discord webhook not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const reports = Array.isArray(body && body.reports) ? body.reports : [];
  if (reports.length === 0) {
    return res.status(400).json({ error: 'No reports provided' });
  }

  const descriptionText = reports.map(r =>
    '• **Time:** ' + (r.timestamp || 'unknown') + '\n' +
    '  **Error:** ' + (r.error || 'N/A') + '\n' +
    '  **File:** ' + (r.file || 'N/A') + ':' + (r.line || 'N/A') + '\n' +
    '  **Desc:** ' + (r.description || 'N/A')
  ).join('\n\n');

  try {
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🚨 **Limn Engine - Offline Bug Report(s):**\n' + descriptionText
      })
    });

    if (!discordRes.ok) {
      const detail = await discordRes.text();
      return res.status(discordRes.status).json({ error: 'Discord rejected the request', detail });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach Discord', detail: err.message });
  }
}
