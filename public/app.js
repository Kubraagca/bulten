const form = document.querySelector('#registrationForm');
const button = document.querySelector('#submitButton');
const error = document.querySelector('#error');
const success = document.querySelector('#success');
const duplicate = document.querySelector('#duplicate');
const panelTop = document.querySelector('.panel-top');

function showDuplicate(record) {
  document.querySelector('#duplicateReference').textContent = record.reference;
  document.querySelector('#duplicateName').textContent = `${record.firstName} ${record.lastName}`;
  document.querySelector('#duplicateCompany').textContent = record.company || '-';
  document.querySelector('#duplicateContact').textContent = `${record.email} / ${record.phone}`;
  form.hidden = true;
  panelTop.hidden = true;
  duplicate.hidden = false;
}

async function checkDuplicate() {
  const email = form.email.value.trim();
  const phone = form.phone.value.trim();
  if (!email && !phone) return;
  const query = new URLSearchParams({ email, phone });
  try {
    const response = await fetch(`/api/check-duplicate?${query}`);
    const result = await response.json();
    if (result.duplicate) showDuplicate(result.record);
  } catch { /* Gönderim sırasında tekrar kontrol edilir. */ }
}

form.email.addEventListener('blur', checkDuplicate);
form.phone.addEventListener('blur', checkDuplicate);
document.querySelector('#backToForm').addEventListener('click', () => {
  duplicate.hidden = true;
  form.hidden = false;
  panelTop.hidden = false;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  if (!form.checkValidity()) {
    error.textContent = 'Lütfen tüm zorunlu alanları doldurun ve onay kutularını işaretleyin.';
    form.reportValidity();
    return;
  }
  button.disabled = true;
  button.textContent = 'Gönderiliyor…';
  const data = Object.fromEntries(new FormData(form));
  data.kvkk = form.kvkk.checked;
  data.verification = form.verification.checked;
  try {
    const response = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (response.status === 409 && result.duplicate) {
      showDuplicate(result.duplicate);
      button.disabled = false;
      button.innerHTML = 'Formu gönder <span>↗</span>';
      return;
    }
    if (!response.ok) throw new Error(result.message || 'Form gönderilemedi.');
    document.querySelector('#reference').textContent = result.reference;
    if (!result.emailSent) document.querySelector('#emailNote').textContent = 'Başvuru numaranızı lütfen not alın.';
    form.hidden = true;
    document.querySelector('.panel-top').hidden = true;
    success.hidden = false;
    setTimeout(() => { window.location.href = result.redirectUrl || 'https://onloi.com'; }, 3500);
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.innerHTML = 'Formu gönder <span>↗</span>';
  }
});
