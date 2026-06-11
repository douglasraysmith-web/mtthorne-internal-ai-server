import { CONFIG } from '../config.js';

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function extractAnthropicText(data) {
  return (data?.content || []).filter((c) => c?.type === 'text').map((c) => c.text).join('\n').trim();
}

export async function callOpenAI({ request, system, max_output_tokens = 1200, model }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model || CONFIG.openaiModel,
      instructions: system,
      input: request,
      max_output_tokens
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`openai_http_${response.status}:${data?.error?.message || 'request_failed'}`);
  return {
    provider: 'openai',
    model: data?.model || model || CONFIG.openaiModel,
    text: extractOpenAIText(data),
    usage: data?.usage || null,
    request_id: response.headers.get('x-request-id') || data?.id || null
  };
}

export async function callAnthropic({ request, system, max_output_tokens = 1200, model }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || CONFIG.anthropicModel,
      system,
      max_tokens: max_output_tokens,
      messages: [{ role: 'user', content: request }]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`anthropic_http_${response.status}:${data?.error?.message || 'request_failed'}`);
  return {
    provider: 'anthropic',
    model: data?.model || model || CONFIG.anthropicModel,
    text: extractAnthropicText(data),
    usage: data?.usage || null,
    request_id: response.headers.get('request-id') || data?.id || null
  };
}

export async function callProvider(input = {}) {
  const provider = String(input.provider || 'openai').toLowerCase();
  if (provider === 'anthropic') return callAnthropic(input);
  if (provider === 'openai') return callOpenAI(input);
  throw new Error(`unsupported_provider:${provider}`);
}
