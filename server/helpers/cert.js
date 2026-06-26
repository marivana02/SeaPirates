const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

async function ensureCert(certDir) {
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) return true;

  console.log('Self-signed sertifika oluşturuluyor...');
  try {
    const attrs = [{ name: 'commonName', value: 'SeaPirates' }];
    const pems = await selfsigned.generate(attrs, { days: 365, keySize: 2048 });
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    console.log('Sertifika oluşturuldu');
    return true;
  } catch (e) {
    console.log('Sertifika oluşturulamadı:', e.message);
    return false;
  }
}

module.exports = { ensureCert };