import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const KNOWLEDGE_RETRIEVAL_RESULT_CONTRACT_VERSION = 'adr.knowledge-retrieval-result.v1';
export const KNOWLEDGE_RETRIEVAL_AUTHORITY_CLASS = 'RETRIEVAL_EVIDENCE_NON_SCIENTIFIC';
export const RETRIEVAL_ENGINE = deepFreeze({
  engineId: 'ADR_EXACT_RELEASE_MEMBER_SCAN',
  engineVersion: '1',
  algorithmContract: 'CANONICAL_EXACT_RELEASE_MEMBER_KIND_FILTER'
});
export const RETRIEVABLE_KNOWLEDGE_KINDS = deepFreeze(['QualifiedKnowledge', 'DerivedKnowledge']);
const KIND_SET = new Set(RETRIEVABLE_KNOWLEDGE_KINDS);
const CONFIG_KEYS = new Set(['strategy', 'candidateKinds', 'contextSummaryMode']);
const RESULT_KEYS = new Set([
  'contractVersion', 'authorityClass', 'decisionProblemRef', 'deploymentRef',
  'runtimeProfileRef', 'knowledgeReleaseRef', 'engine', 'config', 'configHash',
  'querySemantics', 'querySemanticHash', 'corpusSnapshot', 'candidateRefs',
  'missDiagnostics'
]);
const QUERY_KEYS = new Set([
  'decisionType', 'usePurpose', 'useClass', 'decisionAuthorityMode', 'objectiveCode'
]);
const CORPUS_KEYS = new Set([
  'sourceMode', 'knowledgeReleaseRef', 'memberSetHash', 'indexMode', 'indexSnapshotHash'
]);
const MISS_KEYS = new Set(['code', 'scope']);

export class KnowledgeRetrievalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'KnowledgeRetrievalError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_FIELD', `${name}.${key} is not part of the frozen A07 contract`);
    }
  }
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function exactRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_REF', `${name} must be an exact ${kind} ref`);
  }
  return ref;
}

function normalizeEngine(value) {
  exactObject(value, 'engine', new Set(['engineId', 'engineVersion', 'algorithmContract']));
  const normalized = {
    engineId: text(value.engineId, 'engine.engineId'),
    engineVersion: text(value.engineVersion, 'engine.engineVersion'),
    algorithmContract: text(value.algorithmContract, 'engine.algorithmContract')
  };
  if (semanticHash('KnowledgeRetrievalEngine', normalized)
    !== semanticHash('KnowledgeRetrievalEngine', RETRIEVAL_ENGINE)) {
    throw new KnowledgeRetrievalError('UNSUPPORTED_RETRIEVAL_ENGINE', 'A07 v1 accepts only the frozen exact-release member scan engine');
  }
  return RETRIEVAL_ENGINE;
}

export function normalizeRetrievalConfig(value = {}) {
  exactObject(value, 'config', CONFIG_KEYS);
  const strategy = text(value.strategy ?? 'ALL_RELEASE_MEMBERS_BY_KIND', 'config.strategy');
  if (strategy !== 'ALL_RELEASE_MEMBERS_BY_KIND') {
    throw new KnowledgeRetrievalError('UNSUPPORTED_RETRIEVAL_STRATEGY', `unsupported retrieval strategy ${strategy}`);
  }
  const contextSummaryMode = text(value.contextSummaryMode ?? 'NONE', 'config.contextSummaryMode');
  if (contextSummaryMode !== 'NONE') {
    throw new KnowledgeRetrievalError(
      'A07_CONTEXT_SUMMARY_NOT_ENABLED',
      'A07 minimal retrieval does not consume ContextManifest summaries; target-context retrieval remains an explicit later extension'
    );
  }
  const candidateKindsInput = value.candidateKinds ?? RETRIEVABLE_KNOWLEDGE_KINDS;
  if (!Array.isArray(candidateKindsInput) || candidateKindsInput.length === 0) {
    throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_CONFIG', 'config.candidateKinds must be a non-empty array');
  }
  const candidateKinds = candidateKindsInput.map((kind, index) => text(kind, `config.candidateKinds[${index}]`));
  if (new Set(candidateKinds).size !== candidateKinds.length) {
    throw new KnowledgeRetrievalError('DUPLICATE_RETRIEVAL_KIND', 'config.candidateKinds cannot contain duplicates');
  }
  for (const kind of candidateKinds) {
    if (!KIND_SET.has(kind)) throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_KIND', `unsupported candidate kind ${kind}`);
  }
  return deepFreeze({
    strategy,
    candidateKinds: [...candidateKinds].sort(),
    contextSummaryMode
  });
}

