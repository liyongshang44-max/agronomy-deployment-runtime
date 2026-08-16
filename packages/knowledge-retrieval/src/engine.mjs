import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import {
  KNOWLEDGE_RETRIEVAL_AUTHORITY_CLASS,
  KNOWLEDGE_RETRIEVAL_RESULT_CONTRACT_VERSION,
  RETRIEVAL_ENGINE,
  normalizeKnowledgeRetrievalResult,
  normalizeRetrievalConfig
} from './contract.mjs';

function querySemanticsFromDecision(decisionProblem) {
  return deepFreeze({
    decisionType: decisionProblem.decisionType,
    usePurpose: decisionProblem.usePurpose,
    useClass: decisionProblem.useClass,
    decisionAuthorityMode: decisionProblem.decisionAuthorityMode,
    objectiveCode: decisionProblem.objective.code
  });
}

export function buildKnowledgeRetrievalResult({
  decisionProblemRef,
  decisionProblem,
  deploymentRef,
  runtimeProfileRef,
  knowledgeReleaseRef,
  releaseMemberRefs,
  config: configInput
}) {
  const config = normalizeRetrievalConfig(configInput ?? {});
  const querySemantics = querySemanticsFromDecision(decisionProblem);
  const memberSetHash = semanticHash('KnowledgeRetrievalMemberSet', releaseMemberRefs);
  const indexSnapshotHash = semanticHash('KnowledgeRetrievalIndexSnapshot', {
    engine: RETRIEVAL_ENGINE,
    sourceMode: 'EXACT_KNOWLEDGE_RELEASE',
    knowledgeReleaseRef,
    memberSetHash,
    indexMode: 'NO_EXTERNAL_MUTABLE_INDEX'
  });
  const candidateRefs = releaseMemberRefs.filter((ref) => config.candidateKinds.includes(ref.kind));
  const missDiagnostics = candidateRefs.length === 0
    ? [{ code: 'NO_RELEASE_MEMBERS_OF_CONFIGURED_KIND', scope: 'RETRIEVAL_ONLY_NON_SCIENTIFIC' }]
    : [];

  return normalizeKnowledgeRetrievalResult({
    contractVersion: KNOWLEDGE_RETRIEVAL_RESULT_CONTRACT_VERSION,
    authorityClass: KNOWLEDGE_RETRIEVAL_AUTHORITY_CLASS,
    decisionProblemRef,
    deploymentRef,
    runtimeProfileRef,
    knowledgeReleaseRef,
    engine: RETRIEVAL_ENGINE,
    config,
    configHash: semanticHash('KnowledgeRetrievalConfig', config),
    querySemantics,
    querySemanticHash: semanticHash('KnowledgeRetrievalQuerySemantics', querySemantics),
    corpusSnapshot: {
      sourceMode: 'EXACT_KNOWLEDGE_RELEASE',
      knowledgeReleaseRef,
      memberSetHash,
      indexMode: 'NO_EXTERNAL_MUTABLE_INDEX',
      indexSnapshotHash
    },
    candidateRefs,
    missDiagnostics
  });
}
