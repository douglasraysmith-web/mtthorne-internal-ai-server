import http from 'node:http';
import { CONFIG } from './config.js';
import { health, decide } from './orchestrator.js';
import { listProjectRooms, getProjectRoom, upsertProjectRoom } from './servers/projectRooms.js';
import { listSources, upsertSource } from './servers/sourceManifest.js';
import { listErrors, recordError } from './servers/errorLedger.js';
import { listDecisionHistory } from './servers/decisionHistory.js';
import { checkContamination } from './servers/contamination.js';
import { listJobs, listRecentJobs, listDeadLetterJobs, getJob, enqueueJob, processJob, replayJob } from './servers/queue.js';
import { listTransferRequests, requestTransfer, approveTransfer } from './servers/transfers.js';
import { buildArcheBridgePayload } from './servers/bridge.js';
import { archeConnectorStatus, listBridgeOutbox, getBridgeOutboxItem, createBridgeOutboxItem, markBridgeOutboxImported, pushBridgePayload } from './servers/archeConnector.js';
import { buildContract } from './servers/contracts.js';
import { listTraces, listOpenTraces, getTrace, repairStuckTraces } from './servers/trace.js';
import { memoryStatus, listMemory, addMemory } from './servers/memory.js';
import { releaseCheck } from './servers/releaseGate.js';
import { storageStatus, storageSelfCheck, storageMigrationPlan } from './servers/storage.js';
import { queueAdapterStatus, queueAdapterCheck, queueAdapterMigrationPlan } from './servers/queueAdapter.js';
import { r2StorageStatus, r2StorageCheck, r2StorageMigrationPlan } from './servers/r2Storage.js';
import { deploymentReadinessStatus, deploymentReadinessCheck, deploymentReadinessPlan } from './servers/deploymentReadiness.js';
import { providerStatus, providerCheck, providerEstimate, providerDispatch, providerLog, approvalCheck, costStatus, setCostLimit, setEmergencyStop } from './servers/providerGate.js';
import { existingServicesStatus, railwayEnvPlan, netlifyBridgeContract, stableSidecarCheck } from './servers/existingServices.js';

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { text: raw }; }
}

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function notFound(res) {
  return send(res, 404, { ok: false, error: 'not_found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, health());

    if (req.method === 'POST' && url.pathname === '/contract/validate') return send(res, 200, buildContract(await readBody(req)));

    if (req.method === 'GET' && url.pathname === '/traces') return send(res, 200, { traces: listTraces(url.searchParams.get('limit') || 50) });
    if (req.method === 'GET' && url.pathname === '/traces/open') return send(res, 200, { traces: listOpenTraces(url.searchParams.get('limit') || 50) });
    if (req.method === 'POST' && url.pathname === '/traces/repair') return send(res, 200, repairStuckTraces(await readBody(req)));
    if (req.method === 'GET' && url.pathname.startsWith('/traces/')) return send(res, 200, { trace: getTrace(url.pathname.split('/').pop()) });

    if (req.method === 'GET' && url.pathname === '/memory') return send(res, 200, memoryStatus());
    if (req.method === 'GET' && url.pathname.startsWith('/memory/')) return send(res, 200, { entries: listMemory(url.pathname.split('/').pop(), url.searchParams.get('limit') || 50) });
    if (req.method === 'POST' && url.pathname.startsWith('/memory/')) return send(res, 200, addMemory(url.pathname.split('/').pop(), await readBody(req)));

    if (req.method === 'POST' && url.pathname === '/release/check') return send(res, 200, releaseCheck(await readBody(req)));

    if (req.method === 'GET' && url.pathname === '/storage/status') return send(res, 200, storageStatus());
    if (req.method === 'GET' && url.pathname === '/storage/check') return send(res, 200, storageSelfCheck());
    if (req.method === 'GET' && url.pathname === '/storage/migration-plan') return send(res, 200, storageMigrationPlan());

    if (req.method === 'GET' && url.pathname === '/queue/adapter/status') return send(res, 200, queueAdapterStatus());
    if (req.method === 'GET' && url.pathname === '/queue/adapter/check') return send(res, 200, queueAdapterCheck());
    if (req.method === 'GET' && url.pathname === '/queue/adapter/migration-plan') return send(res, 200, queueAdapterMigrationPlan());

    if (req.method === 'GET' && url.pathname === '/r2/status') return send(res, 200, r2StorageStatus());
    if (req.method === 'GET' && url.pathname === '/r2/check') return send(res, 200, r2StorageCheck());
    if (req.method === 'GET' && url.pathname === '/r2/migration-plan') return send(res, 200, r2StorageMigrationPlan());

    if (req.method === 'GET' && url.pathname === '/deployment/readiness') return send(res, 200, deploymentReadinessStatus());
    if (req.method === 'GET' && url.pathname === '/deployment/check') return send(res, 200, deploymentReadinessCheck());
    if (req.method === 'GET' && url.pathname === '/deployment/plan') return send(res, 200, deploymentReadinessPlan());

    if (req.method === 'GET' && url.pathname === '/providers/status') return send(res, 200, providerStatus());
    if (req.method === 'GET' && url.pathname === '/providers/check') return send(res, 200, providerCheck());
    if (req.method === 'POST' && url.pathname === '/providers/estimate') return send(res, 200, providerEstimate(await readBody(req)));
    if (req.method === 'POST' && url.pathname === '/providers/dispatch') return send(res, 200, providerDispatch(await readBody(req)));
    if (req.method === 'GET' && url.pathname === '/providers/log') return send(res, 200, providerLog({ limit: url.searchParams.get('limit') || 50 }));
    if (req.method === 'POST' && url.pathname === '/providers/approval/check') return send(res, 200, approvalCheck(await readBody(req)));

    if (req.method === 'GET' && url.pathname === '/services/status') return send(res, 200, existingServicesStatus());
    if (req.method === 'GET' && url.pathname === '/deployment/railway-env') return send(res, 200, railwayEnvPlan());
    if (req.method === 'GET' && url.pathname === '/netlify/bridge-contract') return send(res, 200, netlifyBridgeContract());
    if (req.method === 'GET' && url.pathname === '/system/stable-check') return send(res, 200, stableSidecarCheck());

    if (req.method === 'GET' && url.pathname === '/cost/status') return send(res, 200, costStatus());
    if (req.method === 'POST' && url.pathname === '/cost/limit') return send(res, 200, setCostLimit(await readBody(req)));
    if (req.method === 'POST' && url.pathname === '/cost/emergency-stop') return send(res, 200, setEmergencyStop(await readBody(req)));

    if (req.method === 'GET' && url.pathname === '/rooms') return send(res, 200, { rooms: listProjectRooms() });
    if (req.method === 'GET' && url.pathname.startsWith('/rooms/')) return send(res, 200, { room: getProjectRoom(url.pathname.split('/').pop()) });
    if (req.method === 'POST' && url.pathname === '/rooms') return send(res, 200, { room: upsertProjectRoom(await readBody(req)) });

    if (req.method === 'GET' && url.pathname === '/sources') return send(res, 200, { sources: listSources() });
    if (req.method === 'POST' && url.pathname === '/sources') return send(res, 200, { source: upsertSource(await readBody(req)) });

    if (req.method === 'GET' && url.pathname === '/errors') return send(res, 200, { errors: listErrors() });
    if (req.method === 'POST' && url.pathname === '/errors') return send(res, 200, { error: recordError(await readBody(req)) });

    if (req.method === 'POST' && url.pathname === '/decision') return send(res, 200, decide(await readBody(req)));
    if (req.method === 'GET' && url.pathname === '/decision/history') {
      return send(res, 200, { decisions: listDecisionHistory(url.searchParams.get('limit') || 50) });
    }

    if (req.method === 'POST' && url.pathname === '/contamination') return send(res, 200, checkContamination(await readBody(req)));

    if (req.method === 'GET' && url.pathname === '/queue') return send(res, 200, { jobs: listJobs(url.searchParams.get('limit') || 50) });
    if (req.method === 'GET' && url.pathname === '/queue/recent') return send(res, 200, { jobs: listRecentJobs(url.searchParams.get('limit') || 10) });
    if (req.method === 'GET' && url.pathname === '/queue/dead-letter') return send(res, 200, { jobs: listDeadLetterJobs(url.searchParams.get('limit') || 50) });
    if (req.method === 'POST' && url.pathname === '/queue') {
      const body = await readBody(req);
      const job = enqueueJob(body);
      if (body.auto_process === false) return send(res, 200, job);
      const processed = processJob(job.queue_id);
      return send(res, 200, processed.ok ? processed.job : processed.job || processed);
    }
    if (req.method === 'POST' && url.pathname.startsWith('/queue/') && url.pathname.endsWith('/replay')) {
      const queueId = url.pathname.split('/')[2];
      return send(res, 200, replayJob(queueId, await readBody(req)));
    }
    if (req.method === 'POST' && url.pathname.startsWith('/queue/') && url.pathname.endsWith('/process')) {
      const queueId = url.pathname.split('/')[2];
      return send(res, 200, processJob(queueId));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/queue/')) return send(res, 200, { job: getJob(url.pathname.split('/').pop()) });

    if (req.method === 'GET' && url.pathname === '/transfers') return send(res, 200, { transfers: listTransferRequests() });
    if (req.method === 'POST' && url.pathname === '/transfers') return send(res, 200, { transfer: requestTransfer(await readBody(req)) });
    if (req.method === 'POST' && url.pathname === '/transfers/approve') return send(res, 200, approveTransfer(await readBody(req)));

    if (req.method === 'POST' && url.pathname === '/bridge/arche') {
      const body = await readBody(req);
      const result = body.decision_result || decide({ ...body, record_history: body.record_history !== false });
      return send(res, 200, buildArcheBridgePayload(result, body));
    }

    if (req.method === 'GET' && url.pathname === '/bridge/arche/status') {
      return send(res, 200, await archeConnectorStatus({ ping: url.searchParams.get('ping') }));
    }
    if (req.method === 'POST' && url.pathname === '/bridge/arche/export') {
      return send(res, 200, createBridgeOutboxItem(await readBody(req)));
    }
    if (req.method === 'POST' && url.pathname === '/bridge/arche/push') {
      return send(res, 200, await pushBridgePayload(await readBody(req)));
    }
    if (req.method === 'GET' && url.pathname === '/bridge/outbox') {
      return send(res, 200, { items: listBridgeOutbox(url.searchParams.get('limit') || 50) });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/bridge/outbox/')) {
      return send(res, 200, { item: getBridgeOutboxItem(url.pathname.split('/').pop()) });
    }
    if (req.method === 'POST' && url.pathname.startsWith('/bridge/outbox/') && url.pathname.endsWith('/mark-imported')) {
      const bridgeId = url.pathname.split('/')[3];
      return send(res, 200, markBridgeOutboxImported({ ...(await readBody(req)), bridge_id: bridgeId }));
    }

    return notFound(res);
  } catch (error) {
    return send(res, 500, { ok: false, error: String(error?.message || error) });
  }
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`Internal AI Server v1.0.0 listening on http://${CONFIG.host}:${CONFIG.port}`);
});