function normalizeQuerySemantics(value) {
  exactObject(value, 'querySemantics', QUERY_KEYS);
  return deepFreeze({
    decisionType: text(value.decisionType, 'querySemantics.decisionType'),
    usePurpose: text(value.usePurpose, 'querySemantics.usePurpose'),
    useClass: text(value.useClass, 'querySemantics.useClass'),
    decisionAuthorityMode: text(value.decisionAuthorityMode, 'querySemantics.decisionAuthorityMode'),
    objectiveCode: text(value.objectiveCode, 'querySemantics.objectiveCode')
  });
}

function normalizeCorpusSnapshot(value) {
  exactObject(value, 'corpusSnapshot', CORPUS_KEYS);
  const knowledgeReleaseRef = exactRef(value.knowledgeReleaseRef, 'KnowledgeRelease', 'corpusSnapshot.knowledgeReleaseRef');
  const sourceMode = text(value.sourceMode, 'corpusSnapshot.sourceMode');
  const indexMode = text(value.indexMode, 'corpusSnapshot.indexMode');
  if (sourceMode !== 'EXACT_KNOWLEDGE_RELEASE' || indexMode !== 'NO_EXTERNAL_MUTABLE_INDEX') {
    throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_CORPUS_MODE', 'A07 v1 corpus must be the exact KnowledgeRelease with no mutable external index');
  }
  return deepFreeze({
    sourceMode,
    knowledgeReleaseRef,
    memberSetHash: text(value.memberSetHash, 'corpusSnapshot.memberSetHash'),
    indexMode,
    indexSnapshotHash: text(value.indexSnapshotHash, 'corpusSnapshot.indexSnapshotHash')
  });
}

function normalizeCandidateRefs(values) {
  if (!Array.isArray(values)) throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_CANDIDATES', 'candidateRefs must be an array');
  const refs = values.map((value, index) => {
    const ref = assertAuthorityRef(value);
    if (!KIND_SET.has(ref.kind)) {
      throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_CANDIDATE_KIND', `candidateRefs[${index}] has unsupported kind ${ref.kind}`);
    }
    return ref;
  });
  const keys = refs.map(refKey);
  if (new Set(keys).size !== keys.length) throw new KnowledgeRetrievalError('DUPLICATE_RETRIEVAL_CANDIDATE', 'candidateRefs cannot contain duplicates');
  const sorted = [...keys].sort();
  if (JSON.stringify(keys) !== JSON.stringify(sorted)) {
    throw new KnowledgeRetrievalError('NONCANONICAL_RETRIEVAL_CANDIDATES', 'candidateRefs must use canonical exact-ref order');
  }
  return deepFreeze(refs);
}

