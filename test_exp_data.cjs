async function check() {
  const res = await fetch('http://localhost:3000/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'fetchAdminRoster', API_URL: 'https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec' })
  });
  const data = await res.json();
  console.log('Roster length:', data.roster ? data.roster.length : 'no roster');
}
check();
