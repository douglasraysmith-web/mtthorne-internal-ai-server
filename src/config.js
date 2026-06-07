export const CONFIG = Object.freeze({
  port: Number(process.env.AI_SERVER_PORT || 8787),
  host: process.env.AI_SERVER_HOST || '127.0.0.1',
  publicMode: process.env.AI_PUBLIC_MODE === 'true',
  allowProviderDispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true',
  allowPublicRoomCreation: process.env.AI_ALLOW_PUBLIC_ROOM_CREATION === 'true',
  allowPublicSourceUpload: process.env.AI_ALLOW_PUBLIC_SOURCE_UPLOAD === 'true',
  allowProviderNetwork: process.env.AI_ALLOW_PROVIDER_NETWORK === 'true',
  providerDryRunOnly: process.env.AI_PROVIDER_DRY_RUN_ONLY !== 'false',
  ownerApprovalToken: process.env.AI_OWNER_APPROVAL_TOKEN || ''
});

export const PRIMARY_AIS = Object.freeze(['arche', 'av_ai', 'vlock_ai', 'janitor']);

export const ROUND_TABLE_LANES = Object.freeze([
  'source_lock',
  'builder',
  'verifier',
  'error_ledger',
  'speed_router',
  'quality_judge',
  'security_privacy'
]);

export const ALL_SEATS = Object.freeze([...PRIMARY_AIS, ...ROUND_TABLE_LANES]);
