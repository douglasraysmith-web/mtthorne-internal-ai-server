# AVA page connection
1. Include `ava-client.js` in the AVA page bundle or copy its `askAVA` function.
2. Call `await askAVA(userMessage)` and render `result.message`.
3. Keep all provider and R2 keys in Railway variables, never in Netlify/frontend code.
4. Activate only after `/api/ava/status` reports the intended flags.
