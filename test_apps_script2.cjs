async function check() {
  const t0 = Date.now();
  const res = await fetch('https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'fetchAdminRoster' })
  });
  const data = await res.text();
  console.log('Time:', Date.now() - t0, 'ms');
  console.log('Status:', res.status);
  console.log('Data length:', data.length);
}
check();
