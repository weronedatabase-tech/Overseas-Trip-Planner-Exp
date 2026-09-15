const API_URL = "https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec";
async function run() {
  const p = [];
  for(let i=0; i<10; i++) {
    p.push(fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getSettings" }),
      redirect: 'follow'
    }).then(res => res.text()));
  }
  const results = await Promise.all(p);
  console.log(results.map(r => r.substring(0, 50)));
}
run();
