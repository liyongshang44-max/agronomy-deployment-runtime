import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { sourceContentHash } from '../../source-registry/src/index.mjs';

export const CLAIM_CANDIDATE_TYPES = deepFreeze([
  'SEMANTIC_DEFINITION',
  'PARAMETER',
  'RELATIONSHIP',
  'BIOLOGICAL_PATTERN',
  'CAUSAL_EFFECT',
  'STATISTICAL_ASSOCIATION',
  'MODEL_ASSUMPTION',
  'OPERATIONAL_RECOMMENDATION',
  'BOUNDARY_CONSTRAINT',
  'EVALUATION_CLAIM'
]);

export const SOURCE_CONTEXT_FAMILIES = deepFreeze([
  'BIOLOGICAL',
  'ENVIRONMENTAL',
  'MANAGEMENT',
  'OPERATIONAL',
  'MEASUREMENT',
  'JURISDICTION_ECONOMIC'
]);

const CLAIM_TYPE_SET = new Set(CLAIM_CANDIDATE_TYPES);
const CONTEXT_FAMILY_SET = new Set(SOURCE_CONTEXT_FAMILIES);

export class ScientificCompilerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ScientificCompilerError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ScientificCompilerError('INVALID_COMPILER_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function optionalNumber(value, name) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ScientificCompilerError('INVALID_COMPILER_INPUT', `${name} must be a finite number`);
  }
  return value;
}

function exactSourceArtifact(record) {
  if (!record?.ref || record.ref.kind !== 'SourceArtifact') {
    throw new ScientificCompilerError('SOURCE_ARTIFACT_REQUIRED', 'Scientific Compiler requires an exact SourceArtifact record');
  }
  return record;
}

function compilerDefinitionRecord(record) {
  if (!record?.ref || record.ref.kind !== 'ScientificCompilerDefinition') {
    throw new ScientificCompilerError('COMPILER_DEFINITION_REQUIRED', 'expected ScientificCompilerDefinition authority record');
  }
  return record;
}

function claimCandidateRecord(record) {
  if (!record?.ref || record.ref.kind !== 'ClaimCandidate') {
    throw new ScientificCompilerError('CLAIM_CANDIDATE_REQUIRED', 'expected ClaimCandidate record');
  }
  return record;
}

function normalizeClaimType(value) {
  const normalized = requiredText(value, 'claimType');
  if (!CLAIM_TYPE_SET.has(normalized)) {
    throw new ScientificCompilerError('INVALID_CLAIM_CANDIDATE_TYPE', `unsupported ClaimCandidate type ${normalized}`);
  }
  return normalized;
}

function normalizeLocator(locator, artifactBytes) {
  if (!locator || typeof locator !== 'object' || Array.isArray(locator)) {
    throw new ScientificCompilerError('SOURCE_LOCATOR_REQUIRED', 'candidate source locator must be an object');
  }
  const kind = requiredText(locator.kind, 'locator.kind');

  if (kind === 'WHOLE_ARTIFACT') {
    return deepFreeze({
      kind,
      contentHash: sourceContentHash(artifactBytes),
      byteLength: artifactBytes.byteLength
    });
  }

  if (kind === 'BYTE_RANGE') {
    const start = locator.start;
    const endExclusive = locator.endExclusive;
    if (!Number.isInteger(start) || !Number.isInteger(endExclusive) || start < 0 || endExclusive <= start || endExclusive > artifactBytes.byteLength) {
      throw new ScientificCompilerError('INVALID_BYTE_RANGE', `invalid BYTE_RANGE ${start}:${endExclusive} for artifact length ${artifactBytes.byteLength}`);
    }
    const selected = artifactBytes.subarray(start, endExclusive);
    return deepFreeze({
      kind,
      start,
      endExclusive,
      evidenceHash: sourceContentHash(selected),
      byteLength: selected.byteLength
    });
  }

  if (kind === 'DOCUMENT_COORDINATE') {
    const scheme = requiredText(locator.scheme, 'locator.scheme');
    if (!locator.coordinates || typeof locator.coordinates !== 'object' || Array.isArray(locator.coordinates)) {
      throw new ScientificCompilerError('INVALID_DOCUMENT_COORDINATE', 'DOCUMENT_COORDINATE requires coordinates object');
    }
    return deepFreeze({
      kind,
      scheme,
      coordinates: cloneCanonicalValue(locator.coordinates),
      ...(locator.evidenceHash ? { evidenceHash: requiredText(locator.evidenceHash, 'locator.evidenceHash') } : {})
    });
  }

  throw new ScientificCompilerError('UNSUPPORTED_SOURCE_LOCATOR', `unsupported source locator kind ${kind}`);
}

