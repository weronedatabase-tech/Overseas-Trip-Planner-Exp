/**
 * API Caller Wrapper
 * Uses API_URL globally defined in backend/config.js
 */
async function apiCall(action, payload = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: action, ...payload }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow'
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.warn(`API Parse Error on attempt ${i + 1}:`, text);
        throw new Error("SERVER_PARSE_ERROR");
      }
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }
      return data;
      
    } catch (err) {
      // If it's a known backend application error, do not retry
      if (err.message && err.message !== "SERVER_PARSE_ERROR" && !err.message.includes("fetch") && !err.message.includes("Network")) {
        throw err;
      }
      
      console.warn(`API attempt ${i + 1} failed:`, err.message);
      if (i === retries) {
        if (err.message === "SERVER_PARSE_ERROR") throw new Error("Server Error: Invalid Response from Google. Please try again.");
        throw err;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, i)));
    }
  }
}
