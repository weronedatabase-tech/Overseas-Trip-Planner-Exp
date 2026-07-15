/**
* API Caller Wrapper
* Uses API_URL globally defined in backend/config.js
*/
async function apiCall(action, data = {}) {
   try {
       const response = await fetch(API_URL, {
           method: 'POST',
           body: JSON.stringify({ action: action, data: data }),
           headers: { 'Content-Type': 'text/plain;charset=utf-8' },
           redirect: 'follow'
       });
       
       const text = await response.text();
       try {
           return JSON.parse(text);
       } catch (e) {
           console.error("API Response is not JSON:", text);
           return { success: false, message: "Server Error: Invalid Response. Contact Support." };
       }
   } catch (error) {
       console.error("API Error:", error);
       return { success: false, message: "Connection Error. Please check internet." };
   }
}