async function check() {
  const res = await fetch('https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'login', password: 'bad' })
  });
  const data = await res.text();
  console.log('Status:', res.status);
  console.log('Data:', data.slice(0, 200));
}
check();
