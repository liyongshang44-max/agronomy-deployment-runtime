import { semanticHash } from '../../../../packages/canonicalization/src/index.mjs';
import { AuthorityLedger } from '../../../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../../../packages/source-registry/src/index.mjs';
import {
  ScientificCompiler,
  ScientificCompilerError,
  createDeterministicCompilerDefinition
} from '../../../../packages/scientific-compiler/src/index.mjs';

export const MANUAL_EXTERNAL_IMPORT_PROVIDER = 'MANUAL_EXTERNAL_PROPOSAL_IMPORT';
export const MANUAL_EXTERNAL_IMPORT_SCHEMA_VERSION = 'adr-manual-external-proposal-import-v1';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ScientificCompilerError('INVALID_MANUAL_IMPORT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function safeLabel(value, fallback) {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;
  return value.trim().slice(0, 120);
}

function safeLogicalToken(value) {
  return requiredText(value, 'logical token')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'external';
}

function duplicateKeys(claims) {
  const counts = new Map();
  for (const claim of claims) {
    const key = typeof claim?.key === 'string' ? claim.key.trim() : '';
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function invalidSummary(index, claim, error) {
  return {
    index,
    key: typeof claim?.key === 'string' ? claim.key : null,
    claimType: typeof claim?.claimType === 'string' ? claim.claimType : null,
    assertion: typeof claim?.assertion === 'string' ? claim.assertion : null,
    error: {
      code: error instanceof ScientificCompilerError ? error.code : 'INVALID_CLAIM_PROPOSAL',
      message: error instanceof Error ? error.message : 'candidate failed compiler preflight'
    }
  };
}

function makeDefinition({ ledger, providerLabel, modelLabel, audit }) {
  const identity = {
    providerLabel,
    modelLabel,
    modelIdentityAuthority: 'OPERATOR_DECLARED_NOT_VERIFIED',
    transport: 'USER_COPY_PASTE',
    schemaVersion: MANUAL_EXTERNAL_IMPORT_SCHEMA_VERSION
  };
  const digest = semanticHash('ManualExternalProposalCompilerDefinition', identity).replace(/^sha256:/, '').slice(0, 16);
  return createDeterministicCompilerDefinition({
    ledger,
    logicalId: `compiler.manual-external-proposal.${safeLogicalToken(providerLabel)}`,
    version: `v1-${digest}`,
    compilerId: 'manual-external-proposal-import',
    implementationVersion: 'pilot-v1',
    extractionContractVersion: MANUAL_EXTERNAL_IMPORT_SCHEMA_VERSION,
    locatorContractVersion: 'adr-source-locator-v1',
    configuration: {
      ...identity,
      outputAuthority: 'CANDIDATE_ONLY'
    },
    audit
  });
}

function dryRunClaim({ ledger, artifactStore, sourceArtifactRef, claim, providerLabel, modelLabel, index, audit }) {
  const clonedLedger = AuthorityLedger.fromSnapshot(ledger.exportSnapshot());
  const clonedRegistry = new SourceRegistry({ ledger: clonedLedger, artifactStore });
  const clonedCompiler = new ScientificCompiler({ ledger: clonedLedger, sourceRegistry: clonedRegistry });
  const definition = makeDefinition({
    ledger: clonedLedger,
    providerLabel,
    modelLabel,
    audit: {
      ...audit,
      eventId: `${audit.eventId}:preflight-definition:${index}`
    }
  });
  clonedCompiler.materializeCompilationProposal({
    compilationLogicalId: `preflight.manual-import.${index}`,
    version: '1',
    sourceArtifactRef,
    compilerDefinitionRef: definition.ref,
    proposal: { claims: [claim], runMetadata: { preflightOnly: true } },
    audit: {
      ...audit,
      eventId: `${audit.eventId}:preflight:${index}`
    }
  });
}

export class ManualExternalProposalImportService {
  #ledger;
  #sourceRegistry;
  #artifactStore;
  #compiler;

  constructor({ ledger, sourceRegistry, artifactStore }) {
    if (!ledger || typeof ledger.exportSnapshot !== 'function' || typeof ledger.publish !== 'function') {
      throw new ScientificCompilerError('INVALID_LEDGER', 'manual importer requires shared AuthorityLedger');
    }
    if (!sourceRegistry || typeof sourceRegistry.resolveArtifact !== 'function') {
      throw new ScientificCompilerError('INVALID_SOURCE_REGISTRY', 'manual importer requires SourceRegistry');
    }
    if (!artifactStore) throw new ScientificCompilerError('INVALID_ARTIFACT_STORE', 'manual importer requires artifact store');
    this.#ledger = ledger;
    this.#sourceRegistry = sourceRegistry;
    this.#artifactStore = artifactStore;
    this.#compiler = new ScientificCompiler({ ledger, sourceRegistry });
  }

  import({
    sourceArtifactRef,
    proposal,
    providerLabel = 'EXTERNAL_WEB',
    modelLabel = 'UNKNOWN_MODEL',
    compilationLogicalId,
    version,
    audit
  }) {
    this.#sourceRegistry.resolveArtifact(sourceArtifactRef);
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal) || !Array.isArray(proposal.claims)) {
      throw new ScientificCompilerError('INVALID_COMPILATION_PROPOSAL', 'manual external proposal must contain claims[]');
    }
    const provider = safeLabel(providerLabel, 'EXTERNAL_WEB');
    const model = safeLabel(modelLabel, 'UNKNOWN_MODEL');
    const duplicates = duplicateKeys(proposal.claims);
    const reviewable = [];
    const invalid = [];

    proposal.claims.forEach((claim, index) => {
      const key = typeof claim?.key === 'string' ? claim.key.trim() : '';
      if (key && duplicates.has(key)) {
        invalid.push(invalidSummary(index, claim, new ScientificCompilerError('DUPLICATE_CLAIM_KEY', `duplicate claim key ${key}`)));
        return;
      }
      try {
        dryRunClaim({
          ledger: this.#ledger,
          artifactStore: this.#artifactStore,
          sourceArtifactRef,
          claim,
          providerLabel: provider,
          modelLabel: model,
          index,
          audit
        });
        reviewable.push({ index, claim });
      } catch (error) {
        invalid.push(invalidSummary(index, claim, error));
      }
    });

    const payloadHash = semanticHash('ManualExternalProposalImportPayload', proposal);
    const preflight = {
      total: proposal.claims.length,
      reviewable: reviewable.length,
      invalid: invalid.length,
      invalidCandidates: invalid,
      importPayloadHash: payloadHash
    };

    if (reviewable.length === 0) {
      return {
        preflight,
        materialized: false,
        compilation: null,
        candidates: []
      };
    }

    const definition = makeDefinition({
      ledger: this.#ledger,
      providerLabel: provider,
      modelLabel: model,
      audit: {
        ...audit,
        eventId: `${audit.eventId}:definition`
      }
    });
    const compiled = this.#compiler.materializeCompilationProposal({
      compilationLogicalId: requiredText(compilationLogicalId, 'compilationLogicalId'),
      version: requiredText(version, 'version'),
      sourceArtifactRef,
      compilerDefinitionRef: definition.ref,
      proposal: {
        claims: reviewable.map(({ claim }) => claim),
        runMetadata: {
          provider: MANUAL_EXTERNAL_IMPORT_PROVIDER,
          providerLabel: provider,
          modelLabel: model,
          modelIdentityAuthority: 'OPERATOR_DECLARED_NOT_VERIFIED',
          transport: 'USER_COPY_PASTE',
          schemaVersion: MANUAL_EXTERNAL_IMPORT_SCHEMA_VERSION,
          importPayloadHash: payloadHash,
          originalCandidateCount: proposal.claims.length,
          invalidCandidateCount: invalid.length,
          outputAuthority: 'PROPOSAL_ONLY'
        }
      },
      audit
    });

    const candidates = compiled.claimCandidates.map((claimRecord, index) => {
      const contextRecord = compiled.sourceContextCandidates[index];
      return {
        claimCandidateRef: claimRecord.ref,
        sourceContextCandidateRef: contextRecord.ref,
        claimType: claimRecord.semanticPayload.claimType,
        assertion: claimRecord.semanticPayload.assertion,
        sourceLocator: claimRecord.semanticPayload.sourceLocator,
        extractionConfidence: claimRecord.semanticPayload.extractionConfidence ?? null,
        contextFamilies: contextRecord.semanticPayload.contextFamilies
      };
    });

    return {
      preflight,
      materialized: true,
      compilation: compiled.result,
      candidates
    };
  }
}
