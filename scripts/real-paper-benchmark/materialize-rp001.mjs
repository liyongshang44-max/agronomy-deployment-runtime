import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  FileSystemScopedArtifactStore,
  PilotSourceIngestionService
} from '../../packages/source-ingestion/src/index.mjs';
import { PilotRightsEnforcementService } from '../../apps/pilot-api/src/rights/enforcement.mjs';
import { savePilotCheckpoint } from '../../apps/pilot-api/src/persistence/local-checkpoint.mjs';

const PAPER_ID = 'RP001';
const DOI = '10.3390/plants11213007';
const PMCID = 'PMC9656380';
const TITLE = 'Seedling-Stage Deficit Irrigation with Nitrogen Application in Three-Year Field Study Provides Guidance for Improving Maize Yield, Water and Nitrogen Use Efficiencies';
const AUTHORS = [
  'Yuxi Li',
  'Jian Chen',
  'Longbing Tian',
  'Zhaoyin Shen',
  'Daniel Buchvaldt Amby',
  'Fulai Liu',
  'Qiang Gao',
  'Yin Wang'
];
const CODE_HEAD = process.env.ADR_CODE_HEAD_SHA ?? process.env.GITHUB_SHA ?? '';
const PDF_INPUT = process.env.ADR_RP001_PDF_PATH ?? process.argv[2] ?? '';
const OUTPUT_DIR = resolve(process.env.ADR_RP001_OUTPUT_DIR ?? '.adr-benchmark/rp001');
const ACQUISITION_LOCATOR = process.env.ADR_RP001_ACQUISITION_LOCATOR ?? '';
const OPERATOR_ID = process.env.ADR_RP001_OPERATOR_ID ?? 'rp001-benchmark-materializer';
const JURISDICTION = process.env.ADR_RIGHTS_JURISDICTION ?? 'UNSPECIFIED';
const NOW = new Date();
const VALID_UNTIL = new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000);

