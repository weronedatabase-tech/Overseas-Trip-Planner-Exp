async function check() {
  const t0 = Date.now();
  const res = await fetch('http://localhost:3000/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', password: 'ADMIN_PASSWORD', API_URL: 'https://script.google.com/macros/s/AKfycby48gbzI_4V0TEJ0Gra4Qb_J3xywBA6A792d2reGx0QWUx-6QFEKRWBTmr8mGG86osg/exec' })
  });
  const data = await res.text();
  console.log('Time taken:', Date.now() - t0, 'ms');
  console.log('Data:', data);
}
check();
