/*
 * Direct WhatsApp submission (no backend API).
 *
 * IMPORTANT: Replace WHATSAPP_RECIPIENT below with the recruitment
 * recipient's WhatsApp number in international digits-only format.
 * Example: 254712345678 (no +, spaces, brackets, or dashes).
 *
 * This opens WhatsApp with a prefilled message. The applicant must
 * review it and press Send inside WhatsApp; this website cannot send
 * a WhatsApp message silently.
 */
const WHATSAPP_RECIPIENT = '13474760470';

const form = document.querySelector('#application-form');
const statusBox = document.querySelector('#form-status');
const submitButton = form?.querySelector('button[type="submit"]');
const referenceBox = document.querySelector('#application-reference');

function showStatus(message, kind = 'info') {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `status visible ${kind}`;
  statusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function makeReference() {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WAI-${ymd}-${suffix}`;
}

function clean(value) {
  return String(value ?? '').trim();
}

function selectedValue(name) {
  const field = form.elements.namedItem(name);
  if (!field) return '';
  if (field instanceof RadioNodeList) return clean(field.value);
  return clean(field.value);
}

function validRecipient(number) {
  return /^[1-9]\d{7,14}$/.test(number);
}

function validPhone(number) {
  return /^[+()\d\s-]{8,25}$/.test(number) &&
    number.replace(/[+\s()-]/g, '').length >= 8 &&
    number.replace(/[+\s()-]/g, '').length <= 15;
}

function buildWhatsAppMessage(data) {
  // The form's consent explicitly covers sending these details via WhatsApp.
  // For better privacy, consider removing National ID/passport numbers and
  // sharing them only through a verified, secure channel.
  return [
    'NEW WORKAWAY INTERNATIONAL EMPLOYMENT APPLICATION',
    '',
    `Application reference: ${data.applicationReference}`,
    '',
    'APPLICANT INFORMATION',
    `Full name: ${data.fullName}`,
    `Date of birth: ${data.dateOfBirth}`,
    `Sex: ${data.sex}`,
    `Nationality: ${data.nationality}`,
    `Current country: ${data.country}`,
    `Education level: ${data.education}`,
    `Current occupation: ${data.occupation}`,
    `Job interested in: ${data.jobInterest}`,
    `Availability to start: ${data.availability}`,
    `Criminal record declaration: ${data.criminalRecord}`,
    `Previous U.S. visa: ${data.previousVisa}`,
    `Visa type: ${data.visaType}`,
    '',
    'IDENTIFICATION & CONTACT',
    `National ID number: ${data.nationalIdNumber}`,
    `Passport number: ${data.passportNumber}`,
    `Passport expiry date: ${data.passportExpiry}`,
    `Applicant WhatsApp number: ${data.phone}`,
    `Email: ${data.email || 'Not provided'}`,
    '',
    'Applicant confirmed information accuracy and document readiness.',
    'Consent was checked on the application form.'
  ].join('\n');
}

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (statusBox) statusBox.className = 'status';

    if (!form.reportValidity()) return;

    const recipient = WHATSAPP_RECIPIENT.replace(/[+\s()-]/g, '');
    if (!validRecipient(recipient) || recipient.includes('X')) {
      showStatus('The WhatsApp recipient number has not been configured. Please contact the website administrator.', 'error');
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.fullName = clean(data.fullName);
    data.dateOfBirth = clean(data.dateOfBirth);
    data.sex = clean(data.sex);
    data.nationality = clean(data.nationality);
    data.country = clean(data.country);
    data.education = clean(data.education);
    data.occupation = clean(data.occupation);
    data.jobInterest = clean(data.jobInterest);
    data.availability = clean(data.availability);
    data.criminalRecord = clean(data.criminalRecord);
    data.previousVisa = clean(data.previousVisa);
    data.visaType = clean(data.visaType);
    data.nationalIdNumber = clean(data.nationalIdNumber);
    data.passportNumber = clean(data.passportNumber);
    data.passportExpiry = clean(data.passportExpiry);
    data.phone = clean(data.phone);
    data.email = clean(data.email);
    data.accuracyConfirmed = form.elements.accuracyConfirmed.checked;
    data.documentsReady = form.elements.documentsReady.checked;
    data.consent = form.elements.consent.checked;
    data.applicationReference = makeReference();

    if (clean(data.website)) {
      // Honeypot: do not continue if a bot populated it.
      showStatus('Unable to process this submission.', 'error');
      return;
    }

    if (!data.consent || !data.accuracyConfirmed || !data.documentsReady) {
      showStatus('Please confirm all required declarations and privacy consent.', 'error');
      return;
    }

    if (!validPhone(data.phone)) {
      showStatus('Enter a valid WhatsApp number including country code, for example +254712345678.', 'error');
      return;
    }

    if (data.dateOfBirth && new Date(`${data.dateOfBirth}T00:00:00`) >= new Date()) {
      showStatus('Date of birth must be in the past.', 'error');
      return;
    }

    if (data.passportExpiry && new Date(`${data.passportExpiry}T23:59:59`) <= new Date()) {
      showStatus('Please check the passport expiry date. It must be in the future.', 'error');
      return;
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showStatus('Enter a valid email address or leave it blank.', 'error');
      return;
    }

    if (referenceBox) referenceBox.textContent = data.applicationReference;

    const message = buildWhatsAppMessage(data);
    const whatsappUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;

    showStatus('WhatsApp is opening with your application details. Review the message and press Send in WhatsApp to complete submission. If WhatsApp does not open, check that the recipient number is configured correctly.', 'success');

    // Navigate directly from the user's submit action, which is more reliable
    // for opening the installed WhatsApp app on mobile and WhatsApp Web on desktop.
    window.location.href = whatsappUrl;
  });
}