function required(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} is required`);
  return value.trim();
}

function exactCodeHead(value) {
  const head = required(value, 'ADR_CODE_HEAD_SHA');
  if (!/^[0-9a-f]{40}$/i.test(head)) throw new Error('ADR_CODE_HEAD_SHA must be an exact 40-character git SHA');
  return head.toLowerCase();
}

function exactPdfPath(value) {
  const path = resolve(required(value, 'ADR_RP001_PDF_PATH'));
  if (!existsSync(path)) throw new Error('ADR_RP001_PDF_PATH does not exist');
  const stat = statSync(path);
  if (!stat.isFile() || stat.size <= 0) throw new Error('ADR_RP001_PDF_PATH must be a non-empty regular file');
  return path;
}

const codeHeadSha = exactCodeHead(CODE_HEAD);
const pdfPath = exactPdfPath(PDF_INPUT);
const acquisitionLocator = required(ACQUISITION_LOCATOR, 'ADR_RP001_ACQUISITION_LOCATOR');

function audit(eventId, { actorType = 'SERVICE_ACCOUNT', inputRefs = [], details = {} } = {}) {
  return {
    eventId,
    occurredAt: new Date().toISOString(),
    actor: { type: actorType, id: OPERATOR_ID },
    inputRefs,
    details: {
      channel: 'real-paper-benchmark-rp001-materialization',
      paperId: PAPER_ID,
      codeHeadSha,
      ...details
    }
  };
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const artifactDir = join(OUTPUT_DIR, 'artifacts');
const checkpointPath = join(OUTPUT_DIR, 'runtime-checkpoint.json');
const evidencePath = join(OUTPUT_DIR, 'rp001-materialization-evidence.json');

const ledger = new AuthorityLedger();
const artifactStore = new FileSystemScopedArtifactStore({ rootDir: artifactDir });
const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
const ingestion = new PilotSourceIngestionService({ sourceRegistry, artifactStore });
const rights = new PilotRightsEnforcementService({
  ledger,
  operatorId: OPERATOR_ID,
  evaluatorId: 'rp001-benchmark-rights-engine'
});

const scope = {
  organizationId: 'adr-benchmark',
  tenantId: 'real-paper-v1'
};

const created = ingestion.createUpload({
  scope,
  filename: 'rp001.pdf',
  declaredMediaType: 'application/pdf',
  source: {
    logicalId: 'source.paper.doi-10.3390-plants11213007',
    version: 'publisher-version-2022-11-07',
    sourceType: 'PUBLICATION',
    title: TITLE,
    bibliographic: {
      doi: DOI,
      journal: 'Plants',
      year: 2022,
      volume: '11',
      issue: '21',
      article: '3007',
      authors: AUTHORS
    },
    sourceVersionLabel: 'PUBLISHED_VERSION',
    originLocator: 'https://www.mdpi.com/2223-7747/11/21/3007',
    rights: {
      license: 'CC_BY_4_0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      automaticAuthorizationFromLicense: false,
      authorityClaim: 'RECORDED_SOURCE_METADATA_NOT_EXECUTABLE_RIGHTS'
    },
    metadata: {
      benchmarkId: 'ADR_REAL_PAPER_BENCHMARK_V1',
      paperId: PAPER_ID,
      pmcid: PMCID,
      selectionRole: 'FIRST_REAL_PAPER_BASELINE'
    }
  },
  artifact: {
    logicalId: 'source.paper.doi-10.3390-plants11213007.artifact.pdf',
    version: '1',
    mediaType: 'application/pdf',
    materializationIdentity: 'RP001_EXACT_PUBLISHER_PDF_BYTES_V1',
    acquisition: {
      method: 'PUBLIC_OPEN_ACCESS_DOWNLOAD',
      acquiredAt: NOW.toISOString(),
      locator: acquisitionLocator
    },
    rightsSnapshot: {
      license: 'CC_BY_4_0',
      automaticAuthorizationFromLicense: false,
      benchmarkRetentionProvisionedSeparately: true
    },
    metadata: {
      benchmarkId: 'ADR_REAL_PAPER_BENCHMARK_V1',
      paperId: PAPER_ID,
      codeHeadSha
    }
  }
});

const registered = ingestion.preRegisterSource({
  uploadId: created.uploadId,
  sourceAudit: audit(`evt-rp001-source-preregister:${created.uploadId}`, {
    actorType: 'USER',
    details: { authorityBoundary: 'SOURCE_METADATA_ONLY_NO_FULLTEXT_RETAINED' }
  })
});

const provisioned = rights.provision({
  subjectRef: registered.source.ref,
  basisClass: 'LICENSE',
  evidenceRefs: [],
  rules: [{
    operation: 'RETAIN_FULLTEXT',
    purposes: ['SCIENTIFIC_KNOWLEDGE_INGESTION'],
    jurisdictions: [JURISDICTION],
    obligations: []
  }],
  validFrom: NOW.toISOString(),
  validUntil: VALID_UNTIL.toISOString(),
  version: `rp001-retention-${codeHeadSha.slice(0, 12)}`
});

const retained = await rights.execute({
  subjectRef: registered.source.ref,
  actorId: OPERATOR_ID,
  actorType: 'USER',
  operation: 'RETAIN_FULLTEXT',
  purpose: 'SCIENTIFIC_KNOWLEDGE_INGESTION',
  jurisdiction: JURISDICTION,
  enforceableObligations: [],
  effectKey: `source-retention:${created.uploadId}`,
  sideEffect: async () => ingestion.uploadPdf({
    uploadId: created.uploadId,
    readable: createReadStream(pdfPath)
  })
});

const retentionReceipt = rights.sideEffectReceiptFor({
  effectKey: `source-retention:${created.uploadId}`,
  subjectRef: registered.source.ref,
  operation: 'RETAIN_FULLTEXT'
});

if (retentionReceipt.ref.semanticHash !== retained.sideEffectReceiptRef.semanticHash) {
  throw new Error('retention side-effect receipt identity drift');
}

const finalized = ingestion.finalizeUpload({
  uploadId: created.uploadId,
  sourceAudit: audit(`evt-rp001-source-finalize-unused:${created.uploadId}`),
  artifactAudit: audit(`evt-rp001-artifact:${created.uploadId}`, {
    inputRefs: [retentionReceipt.semanticPayload.rightsDecisionRef, retentionReceipt.ref],
    details: { authorityBoundary: 'EXACT_RETAINED_PDF_BYTES' }
  })
});

const checkpointHash = savePilotCheckpoint({
  path: checkpointPath,
  ledger,
  ingestion
});

const evidence = {
  schemaVersion: 'adr.real-paper-materialization-evidence.v1',
  benchmarkId: 'ADR_REAL_PAPER_BENCHMARK_V1',
  paperId: PAPER_ID,
  codeHeadSha,
  executionBaseline: 'RA02_RIGHTS_ENFORCED_PILOT_PATH',
  source: {
    doi: DOI,
    pmcid: PMCID,
    sourceRef: finalized.source.ref,
    sourceArtifactRef: finalized.sourceArtifact.ref,
    contentHash: finalized.sourceArtifact.semanticPayload.contentHash,
    byteLength: finalized.sourceArtifact.semanticPayload.byteLength,
    retentionReceipt: finalized.upload.retentionReceipt,
    acquisitionLocator
  },
  rights: {
    rightsPolicyRef: provisioned.rightsPolicyRef,
    rightsGrantRef: provisioned.rightsGrantRef,
    retentionRightsDecisionRef: retentionReceipt.semanticPayload.rightsDecisionRef,
    retentionRightsSideEffectReceiptRef: retentionReceipt.ref,
    jurisdiction: JURISDICTION,
    purpose: 'SCIENTIFIC_KNOWLEDGE_INGESTION'
  },
  checkpoint: {
    format: 'ADR_PILOT_LOCAL_CHECKPOINT_V1',
    checkpointHash,
    relativePath: 'runtime-checkpoint.json'
  },
  modelExecution: {
    llmInvoked: false,
    externalModelEgress: false,
    extractionPerformed: false,
    automatedReviewPerformed: false
  },
  authorityClaim: 'MATERIALIZATION_EVIDENCE_ONLY_NOT_SCIENTIFIC_OR_BENCHMARK_REFERENCE_AUTHORITY',
  materializedAt: new Date().toISOString()
};

writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(evidence, null, 2));
