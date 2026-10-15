# Workways employment application (Node.js + Vercel)

A responsive, consent-based employment enquiry form inspired by common recruitment landing pages. It does **not** copy the referenced website's branding or assets. It does not request passport/ID numbers or document scans and does not persist submissions to a database. After consent, a serverless Node.js function sends an application summary to the configured WhatsApp Business recipient using Meta's Cloud API **approved message template**.

## Files

- `public/index.html` — application form
- `public/styles.css` — responsive styling
- `public/app.js` — browser-side validation and AJAX submission
- `public/privacy.html` — privacy notice; replace contact placeholders before launch
- `api/submit.js` — validation and WhatsApp Cloud API integration
- `vercel.json` — security headers and Vercel configuration
- `.env.example` — environment variable template

## 1. Prerequisites

- A Vercel account and a Git repository.
- A Meta business portfolio, WhatsApp Business Account, registered/eligible business phone number, WhatsApp Phone Number ID, and access token with permission to send messages.
- An **approved WhatsApp message template** in the language configured below. The sample API sends a template called `employment_application_notice` with one BODY text variable (`{{1}}`). Create and get approval for a suitable template before production. Because this is a business-initiated notification, do not assume free-form text messages will be accepted outside the customer-service window.

## 2. Configure the WhatsApp template

In WhatsApp Manager, create a suitable utility template, for example:

> New employment application received:\n{{1}}

Use one body variable in the approved template and keep the message appropriate for the purpose. Meta reviews and controls template approval. The recipient must be an opted-in recipient where required by WhatsApp policies. If Meta rejects the template or parameters, the API returns a delivery error.

The application summary is intentionally limited to the form fields above. Do not add government ID/passport numbers, scans, health details, or financial details to WhatsApp messages.

## 3. Configure environment variables

Copy `.env.example` values into **Vercel → Project → Settings → Environment Variables**. Do not commit actual secrets to Git and do not expose them in browser-side code.

- `WA_ACCESS_TOKEN`: Meta WhatsApp Cloud API access token.
- `WA_PHONE_NUMBER_ID`: sender phone-number ID from WhatsApp Manager / Meta app setup, not the displayed phone number.
- `WA_API_VERSION`: a Graph API version supported by your Meta app. Update it when Meta sunsets that version.
- `WA_ADMIN_RECIPIENT`: destination WhatsApp number in international digits-only format, e.g. `2547XXXXXXXX` (no plus, spaces or punctuation).
- `WA_TEMPLATE_NAME`: exact approved template name.
- `WA_TEMPLATE_LANGUAGE`: exact approved template language code, often `en`.
- `SITE_ORIGIN`: exact production origin, e.g. `https://your-project.vercel.app`. Set it to the production domain without a trailing path. Preview deployments may be rejected when this is set; use a separate preview value if needed.

After changing environment variables, redeploy; Vercel applies changes to new deployments.

## 4. Deploy to Vercel

1. Upload/push this project to a new GitHub repository.
2. In Vercel, select **Add New → Project**, import the repository, and deploy. No framework preset or build command is required; the static files are in `public/` and `api/submit.js` is a Node.js serverless function.
3. Add the environment variables above in project settings, then redeploy.
4. Visit the production URL and submit a test using a consenting test applicant. Confirm the message arrives at the destination number.

### Local development

Install Node.js 20 or newer. Install Vercel CLI and run:

```bash
npm install -g vercel
vercel dev
```

Set development environment variables in `.env.local` (never commit it), or use `vercel env pull .env.local` after linking the project. Then visit the local URL shown by `vercel dev`.

## 5. Security and production checklist

- Replace all privacy notice placeholders and identify the actual data controller/contact.
- Use a least-privilege Meta system-user token; rotate it if exposed. Store secrets only in Vercel environment variables.
- This project deliberately does not persist form contents. WhatsApp history and provider logs may still retain data; set access and retention rules.
- Add a persistent rate limiter/WAF (e.g. Vercel Firewall rules or an external rate-limit service) before public launch. The honeypot and validation are only basic abuse controls and are not a substitute for distributed rate limiting or CAPTCHA when needed.
- Consider an idempotency/rate-limit store to reduce duplicate notifications. Serverless in-memory counters are not reliable across instances.
- Review applicable privacy/data-protection and recruitment laws. Obtain consent before sending data, and do not make a misleading job guarantee or imply affiliation with the referenced website.
- The current form intentionally omits passport number, national ID, document upload, and bank details.

## Troubleshooting

- `503 Application delivery is not configured`: check all required environment variables and redeploy.
- `502 could not deliver`: inspect Vercel Function logs for the status/code only (the code intentionally avoids logging application contents or tokens); confirm template name/language, template approval, sender ID, access-token permissions, recipient format, and WhatsApp policy requirements.
- `403 Request origin not allowed`: set `SITE_ORIGIN` to the exact deployed origin and redeploy.
- `400 invalid fields`: phone must contain 8–15 digits with country code; required fields and the consent checkbox must be completed.

## API contract

`POST /api/submit` with `Content-Type: application/json`. The form itself submits the expected fields. The endpoint validates input and consent, sends the WhatsApp template message, and returns JSON `{ "ok": true, "message": "..." }` on success. It does not save a copy to a database.
