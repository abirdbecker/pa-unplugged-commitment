export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO         = 'abirdbecker/pa-unplugged-commitment';
  const FILE_PATH    = 'families.json';
  const API_BASE     = 'https://api.github.com';

  try {
    const body = req.body;
    const { parentName, publicName, children: childrenJson } = body;

    if (!parentName) return res.status(400).json({ error: 'Missing name' });

    // Parse children
    let children = [];
    try { children = JSON.parse(childrenJson || '[]'); } catch (e) {}

    // Fetch current families.json from GitHub
    const fileRes = await fetch(`${API_BASE}/repos/${REPO}/contents/${FILE_PATH}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const fileData = await fileRes.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const families = JSON.parse(currentContent);

    // Add or update this family
    if (publicName !== 'no') {
      const existing = families.find(f => f.name === parentName.trim());
      if (existing) {
        children.forEach(c => existing.children.push(c));
      } else {
        families.push({ name: parentName.trim(), children });
        families.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    // Write updated file back to GitHub
    const updatedContent = Buffer.from(JSON.stringify(families, null, 2)).toString('base64');
    await fetch(`${API_BASE}/repos/${REPO}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Add family: ${parentName.trim()}`,
        content: updatedContent,
        sha: fileData.sha,
      }),
    });

    return res.status(200).json({ result: 'success' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
