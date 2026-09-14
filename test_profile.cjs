fetch('https://ais-dev-bjrvbm7m6dits5kzgocrgi-320707644557.europe-west2.run.app/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'getProfile',
        payload: { nric: 'S4052341D' }, // let's try an NRIC?
        API_URL: 'https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec'
    })
}).then(r => r.json()).then(data => console.log(data));
