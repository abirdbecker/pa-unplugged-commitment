export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const MAILCHIMP_KEY = process.env.MAILCHIMP_API_KEY;
  const REPO         = 'abirdbecker/pa-unplugged-commitment';
  const FILE_PATH    = 'families.json';
  const API_BASE     = 'https://api.github.com';
  const MC_LIST_ID   = '66491fade8';
  const MC_DC        = 'us20';

  try {
    const body = req.body;
    const { parentName, email, publicName, emailList, children: childrenJson } = body;

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
    const data = JSON.parse(currentContent);
    const families = data.families || data;

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
    const newTotal = (data.totalCount || families.length) + 1;
    const updatedData = { totalCount: newTotal, families };

    const updatedContent = Buffer.from(JSON.stringify(updatedData, null, 2)).toString('base64');
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

    // Add to Mailchimp if opted in
    if (emailList === 'yes' && email && MAILCHIMP_KEY) {
      await fetch(`https://${MC_DC}.api.mailchimp.com/3.0/lists/${MC_LIST_ID}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed',
          merge_fields: { FNAME: parentName.trim() },
        }),
      });
    }

    return res.status(200).json({ result: 'success' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