function normalizeDimensionCandidate(dimension, artifactBytes, family) {
  if (!dimension || typeof dimension !== 'object' || Array.isArray(dimension)) {
    throw new ScientificCompilerError('INVALID_CONTEXT_DIMENSION_CANDIDATE', `${family} dimension candidate must be an object`);
  }
  const supportClass = requiredText(dimension.supportClass, `${family}.supportClass`);
  if (supportClass !== 'EXPLICIT_SOURCE') {
    throw new ScientificCompilerError(
      'NON_SOURCE_FAITHFUL_CONTEXT_CANDIDATE',
      `${family} context dimension must be EXPLICIT_SOURCE; inferred/defaulted conditions cannot enter SourceContextCandidate`
    );
  }
  return deepFreeze({
    semanticHint: requiredText(dimension.semanticHint, `${family}.semanticHint`),
    valueCandidate: cloneCanonicalValue(dimension.valueCandidate),
    ...(dimension.unitCandidate ? { unitCandidate: requiredText(dimension.unitCandidate, `${family}.unitCandidate`) } : {}),
    supportClass,
    sourceLocator: normalizeLocator(dimension.sourceLocator, artifactBytes),
    ...(optionalNumber(dimension.confidence, `${family}.confidence`) !== undefined
      ? { confidence: optionalNumber(dimension.confidence, `${family}.confidence`) }
      : {})
  });
}

function normalizeContextFamily(candidate, artifactBytes, family) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new ScientificCompilerError('CONTEXT_FAMILY_REQUIRED', `SourceContextCandidate requires ${family}`);
  }
  const status = requiredText(candidate.status, `${family}.status`);
  if (status !== 'REPORTED' && status !== 'NOT_REPORTED') {
    throw new ScientificCompilerError('INVALID_CONTEXT_REPORTING_STATUS', `${family}.status must be REPORTED or NOT_REPORTED`);
  }
  const dimensions = candidate.dimensions ?? [];
  if (!Array.isArray(dimensions)) {
    throw new ScientificCompilerError('INVALID_CONTEXT_DIMENSIONS', `${family}.dimensions must be an array`);
  }
  if (status === 'NOT_REPORTED' && dimensions.length !== 0) {
    throw new ScientificCompilerError('NOT_REPORTED_WITH_VALUES', `${family} cannot contain dimensions when status is NOT_REPORTED`);
  }
  if (status === 'REPORTED' && dimensions.length === 0) {
    throw new ScientificCompilerError('REPORTED_WITHOUT_VALUES', `${family} must contain at least one source-supported dimension when status is REPORTED`);
  }
  return deepFreeze({
    status,
    dimensions: dimensions.map((dimension) => normalizeDimensionCandidate(dimension, artifactBytes, family))
  });
}

function normalizeSourceContextCandidate(candidate, artifactBytes) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new ScientificCompilerError('SOURCE_CONTEXT_CANDIDATE_REQUIRED', 'each ClaimCandidate requires a SourceContextCandidate proposal');
  }
  const keys = Object.keys(candidate);
  for (const key of keys) {
    if (!CONTEXT_FAMILY_SET.has(key)) {
      throw new ScientificCompilerError('UNKNOWN_CONTEXT_FAMILY', `unknown SourceContextCandidate family ${key}`);
    }
  }
  const normalized = {};
  for (const family of SOURCE_CONTEXT_FAMILIES) {
    normalized[family] = normalizeContextFamily(candidate[family], artifactBytes, family);
  }
  return deepFreeze(normalized);
}

function normalizeClaimProposal(proposal, artifactBytes) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new ScientificCompilerError('INVALID_CLAIM_PROPOSAL', 'claim proposal must be an object');
  }
  return deepFreeze({
    key: requiredText(proposal.key, 'claim.key'),
    claimType: normalizeClaimType(proposal.claimType),
    assertion: requiredText(proposal.assertion, 'claim.assertion'),
    ...(proposal.structured !== undefined ? { structured: cloneCanonicalValue(proposal.structured) } : {}),
    sourceLocator: normalizeLocator(proposal.sourceLocator, artifactBytes),
    ...(optionalNumber(proposal.confidence, 'claim.confidence') !== undefined
      ? { confidence: optionalNumber(proposal.confidence, 'claim.confidence') }
      : {}),
    sourceContext: normalizeSourceContextCandidate(proposal.sourceContext, artifactBytes)
  });
}

