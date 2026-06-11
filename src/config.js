function parsePort(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const text = String(value).trim();
    if (!text || text === '${PORT}' || text === '$PORT') continue;
    const port = Number(text);
    if (Number.isInteger(port) && port >= 0 && port < 65536) return port;
  }
  return 8787;
}

function csv(value, fallback = []) {
  const raw = value === undefined || value === null || value === '' ? fallback.join(',') : String(value);
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

export const CONFIG = Object.freeze({
  port: parsePort(process.env.AI_SERVER_PORT, process.env.PORT, 8787),
  host: process.env.AI_SERVER_HOST || '127.0.0.1',
  publicMode: process.env.AI_PUBLIC_MODE === 'true',
  allowedOrigins: csv(process.env.AI_ALLOWED_ORIGINS, [
    'https://mtthorne.com',
    'https://www.mtthorne.com',
    'http://localhost:8888',
    'http://127.0.0.1:8888'
  ]),
  allowProviderDispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true',
  allowPublicRoomCreation: process.env.AI_ALLOW_PUBLIC_ROOM_CREATION === 'true',
  allowPublicSourceUpload: process.env.AI_ALLOW_PUBLIC_SOURCE_UPLOAD === 'true',
  allowProviderNetwork: process.env.AI_ALLOW_PROVIDER_NETWORK === 'true',
  providerDryRunOnly: process.env.AI_PROVIDER_DRY_RUN_ONLY !== 'false',
  ownerApprovalToken: process.env.AI_OWNER_APPROVAL_TOKEN || '',
  archeBackendUrl: process.env.ARCHE_BACKEND_URL || 'https://arche-backend-production.up.railway.app',
  archeFastChatPath: process.env.ARCHE_FAST_CHAT_PATH || '/api/arche-fast-chat',
  archeChatPath: process.env.ARCHE_CHAT_PATH || '/api/arche-chat',
  allowArchePush: process.env.AI_ALLOW_ARCHE_PUSH === 'true',
  archeBridgeToken: process.env.ARCHE_BRIDGE_TOKEN || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
  objectStorageDriver: process.env.AI_OBJECT_STORAGE_DRIVER || 'local_manifest',
  allowR2Writes: process.env.AI_ALLOW_R2_WRITES === 'true',
  avaRateLimitPerMinute: Number(process.env.AVA_RATE_LIMIT_PER_MINUTE || 20),
  avaMaxMessageChars: Number(process.env.AVA_MAX_MESSAGE_CHARS || 6000)
});

export const PRIMARY_AIS = Object.freeze(['arche', 'av_ai', 'vlock_ai', 'janitor']);
export const ROUND_TABLE_LANES = Object.freeze(['source_lock','builder','verifier','error_ledger','speed_router','quality_judge','security_privacy']);
export const ALL_SEATS = Object.freeze([...PRIMARY_AIS, ...ROUND_TABLE_LANES]);
