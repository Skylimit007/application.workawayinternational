const MAX_BODY_BYTES = 12_000;
const allowedFields = [
  'fullName', 'email', 'phone', 'nationality', 'country', 'city',
  'education', 'occupation', 'jobInterest', 'availability', 'experience', 'message'
];

function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(payload);
}

function clean(value, max = 300) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validPhone(value) {
  return /^[1-9]\d{7,14}$/.test(value);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const origin = req.headers.origin;
  const configuredOrigin = process.env.SITE_ORIGIN;
  if (configuredOrigin && origin) {
    try {
      if (new URL(origin).origin !== new URL(configuredOrigin).origin) {
        return sendJson(res, 403, { error: 'Request origin not allowed.' });
      }
    } catch {
      return sendJson(res, 403, { error: 'Request origin not allowed.' });
    }
  }

  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().includes('application/json')) {
    return sendJson(res, 415, { error: 'Send JSON data.' });
  }

  let raw = '';
  try {
    if (typeof req.body === 'object' && req.body !== null) {
      raw = JSON.stringify(req.body);
    } else if (typeof req.body === 'string') {
      raw = req.body;
    } else {
      // Vercel normally parses JSON bodies; this branch supports raw stream bodies.
      raw = '';
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
          return sendJson(res, 413, { error: 'Submission is too large.' });
        }
      }
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return sendJson(res, 413, { error: 'Submission is too large.' });
    }
    const data = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(raw || '{}');

    // Honeypot: silently accept bots without forwarding anything.
    if (clean(data.website, 200)) return sendJson(res, 200, { ok: true });
    if (data.consent !== true) return sendJson(res, 400, { error: 'Please confirm the privacy consent before submitting.' });

    const application = {};
    for (const field of allowedFields) application[field] = clean(data[field], field === 'message' ? 800 : 180);

    if (application.fullName.length < 2) return sendJson(res, 400, { error: 'Enter your full name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email) || application.email.length > 254) {
      return sendJson(res, 400, { error: 'Enter a valid email address.' });
    }
    if (!validPhone(application.phone.replace(/[+\s()-]/g, ''))) {
      return sendJson(res, 400, { error: 'Enter a phone number with country code, using 8–15 digits.' });
    }
    if (!application.nationality || !application.jobInterest) {
      return sendJson(res, 400, { error: 'Complete nationality and job interest.' });
    }

    const required = ['WA_ACCESS_TOKEN', 'WA_PHONE_NUMBER_ID', 'WA_ADMIN_RECIPIENT', 'WA_TEMPLATE_NAME', 'WA_TEMPLATE_LANGUAGE'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
      console.error('WhatsApp configuration missing:', missing.join(', '));
      return sendJson(res, 503, { error: 'Application delivery is not configured yet. Please try again later.' });
    }
    if (!validPhone(process.env.WA_ADMIN_RECIPIENT)) {
      console.error('WA_ADMIN_RECIPIENT must be country code + number, digits only.');
      return sendJson(res, 503, { error: 'Application delivery is not configured correctly.' });
    }

    // Minimize sensitive data: do not ask for or forward passport numbers, IDs, or document scans.
    const summary = [
      'New employment application',
      `Name: ${application.fullName}`,
      `Email: ${application.email}`,
      `Phone: ${application.phone}`,
      `Nationality: ${application.nationality}`,
      `Country/city: ${[application.country, application.city].filter(Boolean).join(', ') || 'Not provided'}`,
      `Education: ${application.education || 'Not provided'}`,
      `Occupation: ${application.occupation || 'Not provided'}`,
      `Job interest: ${application.jobInterest}`,
      `Availability: ${application.availability || 'Not provided'}`,
      `Experience: ${application.experience || 'Not provided'}`,
      `Additional message: ${application.message || 'None'}`
    ].join('\n').slice(0, 900);

    const apiVersion = (process.env.WA_API_VERSION || 'v23.0').replace(/[^v0-9.]/g, '');
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(process.env.WA_PHONE_NUMBER_ID)}/messages`;
    const waResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: process.env.WA_ADMIN_RECIPIENT,
        type: 'template',
        template: {
          name: process.env.WA_TEMPLATE_NAME,
          language: { code: process.env.WA_TEMPLATE_LANGUAGE },
          components: [{ type: 'body', parameters: [{ type: 'text', text: summary }] }]
        }
      }),
      signal: AbortSignal.timeout(10000)
    });

    const result = await waResponse.json().catch(() => ({}));
    if (!waResponse.ok) {
      // Do not log application data or access tokens.
      console.error('WhatsApp API rejected notification:', waResponse.status, result?.error?.code || 'unknown_code');
      return sendJson(res, 502, { error: 'We could not deliver the application notification. Please try again later.' });
    }

    return sendJson(res, 200, { ok: true, message: 'Your application was submitted successfully.' });
  } catch (error) {
    console.error('Application submission failed:', error?.name || 'UnknownError');
    return sendJson(res, 400, { error: 'We could not process this submission. Check the fields and try again.' });
  }
}
