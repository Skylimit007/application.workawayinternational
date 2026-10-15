# WorkAway International employment application — direct WhatsApp flow

This is a static website hosted on Vercel. When the applicant presses **Click Here to Submit**, the browser validates the form, builds a WhatsApp message from the entered fields, and opens WhatsApp/WhatsApp Web with that message prefilled.

**The website does not send the message automatically. The applicant must review the prefilled message and press Send in WhatsApp.** This version does not call `/api/submit` and does not require WhatsApp Cloud API credentials.

## Configure the recipient

Open `public/app.js` and replace:

```js
const WHATSAPP_RECIPIENT = '2547XXXXXXXX';
```

with the recruitment recipient's WhatsApp number in international digits-only format, for example:

```js
const WHATSAPP_RECIPIENT = '254712345678';
```

Use the actual authorized recipient number. Do not include `+`, spaces, parentheses, or hyphens.

## Deploy

1. Upload this project to your GitHub repository.
2. Import the repository into Vercel, or redeploy your existing Vercel project.
3. No WhatsApp access token, Phone Number ID, template, or API environment variables are required for this direct click-to-chat flow.
4. Test with fictional information and verify the correct recipient is shown before pressing Send.

## Privacy and sensitive information

The prefilled message includes the form fields, including National ID number, passport number, date of birth, and contact details, because the current form consent covers those fields. These are sensitive details. A WhatsApp click-to-chat URL contains the prefilled message text when WhatsApp is opened, and the recipient does not receive the message until the applicant presses Send.

For better privacy, avoid sending National ID and passport numbers through WhatsApp. Prefer sending only an application reference and contact details, and use a verified, secure, access-controlled channel for identity information. Verify the recruitment organisation and recipient before submitting. Do not use real personal details when testing.

## Files

- `public/index.html` — application form and consent text
- `public/styles.css` — styling
- `public/app.js` — client-side validation and WhatsApp click-to-chat message creation
- `public/privacy.html` — privacy notice
- `vercel.json` — Vercel security headers

## Notes

- No backend API is used for submissions.
- No application data is stored by this static website.
- The application reference is generated in the browser and is not stored by the website.
- The WhatsApp app or WhatsApp Web must be available on the user's device.
- A successful handoff to WhatsApp does not prove that the applicant sent the message or that the recipient received it.