function assertUniqueClaimKeys(claims) {
  const keys = new Set();
  for (const claim of claims) {
    if (keys.has(claim.key)) throw new ScientificCompilerError('DUPLICATE_CLAIM_KEY', `duplicate claim key ${claim.key}`);
    keys.add(claim.key);
  }
}

export function createDeterministicCompilerDefinition({
  ledger,
  logicalId,
  version,
  compilerId,
  implementationVersion,
  extractionContractVersion = 'adr-scientific-compiler-candidates-v1',
  locatorContractVersion = 'adr-source-locator-v1',
  configuration = {},
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function') {
    throw new ScientificCompilerError('INVALID_LEDGER', 'shared AuthorityLedger is required');
  }
  return ledger.publish({
    kind: 'ScientificCompilerDefinition',
    logicalId: requiredText(logicalId, 'logicalId'),
    version: requiredText(version, 'version'),
    semanticPayload: {
      compilerId: requiredText(compilerId, 'compilerId'),
      implementationVersion: requiredText(implementationVersion, 'implementationVersion'),
      extractionContractVersion: requiredText(extractionContractVersion, 'extractionContractVersion'),
      locatorContractVersion: requiredText(locatorContractVersion, 'locatorContractVersion'),
      configuration: cloneCanonicalValue(configuration),
      outputAuthority: 'CANDIDATE_ONLY'
    },
    audit
  });
}

export class ScientificCompiler {
  #ledger;
  #sourceRegistry;