function normalizeMissDiagnostics(values, candidateCount) {
  if (!Array.isArray(values)) throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_MISS_DIAGNOSTICS', 'missDiagnostics must be an array');
  const normalized = values.map((value, index) => {
    exactObject(value, `missDiagnostics[${index}]`, MISS_KEYS);
    const code = text(value.code, `missDiagnostics[${index}].code`);
    const scope = text(value.scope, `missDiagnostics[${index}].scope`);
    if (scope !== 'RETRIEVAL_ONLY_NON_SCIENTIFIC') {
      throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_MISS_SCOPE', 'retrieval miss diagnostics cannot claim scientific/applicability authority');
    }
    return { code, scope };
  });
  if (candidateCount === 0) {
    if (normalized.length !== 1 || normalized[0].code !== 'NO_RELEASE_MEMBERS_OF_CONFIGURED_KIND') {
      throw new KnowledgeRetrievalError('RETRIEVAL_MISS_DIAGNOSTIC_REQUIRED', 'zero-candidate result must carry the exact retrieval-only miss diagnostic');
    }
  } else if (normalized.length !== 0) {
    throw new KnowledgeRetrievalError('SPURIOUS_RETRIEVAL_MISS_DIAGNOSTIC', 'non-empty candidate set cannot carry retrieval miss diagnostics');
  }
  return deepFreeze(normalized);
}

export function normalizeKnowledgeRetrievalResult(value) {
  exactObject(value, 'KnowledgeRetrievalResult', RESULT_KEYS);
  const contractVersion = text(value.contractVersion, 'contractVersion');
  if (contractVersion !== KNOWLEDGE_RETRIEVAL_RESULT_CONTRACT_VERSION) {
    throw new KnowledgeRetrievalError('UNSUPPORTED_RETRIEVAL_RESULT_CONTRACT', `unsupported contractVersion ${contractVersion}`);
  }
  if (value.authorityClass !== KNOWLEDGE_RETRIEVAL_AUTHORITY_CLASS) {
    throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_AUTHORITY_CLASS', `authorityClass must be ${KNOWLEDGE_RETRIEVAL_AUTHORITY_CLASS}`);
  }
  const config = normalizeRetrievalConfig(value.config);
  const configHash = text(value.configHash, 'configHash');
  if (configHash !== semanticHash('KnowledgeRetrievalConfig', config)) {
    throw new KnowledgeRetrievalError('RETRIEVAL_CONFIG_HASH_MISMATCH', 'configHash does not match exact canonical config');
  }
  const querySemantics = normalizeQuerySemantics(value.querySemantics);
  const querySemanticHash = text(value.querySemanticHash, 'querySemanticHash');
  if (querySemanticHash !== semanticHash('KnowledgeRetrievalQuerySemantics', querySemantics)) {
    throw new KnowledgeRetrievalError('RETRIEVAL_QUERY_HASH_MISMATCH', 'querySemanticHash does not match exact query semantics');
  }
  const knowledgeReleaseRef = exactRef(value.knowledgeReleaseRef, 'KnowledgeRelease', 'knowledgeReleaseRef');
  const corpusSnapshot = normalizeCorpusSnapshot(value.corpusSnapshot);
  if (refKey(corpusSnapshot.knowledgeReleaseRef) !== refKey(knowledgeReleaseRef)) {
    throw new KnowledgeRetrievalError('RETRIEVAL_CORPUS_RELEASE_MISMATCH', 'corpus snapshot must bind the same exact KnowledgeRelease');
  }
  const candidateRefs = normalizeCandidateRefs(value.candidateRefs);
  return deepFreeze({
    contractVersion,
    authorityClass: KNOWLEDGE_RETRIEVAL_AUTHORITY_CLASS,
    decisionProblemRef: exactRef(value.decisionProblemRef, 'DecisionProblem', 'decisionProblemRef'),
    deploymentRef: exactRef(value.deploymentRef, 'Deployment', 'deploymentRef'),
    runtimeProfileRef: exactRef(value.runtimeProfileRef, 'RuntimeProfile', 'runtimeProfileRef'),
    knowledgeReleaseRef,
    engine: normalizeEngine(value.engine),
    config,
    configHash,
    querySemantics,
    querySemanticHash,
    corpusSnapshot,
    candidateRefs,
    missDiagnostics: normalizeMissDiagnostics(value.missDiagnostics, candidateRefs.length)
  });
}

export function cloneKnowledgeRetrievalResult(value) {
  return cloneCanonicalValue(normalizeKnowledgeRetrievalResult(value));
}
