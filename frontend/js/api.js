/**
 * API Caller Wrapper
 * Uses API_URL globally defined in backend/config.js
 */
async function apiCall(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: action, ...payload }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    });
    
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data.status === 'error') throw new Error(data.message);
      return data;
    } catch (e) {
      console.error("API Parse Error:", text);
      throw new Error("Server Error: Invalid Response.");
    }
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      showToast("Auth required.", true);
      setTimeout(() => window.open(API_URL, '_blank'), 2000);
    }
    throw err;
  }
}