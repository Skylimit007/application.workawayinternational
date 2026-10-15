const MAX_BODY_BYTES = 16_000;
const allowedFields = [
  'applicationReference', 'fullName', 'dateOfBirth', 'sex', 'nationality', 'country',
  'education', 'occupation', 'jobInterest', 'availability', 'criminalRecord',
  'previousVisa', 'visaType', 'nationalIdNumber', 'passportNumber', 'passportExpiry', 'phone', 'email'
];

function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(status).json(payload);
}
function clean(value, max = 300) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function validPhone(value) { return /^[1-9]\d{7,14}$/.test(value); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  const origin = req.headers.origin;
  const configuredOrigin = process.env.SITE_ORIGIN;
  if (configuredOrigin && origin) {
    try { if (new URL(origin).origin !== new URL(configuredOrigin).origin) return sendJson(res, 403, { error: 'Request origin not allowed.' }); }
    catch { return sendJson(res, 403, { error: 'Request origin not allowed.' }); }
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return sendJson(res, 415, { error: 'Send JSON data.' });

  try {
    let raw = '';
    if (req.body && typeof req.body === 'object') raw = JSON.stringify(req.body);
    else if (typeof req.body === 'string') raw = req.body;
    else {
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return sendJson(res, 413, { error: 'Submission is too large.' });
      }
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return sendJson(res, 413, { error: 'Submission is too large.' });
    const data = req.body && typeof req.body === 'object' ? req.body : JSON.parse(raw || '{}');
    if (clean(data.website, 200)) return sendJson(res, 200, { ok: true });
    if (data.consent !== true || data.accuracyConfirmed !== true || data.documentsReady !== true) return sendJson(res, 400, { error: 'Confirm the required declarations and privacy consent.' });

    const a = {};
    for (const field of allowedFields) a[field] = clean(data[field], ['nationalIdNumber', 'passportNumber'].includes(field) ? 40 : field === 'email' ? 254 : 180);
    if (a.fullName.length < 2) return sendJson(res, 400, { error: 'Enter your full name.' });
    if (!validDate(a.dateOfBirth) || new Date(`${a.dateOfBirth}T00:00:00Z`) >= new Date()) return sendJson(res, 400, { error: 'Enter a valid date of birth in the past.' });
    if (!a.sex || !a.nationality || !a.country || !a.education || !a.occupation || !a.jobInterest || !a.availability || !a.criminalRecord || !a.previousVisa || !a.visaType) return sendJson(res, 400, { error: 'Complete all required applicant information.' });
    if (!a.nationalIdNumber || !a.passportNumber || !validDate(a.passportExpiry) || new Date(`${a.passportExpiry}T23:59:59Z`) <= new Date()) return sendJson(res, 400, { error: 'Enter a valid passport number and future expiry date.' });
    if (!validPhone(a.phone.replace(/[+\s()-]/g, ''))) return sendJson(res, 400, { error: 'Enter a WhatsApp number with country code (8–15 digits).' });
    if (a.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email) || a.email.length > 254)) return sendJson(res, 400, { error: 'Enter a valid email address or leave it blank.' });

    const required = ['WA_ACCESS_TOKEN', 'WA_PHONE_NUMBER_ID', 'WA_ADMIN_RECIPIENT', 'WA_TEMPLATE_NAME', 'WA_TEMPLATE_LANGUAGE'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
      console.error('WhatsApp configuration missing:', missing.join(', '));
      return sendJson(res, 503, { error: 'Application delivery is not configured yet. Please try again later.' });
    }
    if (!validPhone(process.env.WA_ADMIN_RECIPIENT)) return sendJson(res, 503, { error: 'Application delivery is not configured correctly.' });

    const reference = /^WAI-[A-Z0-9-]{8,30}$/.test(a.applicationReference) ? a.applicationReference : `WAI-${Date.now().toString(36).toUpperCase()}`;
    const summary = [
      'New employment application', `Reference: ${reference}`, `Full name: ${a.fullName}`,
      `Date of birth: ${a.dateOfBirth}`, `Sex: ${a.sex}`, `Nationality: ${a.nationality}`,
      `Current country: ${a.country}`, `Education: ${a.education}`, `Occupation: ${a.occupation}`,
      `Job interested in: ${a.jobInterest}`, `Availability: ${a.availability}`,
      `Criminal record: ${a.criminalRecord}`, `Previous U.S. visa: ${a.previousVisa}`,
      `Visa type: ${a.visaType}`, `National ID number: ${a.nationalIdNumber}`, `Passport number: ${a.passportNumber}`,
      `Passport expiry: ${a.passportExpiry}`, `WhatsApp: ${a.phone}`, `Email: ${a.email || 'Not provided'}`
    ].join('\n').slice(0, 950);

    const apiVersion = (process.env.WA_API_VERSION || 'v23.0').replace(/[^v0-9.]/g, '');
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(process.env.WA_PHONE_NUMBER_ID)}/messages`;
    const waResponse = await fetch(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: process.env.WA_ADMIN_RECIPIENT,
        type: 'template', template: {
          name: process.env.WA_TEMPLATE_NAME, language: { code: process.env.WA_TEMPLATE_LANGUAGE },
          components: [{ type: 'body', parameters: [{ type: 'text', text: summary }] }]
        }
      }), signal: AbortSignal.timeout(10000)
    });
    const result = await waResponse.json().catch(() => ({}));
    if (!waResponse.ok) {
      console.error('WhatsApp API rejected notification:', waResponse.status, result?.error?.code || 'unknown_code');
      return sendJson(res, 502, { error: 'We could not deliver the application notification. Please try again later.' });
    }
    return sendJson(res, 200, { ok: true, message: 'Application submitted successfully.', reference });
  } catch (error) {
    console.error('Application submission failed:', error?.name || 'UnknownError');
    return sendJson(res, 400, { error: 'We could not process this submission. Check the fields and try again.' });
  }
}
