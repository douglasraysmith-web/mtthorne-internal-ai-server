export function runJanitor(input, context) {
  return {
    ai: 'janitor',
    name: 'The Janitor',
    summary: 'Client-reply route prepared. Triage, boundary protection, support classification, and professional response handling are active.',
    action: 'handle_support_or_client_reply_work',
    context
  };
}
