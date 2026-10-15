const form = document.querySelector('#application-form');
const statusBox = document.querySelector('#form-status');
const submitButton = form.querySelector('button[type="submit"]');
const referenceBox = document.querySelector('#application-reference');

function showStatus(message, kind) {
  statusBox.textContent = message;
  statusBox.className = `status visible ${kind}`;
  statusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function makeReference() {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WAI-${ymd}-${suffix}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusBox.className = 'status';
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form).entries());
  data.consent = form.elements.consent.checked;
  data.accuracyConfirmed = form.elements.accuracyConfirmed.checked;
  data.documentsReady = form.elements.documentsReady.checked;
  data.applicationReference = makeReference();
  if (!data.consent || !data.accuracyConfirmed || !data.documentsReady) {
    showStatus('Please confirm all required declarations and consent before submitting.', 'error');
    return;
  }
  if (data.passportExpiry && new Date(`${data.passportExpiry}T23:59:59`) <= new Date()) {
    showStatus('Please check the passport expiry date. It must be in the future.', 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector('span:first-child').textContent = 'Submitting…';
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'same-origin'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Submission failed. Please try again.');
    referenceBox.textContent = result.reference || data.applicationReference;
    form.reset();
    showStatus(`Thank you. Your application was submitted. Reference: ${result.reference || data.applicationReference}`, 'success');
  } catch (error) {
    showStatus(error.message || 'We could not submit your application. Please try again later.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span:first-child').textContent = 'Click Here to Submit';
  }
});