  constructor({ ledger, sourceRegistry }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function') {
      throw new ScientificCompilerError('INVALID_LEDGER', 'shared AuthorityLedger is required');
    }
    if (!sourceRegistry || typeof sourceRegistry.resolveArtifact !== 'function' || typeof sourceRegistry.readArtifactBytes !== 'function') {
      throw new ScientificCompilerError('INVALID_SOURCE_REGISTRY', 'ScientificCompiler requires SourceRegistry exact-artifact access');
    }
    this.#ledger = ledger;
    this.#sourceRegistry = sourceRegistry;
  }

  compileWithExtractor({
    compilationLogicalId,
    version,
    sourceArtifactRef,
    compilerDefinitionRef,
    extractor,
    audit
  }) {
    if (typeof extractor !== 'function') {
      throw new ScientificCompilerError('EXTRACTOR_REQUIRED', 'compileWithExtractor requires a local extractor function');
    }
    const artifact = exactSourceArtifact(this.#sourceRegistry.resolveArtifact(assertAuthorityRef(sourceArtifactRef)));
    const compilerDefinition = compilerDefinitionRecord(this.#ledger.resolve(assertAuthorityRef(compilerDefinitionRef)));
    const bytes = this.#sourceRegistry.readArtifactBytes(artifact.ref);
    const proposal = extractor({
      bytes: Buffer.from(bytes),
      sourceArtifact: artifact,
      compilerDefinition
    });
    if (proposal && typeof proposal.then === 'function') {
      throw new ScientificCompilerError(
        'ASYNC_EXTRACTOR_NOT_SUPPORTED_IN_CORE',
        'core ScientificCompiler does not call async/external providers directly; external workers must materialize a proposal explicitly'
      );
    }
    return this.materializeCompilationProposal({
      compilationLogicalId,
      version,
      sourceArtifactRef: artifact.ref,
      compilerDefinitionRef: compilerDefinition.ref,
      proposal,
      audit
    });
  }

  materializeCompilationProposal({
    compilationLogicalId,
    version,
    sourceArtifactRef,
    compilerDefinitionRef,
    proposal,
    audit
  }) {
    const artifact = exactSourceArtifact(this.#sourceRegistry.resolveArtifact(assertAuthorityRef(sourceArtifactRef)));
    const compilerDefinition = compilerDefinitionRecord(this.#ledger.resolve(assertAuthorityRef(compilerDefinitionRef)));
    const artifactBytes = this.#sourceRegistry.readArtifactBytes(artifact.ref);

    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal) || !Array.isArray(proposal.claims)) {
      throw new ScientificCompilerError('INVALID_COMPILATION_PROPOSAL', 'compilation proposal must contain claims[]');
    }

    const claims = proposal.claims.map((claim) => normalizeClaimProposal(claim, artifactBytes));
    assertUniqueClaimKeys(claims);

    const candidateRefs = [];
    const contextCandidateRefs = [];

    for (const claim of claims) {
      const claimRecord = this.#ledger.publish({
        kind: 'ClaimCandidate',
        logicalId: `${requiredText(compilationLogicalId, 'compilationLogicalId')}/claim/${claim.key}`,
        version: requiredText(version, 'version'),
        semanticPayload: {
          claimType: claim.claimType,
          assertion: claim.assertion,
          ...(claim.structured !== undefined ? { structured: claim.structured } : {}),
          sourceRef: artifact.semanticPayload.sourceRef,
          sourceArtifactRef: artifact.ref,
          sourceArtifactContentHash: artifact.semanticPayload.contentHash,
          sourceLocator: claim.sourceLocator,
          compilerDefinitionRef: compilerDefinition.ref,
          ...(claim.confidence !== undefined ? { extractionConfidence: claim.confidence } : {}),
          authorityClass: 'CANDIDATE_PROPOSAL'
        },
        audit: {
          ...audit,
          eventId: `${requiredText(audit?.eventId, 'audit.eventId')}:claim:${claim.key}`,
          inputRefs: [artifact.ref, compilerDefinition.ref, ...(audit?.inputRefs ?? [])]
        }
      });

      const contextRecord = this.#ledger.publish({
        kind: 'SourceContextCandidate',
        logicalId: `${requiredText(compilationLogicalId, 'compilationLogicalId')}/source-context/${claim.key}`,
        version: requiredText(version, 'version'),
        semanticPayload: {
          claimCandidateRef: claimRecord.ref,
          sourceRef: artifact.semanticPayload.sourceRef,
          sourceArtifactRef: artifact.ref,
          sourceArtifactContentHash: artifact.semanticPayload.contentHash,
          compilerDefinitionRef: compilerDefinition.ref,
          contextFamilies: claim.sourceContext,
          authorityClass: 'CANDIDATE_PROPOSAL'
        },
        audit: {
          ...audit,
          eventId: `${requiredText(audit?.eventId, 'audit.eventId')}:context:${claim.key}`,
          inputRefs: [claimRecord.ref, artifact.ref, compilerDefinition.ref, ...(audit?.inputRefs ?? [])]
        }
      });

      candidateRefs.push(claimRecord.ref);
      contextCandidateRefs.push(contextRecord.ref);
    }

    const normalizedRunMetadata = cloneCanonicalValue(proposal.runMetadata ?? {});
    const result = this.#ledger.publish({
      kind: 'ScientificCompilationResult',
      logicalId: requiredText(compilationLogicalId, 'compilationLogicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: {
        sourceRef: artifact.semanticPayload.sourceRef,
        sourceArtifactRef: artifact.ref,
        sourceArtifactContentHash: artifact.semanticPayload.contentHash,
        compilerDefinitionRef: compilerDefinition.ref,
        claimCandidateRefs: candidateRefs,
        sourceContextCandidateRefs: contextCandidateRefs,
        candidateCount: candidateRefs.length,
        runMetadata: normalizedRunMetadata,
        outputAuthority: 'PROPOSAL_ONLY'
      },
      audit: {
        ...audit,
        eventId: `${requiredText(audit?.eventId, 'audit.eventId')}:result`,
        inputRefs: [artifact.ref, compilerDefinition.ref, ...candidateRefs, ...contextCandidateRefs, ...(audit?.inputRefs ?? [])]
      }
    });

    return deepFreeze({
      result,
      claimCandidates: candidateRefs.map((ref) => claimCandidateRecord(this.#ledger.resolve(ref))),
      sourceContextCandidates: contextCandidateRefs.map((ref) => this.#ledger.resolve(ref))
    });
  }
}

export function compilationSemanticDigest(compilationBundle) {
  if (!compilationBundle?.result?.semanticPayload) {
    throw new ScientificCompilerError('COMPILATION_RESULT_REQUIRED', 'compilation bundle result is required');
  }
  return semanticHash('ScientificCompilationBundle', {
    result: compilationBundle.result.ref,
    claims: compilationBundle.claimCandidates.map((record) => record.ref),
    sourceContexts: compilationBundle.sourceContextCandidates.map((record) => record.ref)
  });
}
