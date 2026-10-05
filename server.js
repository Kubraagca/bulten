const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Yerel gizli ayarları .env dosyasından oku.
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || match[1].startsWith('#')) return;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[match[1]]) process.env[match[1]] = value;
  });
}

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');
const ONLOI_URL = 'https://onloi.com';
const ONLOI_QR_HEADERS = {
  'X-Onloi-QR': 'true',
  'X-Onloi-Category': 'bilgi-formu',
  'X-Onloi-Version': '1'
};

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function readSubmissions() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function clean(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0090')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('90')) digits = `0${digits.slice(2)}`;
  else if (digits.length === 10 && digits.startsWith('5')) digits = `0${digits}`;
  return digits;
}

function validPhone(phone) {
  return /^05\d{9}$/.test(normalizePhone(phone));
}

function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${(name || '').slice(0, 2)}***@${domain || ''}`;
}

function maskPhone(phone) {
  const digits = normalizePhone(phone);
  return digits.length > 4 ? `${digits.slice(0, 3)} *** ** ${digits.slice(-2)}` : '***';
}

function duplicateView(record) {
  return {
    reference: record.reference,
    firstName: record.firstName,
    lastName: record.lastName,
    email: maskEmail(record.email),
    phone: maskPhone(record.phone),
    company: record.company,
    sector: record.sector,
    city: record.city,
    createdAt: record.createdAt
  };
}

function findDuplicate(email, phone) {
  const normalizedEmail = String(email || '').toLowerCase();
  const normalizedPhone = normalizePhone(phone);
  return readSubmissions().find((record) =>
    record.email === normalizedEmail || (normalizedPhone && normalizePhone(record.phone) === normalizedPhone)
  );
}

async function sendEmail({ email, name, reference }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return { sent: false, reason: 'SMTP ayarları eksik' };

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true' || port === 465,
    auth: { user, pass: password }
  });
  const safeName = escapeHtml(name);
  const safeReference = escapeHtml(reference);
  await transporter.sendMail({
    from: process.env.MAIL_FROM || user,
    to: email,
    subject: `Bilgi formunuz alındı — ${reference}`,
    text: `Merhaba ${name}, bilgi formunuz başarıyla gönderildi. Kayıt numaranız: ${reference}. Bu numarayı lütfen saklayın.`,
    html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif;color:#263b86">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e2e7ec;border-radius:10px;overflow:hidden">
        <tr><td style="padding:20px 28px;border-bottom:3px solid #72b52b"><img src="cid:onloi-logo@onloi" alt="Onloi" width="112" style="display:block"></td></tr>
        <tr><td style="padding:30px 28px 26px"><div style="color:#72b52b;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px">Bilgi formu</div>
          <h1 style="font-size:25px;line-height:1.2;margin:0 0 12px;color:#263b86">Bilgileriniz başarıyla alındı.</h1>
          <p style="font-size:15px;line-height:1.6;color:#59677c;margin:0 0 22px">Merhaba ${safeName}, formunuzu aldık. İlginiz için teşekkür ederiz.</p>
          <div style="background:#f7faf4;border:1px solid #dce4d5;border-radius:8px;padding:16px 18px;margin-bottom:22px"><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#718096;margin-bottom:6px">Kayıt numaranız</div><div style="font-size:23px;letter-spacing:2px;font-weight:bold;color:#263b86">${safeReference}</div></div>
          <p style="font-size:14px;line-height:1.7;color:#59677c;margin:0">Bu numarayı lütfen saklayın. Bilgi kaydınızla ilgili iletişimlerde bu numarayı kullanabilirsiniz.</p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafbfc;color:#8792a1;font-size:11px;line-height:1.5">Bu e-posta Bulten bilgi formu gönderiminiz üzerine otomatik olarak oluşturulmuştur. <span style="color:#72b52b;font-weight:bold">bulten.onloi.com</span></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    attachments: [{ filename: 'onloi-logo.png', path: path.join(PUBLIC_DIR, 'onloi-logo.png'), cid: 'onloi-logo@onloi' }]
  });
  return { sent: true };
}

async function handleSubmit(req, res) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10000) return sendJson(res, 413, { message: 'Gönderi çok büyük.' });
  }
  let body;
  try { body = JSON.parse(raw); } catch { return sendJson(res, 400, { message: 'Geçersiz form verisi.' }); }

  const submission = {
    firstName: clean(body.firstName, 80), lastName: clean(body.lastName, 80),
    email: clean(body.email, 160).toLowerCase(), phone: clean(body.phone, 40),
    company: clean(body.company, 120), sector: clean(body.sector, 100), city: clean(body.city, 80)
  };
  if (!submission.firstName || !submission.lastName || !validEmail(submission.email) || !validPhone(submission.phone) || !submission.company || body.kvkk !== true || body.verification !== true) {
    return sendJson(res, 422, { message: 'Lütfen zorunlu alanları ve onayları kontrol edin.' });
  }

  const existing = findDuplicate(submission.email, submission.phone);
  if (existing) return sendJson(res, 409, { message: 'Bu e-posta veya telefon numarasıyla daha önce bilgi kaydı oluşturulmuş.', duplicate: duplicateView(existing) });

  const reference = `BUL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const record = { ...submission, reference, createdAt: new Date().toISOString() };
  const all = readSubmissions();
  all.push(record);
  fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf8');

  let emailSent = false;
  try { emailSent = (await sendEmail({ email: submission.email, name: submission.firstName, reference })).sent; }
  catch (error) { console.error('E-posta gönderilemedi:', error.message); }
  sendJson(res, 201, { reference, emailSent, redirectUrl: ONLOI_URL });
}

function serveStatic(req, res) {
  const requestedPath = req.url.split('?')[0];
  const isOnloiQrEntry = requestedPath === '/';
  const requested = isOnloiQrEntry ? '/index.html' : requestedPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { message: 'Yasak.' });
  fs.readFile(filePath, (error, content) => {
    if (error) return sendJson(res, 404, { message: 'Sayfa bulunamadı.' });
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    res.writeHead(200, {
      'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      ...(isOnloiQrEntry ? ONLOI_QR_HEADERS : {})
    });
    if (req.method === 'HEAD') return res.end();
    res.end(content);
  });
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/submit') return handleSubmit(req, res);
  if (req.method === 'GET' && req.url.startsWith('/api/check-duplicate')) {
    const query = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
    const existing = findDuplicate(query.get('email'), query.get('phone'));
    return sendJson(res, 200, existing ? { duplicate: true, record: duplicateView(existing) } : { duplicate: false });
  }
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  sendJson(res, 405, { message: 'Method desteklenmiyor.' });
}).listen(PORT, () => console.log(`Form hazır: http://localhost:${PORT}`));
