# Bulten Bilgi Formu

## Çalıştırma

```bash
npm start
```

İlk kurulumda bağımlılığı yükleyin:

```bash
npm install
```

Sonra `http://localhost:3000` adresini açın. QR kodunuzu bu adresi (yayına aldıktan sonra gerçek alan adını) hedefleyecek şekilde oluşturabilirsiniz.

## E-posta ayarı

Gizli bilgileri proje klasöründeki `.env` dosyasına yazabilirsiniz. `.env.example` dosyasını `.env` adıyla kopyalayıp kendi SMTP bilgilerinizi doldurun. Resend API key gerekmez. `.env` dosyası Git’e gönderilmez.

E-postaların gerçekten gönderilmesi için Resend hesabınızdan alınan anahtarı ve doğrulanmış gönderici adresini tanımlayın:

```powershell
$env:RESEND_API_KEY="re_xxx"
$env:MAIL_FROM="Bulten <form@alanadiniz.com>"
npm start
```

Uygulama `https://bulten.onloi.com` adresinde çalışır. Gönderimler `data/submissions.json` dosyasına kaydedilir. Form başarıyla tamamlandıktan 3,5 saniye sonra kullanıcı `https://onloi.com` adresine yönlendirilir.
