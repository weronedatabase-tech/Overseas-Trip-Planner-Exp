/*** API Caller Wrapper
* Uses API_URL globally defined in backend/config.js
*/
async function apiCall(action, data = {}, maxRetries = 2) {
    let delay = 1500;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: action, data: data }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                redirect: 'follow'
            });
            
            const text = await response.text();
            try {
                const parsed = JSON.parse(text);
                return parsed;
            } catch (e) {
                if (attempt < maxRetries) {
                    console.warn(`API Response is not JSON (Attempt ${attempt + 1}). Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 1.5; // Exponential backoff
                    continue;
                }
                console.error("API Response is not JSON:", text);
                return { success: false, message: "Server Error: Invalid Response. Contact Support." };
            }
        } catch (error) {
            if (attempt < maxRetries) {
                console.warn(`API Error (Attempt ${attempt + 1}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 1.5;
                continue;
            }
            console.error("API Error:", error);
            return { success: false, message: "Connection Error. Please check internet." };
        }
    }
}
