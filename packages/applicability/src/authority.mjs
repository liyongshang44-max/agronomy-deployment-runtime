import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateKnowledgeRetrievalResult } from '../../knowledge-retrieval/src/index.mjs';
import { validateContextManifestAuthority } from '../../context-manifest/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { ScientificQualificationService } from '../../knowledge-registry/src/qualification.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import { ApplicabilityError, normalizeApplicabilityAssessment } from './contract.mjs';
import { buildApplicabilityAssessment } from './engine.mjs';

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ApplicabilityError('INVALID_APPLICABILITY_INPUT', `${name} must be a non-empty string`);
  return value.trim();
}

function resolveKind(ledger, ref, kinds, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (!kinds.includes(record.ref.kind)) throw new ApplicabilityError(code, `expected ${kinds.join(' or ')}, received ${record.ref.kind}`);
  return record;
}

function refKey(ref) {
  const r = assertAuthorityRef(ref);
  return JSON.stringify([r.kind, r.logicalId, r.version, r.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function canonicalRefs(refs) {
  const unique = new Map();
  for (const ref of refs) unique.set(refKey(ref), assertAuthorityRef(ref));
  return [...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left).map(refKey);
  const b = canonicalRefs(right).map(refKey);
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function frozenQkUseStatus({ ledger, knowledge, usePurpose, allowHistorical }) {
  const target = { use: usePurpose };
  if (allowHistorical) {
    if ((knowledge.semanticPayload.forbiddenUses ?? []).some((item) => item.use === usePurpose)) return 'PROHIBITED';
    if ((knowledge.semanticPayload.allowedUses ?? []).some((item) => item.use === usePurpose)) return 'QUALIFIED';
    return 'UNQUALIFIED';
  }
  return new ScientificQualificationService({ ledger }).qualifiedUseStatus({
    qualifiedKnowledgeRef: knowledge.ref,
    qualificationTarget: target
  });
}

function qkTransportInputs(validated) {
  const p = validated.knowledge.semanticPayload;
  return {
    originContextRefs: [validated.sourceContext.ref],
    semanticPreconditions: p.semanticPreconditions ?? [],
    effectModifiers: p.effectModifiers ?? [],
    transportConstraints: p.transportConstraints ?? [],
    limitations: p.limitations ?? [],
    unresolvedContextHeterogeneity: [],
    auditRefs: [validated.sourceContext.ref, ...(p.qualificationDecisionRefs ?? [])]
  };
}

function dkTransportInputs(validated) {
  const inputs = validated.validatedInputs;
  const flatten = (field) => inputs.flatMap((item) => item.knowledge.semanticPayload[field] ?? []);
  return {
    originContextRefs: [validated.context.ref],
    semanticPreconditions: flatten('semanticPreconditions'),
    effectModifiers: flatten('effectModifiers'),
    transportConstraints: [
      ...flatten('transportConstraints'),
      ...(validated.context.semanticPayload.introducedRestrictions ?? [])
    ],
    limitations: [
      ...flatten('limitations'),
      ...(validated.knowledge.semanticPayload.limitations ?? [])
    ],
    unresolvedContextHeterogeneity: validated.context.semanticPayload.unresolvedContextHeterogeneity ?? [],
    auditRefs: [
      validated.context.ref,
      validated.method.ref,
      ...(validated.knowledge.semanticPayload.inputQualifiedKnowledgeRefs ?? [])
    ]
  };
}

function validateKnowledge({ ledger, knowledgeRef, usePurpose, allowHistorical }) {
  const record = resolveKind(ledger, knowledgeRef, ['QualifiedKnowledge', 'DerivedKnowledge'], 'APPLICABILITY_KNOWLEDGE_REQUIRED');
  if (record.ref.kind === 'QualifiedKnowledge') {
    const validated = validateQualifiedKnowledgeAuthority({ ledger, qualifiedKnowledgeRef: record.ref, allowHistorical });
    return {
      record,
      scientificUseStatus: frozenQkUseStatus({ ledger, knowledge: validated.knowledge, usePurpose, allowHistorical }),
      transport: qkTransportInputs(validated)
    };
  }
  const validated = validateDerivedKnowledgeAuthority({ ledger, derivedKnowledgeRef: record.ref, allowHistorical });
  return {
    record,
    scientificUseStatus: validated.useTarget.use === usePurpose ? 'QUALIFIED' : 'UNQUALIFIED',
    transport: dkTransportInputs(validated)
  };
}

function replayWorld({ ledger, knowledgeRetrievalResultRef, knowledgeRef, contextManifestRef, snapshotStore, allowHistorical }) {
  const retrieval = validateKnowledgeRetrievalResult({ ledger, knowledgeRetrievalResultRef, allowHistorical });
  if (!exactRefIn(retrieval.semanticPayload.candidateRefs, knowledgeRef)) {
    throw new ApplicabilityError('KNOWLEDGE_NOT_IN_RETRIEVAL_RESULT', 'Applicability may assess only an exact candidate emitted by the bound KnowledgeRetrievalResult');
  }
  const manifest = validateContextManifestAuthority({ ledger, contextManifestRef, snapshotStore });
  if (!sameAuthorityRef(retrieval.semanticPayload.decisionProblemRef, manifest.semanticPayload.decisionProblemRef)) {
    throw new ApplicabilityError('APPLICABILITY_DECISION_PROBLEM_MISMATCH', 'KnowledgeRetrievalResult and ContextManifest must bind the same exact DecisionProblem');
  }
  const decision = retrieval.decisionAuthority.semanticPayload;
  if (decision.usePurpose !== retrieval.semanticPayload.querySemantics.usePurpose) {
    throw new ApplicabilityError('APPLICABILITY_RETRIEVAL_QUERY_MISMATCH', 'retrieval query usePurpose differs from exact DecisionProblem');
  }
  const knowledge = validateKnowledge({ ledger, knowledgeRef, usePurpose: decision.usePurpose, allowHistorical });
  const expected = buildApplicabilityAssessment({
    knowledgeRetrievalResultRef: retrieval.record.ref,
    knowledgeRef: knowledge.record.ref,
    knowledgeOriginContextRefs: knowledge.transport.originContextRefs,
    contextManifestRef: manifest.record.ref,
    decisionProblemRef: retrieval.decisionAuthority.record.ref,
    decisionProblem: decision,
    manifestAuthority: manifest,
    scientificUseStatus: knowledge.scientificUseStatus,
    semanticPreconditions: knowledge.transport.semanticPreconditions,
    effectModifiers: knowledge.transport.effectModifiers,
    transportConstraints: knowledge.transport.transportConstraints,
    limitations: knowledge.transport.limitations,
    unresolvedContextHeterogeneity: knowledge.transport.unresolvedContextHeterogeneity
  });
  const inputRefs = canonicalRefs([
    retrieval.record.ref,
    knowledge.record.ref,
    manifest.record.ref,
    retrieval.decisionAuthority.record.ref,
    ...knowledge.transport.auditRefs
  ]);
  return deepFreeze({ retrieval, manifest, knowledge, expected, inputRefs });
}

export function assessKnowledgeApplicability({
  ledger,
  logicalId,
  version,
  knowledgeRetrievalResultRef,
  knowledgeRef,
  contextManifestRef,
  snapshotStore,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ApplicabilityError('INVALID_LEDGER', 'A08 applicability requires a replayable AuthorityLedger');
  }
  const world = replayWorld({
    ledger,
    knowledgeRetrievalResultRef,
    knowledgeRef,
    contextManifestRef,
    snapshotStore,
    allowHistorical: false
  });
  const actor = world.retrieval.retrievalPrincipal;
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new ApplicabilityError('APPLICABILITY_AUDIT_ACTOR_MISMATCH', 'Applicability publication actor must equal the exact A07 runtime principal');
  }
  return ledger.publish({
    kind: 'ApplicabilityAssessment',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: world.expected,
    audit: {
      ...audit,
      action: 'PUBLISH_APPLICABILITY_ASSESSMENT',
      inputRefs: world.inputRefs,
      details: {
        ...(audit.details ?? {}),
        applicabilityPrincipal: actor,
        authorityClass: world.expected.authorityClass
      }
    }
  });
}

export function validateApplicabilityAssessment({ ledger, applicabilityAssessmentRef, snapshotStore, allowHistorical = false }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ApplicabilityError('INVALID_LEDGER', 'A08 validation requires a replayable AuthorityLedger');
  }
  const record = resolveKind(ledger, applicabilityAssessmentRef, ['ApplicabilityAssessment'], 'APPLICABILITY_ASSESSMENT_REQUIRED');
  const stored = normalizeApplicabilityAssessment(record.semanticPayload);
  if (semanticHash('ApplicabilityAssessment', stored) !== record.ref.semanticHash) {
    throw new ApplicabilityError('APPLICABILITY_SEMANTIC_HASH_MISMATCH', 'stored ApplicabilityAssessment does not reproduce its authority ref');
  }
  const world = replayWorld({
    ledger,
    knowledgeRetrievalResultRef: stored.knowledgeRetrievalResultRef,
    knowledgeRef: stored.knowledgeRef,
    contextManifestRef: stored.contextManifestRef,
    snapshotStore,
    allowHistorical
  });
  if (semanticHash('ApplicabilityAssessment', world.expected) !== record.ref.semanticHash) {
    throw new ApplicabilityError('APPLICABILITY_REPLAY_MISMATCH', 'current/historical authority inputs do not reproduce the frozen applicability assessment');
  }
  const actor = world.retrieval.retrievalPrincipal;
  const validAudit = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_APPLICABILITY_ASSESSMENT'
      && event.actor?.id === actor.principalId
      && event.actor?.type === actor.type
      && event.details?.applicabilityPrincipal?.principalId === actor.principalId
      && event.details?.applicabilityPrincipal?.type === actor.type
      && sameRefSet(event.inputRefs, world.inputRefs));
  if (!validAudit) {
    throw new ApplicabilityError('APPLICABILITY_PUBLICATION_AUTHORITY_INVALID', 'ApplicabilityAssessment lacks exact runtime-principal audit over retrieval/knowledge/origin/context/decision authority');
  }
  return deepFreeze({
    record,
    semanticPayload: stored,
    retrievalAuthority: world.retrieval,
    contextManifestAuthority: world.manifest,
    knowledgeAuthority: world.knowledge.record,
    applicabilityPrincipal: actor
  });
}
