const form = document.querySelector('#application-form');
const statusBox = document.querySelector('#form-status');
const submitButton = form.querySelector('button[type="submit"]');

function showStatus(message, kind) {
  statusBox.textContent = message;
  statusBox.className = `status visible ${kind}`;
  statusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusBox.className = 'status';
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  data.consent = form.elements.consent.checked;
  if (!data.consent) {
    showStatus('Please read the privacy notice and confirm consent before submitting.', 'error');
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
    form.reset();
    showStatus('Thank you. Your application was submitted successfully.', 'success');
  } catch (error) {
    showStatus(error.message || 'We could not submit your application. Please try again later.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span:first-child').textContent = 'Submit application';
  }
});
