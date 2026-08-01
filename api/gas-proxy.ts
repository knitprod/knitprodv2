export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let targetUrl = 'https://script.google.com/macros/s/AKfycbzfsNc4kKa3jcyeC646qmVWhaCyvJKWMlGwvcRRJeDLqaTS61bIIteWEYvVb_Gk_Q/exec';

  if (req.method === 'GET' && req.query?.url) {
    targetUrl = String(req.query.url);
  } else if (req.method === 'POST' && req.body?.url) {
    targetUrl = String(req.body.url);
  }

  let trimmedUrl = targetUrl.trim();
  if (trimmedUrl.endsWith('/dev')) {
    trimmedUrl = trimmedUrl.replace(/\/dev$/, '/exec');
  } else if (trimmedUrl.endsWith('/edit')) {
    trimmedUrl = trimmedUrl.replace(/\/edit$/, '/exec');
  } else if (trimmedUrl.includes('/macros/s/') && !trimmedUrl.endsWith('/exec')) {
    trimmedUrl = trimmedUrl.replace(/\/+$/, '') + '/exec';
  }

  try {
    if (req.method === 'GET') {
      const urlObj = new URL(trimmedUrl);
      if (req.query) {
        for (const [key, val] of Object.entries(req.query)) {
          if (key !== 'url') {
            urlObj.searchParams.append(key, String(val));
          }
        }
      }

      const response = await fetch(urlObj.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        redirect: 'follow'
      });

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return res.status(200).json(json);
      } catch (e) {
        return res.status(200).json({ success: false, message: 'Invalid JSON response from Apps Script', raw: text });
      }
    } else {
      let postBody = {};
      if (typeof req.body === 'string') {
        try { postBody = JSON.parse(req.body); } catch(e) {}
      } else if (req.body) {
        postBody = { ...req.body };
      }
      delete (postBody as any).url;

      const response = await fetch(trimmedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(postBody),
        redirect: 'follow'
      });

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return res.status(200).json(json);
      } catch (e) {
        return res.status(200).json({ success: false, message: 'Invalid JSON response from Apps Script', raw: text });
      }
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Serverless Proxy Error' });
  }
}
