const { calculateRisk } = require('../lib/model');

const ALLOWED_ORIGINS = [
  'https://mortality-risk-calc.vercel.app',
  'https://jnjmaster.weguide.com.au',
  'https://master.weguide.com.au',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /\.weguide\.com\.au$/i.test(origin);

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function checkApiKey(req) {
  const expected = process.env.CALC_API_KEY;
  if (!expected) return true;
  return req.headers['x-api-key'] === expected;
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!checkApiKey(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payload = calculateRisk(body || {});
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid request' });
  }
};
