import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.SCAN_SECRET?.trim();
  if (secret && req.headers['x-scan-secret'] !== secret) {
    return res.status(401).json({ error: 'Ugyldig eller manglende x-scan-secret.' });
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return res.status(503).json({ error: 'GITHUB_TOKEN er ikke satt på serveren.' });
  }

  const repo = process.env.GITHUB_REPO?.trim() || 'pitjohnsen-stack/bilsnapper';
  const workflow = process.env.GITHUB_WORKFLOW_FILE?.trim() || 'scraper.yml';
  const ref = process.env.GITHUB_WORKFLOW_REF?.trim() || 'main';

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'bilsnapper-server',
        },
        body: JSON.stringify({ ref }),
      },
    );

    if (!ghRes.ok) {
      const text = await ghRes.text();
      return res.status(502).json({ error: `GitHub API ${ghRes.status}: ${text.slice(0, 300)}` });
    }

    return res.json({ ok: true, status: 'Scraper startet via GitHub Actions' });
  } catch (e) {
    console.error('GitHub dispatch feilet:', e);
    return res.status(500).json({ error: 'Kunne ikke kalle GitHub API.' });
  }
}
