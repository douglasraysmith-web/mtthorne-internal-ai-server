window.AVA_SERVER_URL = window.AVA_SERVER_URL || 'https://mtthorne-internal-ai-server-production.up.railway.app';
window.askAVA = async function askAVA(message, options = {}) {
  const response = await fetch(`${window.AVA_SERVER_URL}/api/ava/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, provider: options.provider || 'openai' })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || data.blocks?.join(', ') || 'AVA request failed');
  return data;
};
