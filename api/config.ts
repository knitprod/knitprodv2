export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    success: true,
    config: {
      gasWebAppUrl: 'https://script.google.com/macros/s/AKfycbzfsNc4kKa3jcyeC646qmVWhaCyvJKWMlGwvcRRJeDLqaTS61bIIteWEYvVb_Gk_Q/exec',
      databaseMode: 'gas'
    }
  });
}
