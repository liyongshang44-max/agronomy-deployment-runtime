import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY,
  DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY,
  validateDecisionResult
} from '../../decision-result/src/index.mjs';
import { decisionResultExactRefs } from '../../decision-result/src/contract.mjs';
import {
  HistoricalDecisionBasisError,
  reconstructHistoricalDecisionBasis
} from './index.mjs';

export const HISTORICAL_DECISION_BASIS_PUBLICATION_AUDIT_CLASS =
  'NONE_NON_AUTHORITY_EXACT_DECISION_RESULT_PUBLICATION_AUDIT_PROJECTION';

function refKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

function canonicalRefs(values) {
  const map = new Map();
  for (const value of values) {
    const ref = assertAuthorityRef(value);
    map.set(refKey(ref), ref);
  }
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref);
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left).map(refKey);
  const b = canonicalRefs(right).map(refKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function auditPayload(event) {
  const { eventHash: _eventHash, ...payload } = event;
  return payload;
}

function validPublicationAudit({ event, record, stored, actor, expectedInputs }) {
  return sameAuthorityRef(event.objectRef, record.ref)
    && event.action === 'PUBLISH_DECISION_RESULT'
    && event.actor?.id === actor.principalId
    && event.actor?.type === actor.type
    && event.details?.decisionResultPrincipal?.principalId === actor.principalId
    && event.details?.decisionResultPrincipal?.type === actor.type
    && event.details?.decisionRobustnessRef
    && sameAuthorityRef(event.details.decisionRobustnessRef, stored.decisionRobustnessRef)
    && event.details?.runtimeAlternativeSetRef
    && sameAuthorityRef(event.details.runtimeAlternativeSetRef, stored.runtimeAlternativeSetRef)
    && event.details?.decisionDisposition === stored.decisionDisposition
    && canonicalizeSemanticJson(event.details?.decisionAuthority) === canonicalizeSemanticJson(stored.decisionAuthority)
    && canonicalizeSemanticJson(event.details?.informationRequirementRefs ?? []) === canonicalizeSemanticJson(stored.informationRequirementRefs)
    && canonicalizeSemanticJson(event.details?.policyResultHashes ?? []) === canonicalizeSemanticJson(stored.policyResultRefs.map((item) => item.policyResultHash))
    && event.details?.humanApprovalAuthority === DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY
    && event.details?.machineExecutionAuthority === DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY
    && sameRefSet(event.inputRefs, expectedInputs)
    && semanticHash('AuditEvent', auditPayload(event)) === event.eventHash;
}

export function reconstructHistoricalDecisionBasisWithPublicationAudit(input = {}) {
  const basis = reconstructHistoricalDecisionBasis(input);
  const decisionResult = validateDecisionResult({
    ledger: input.ledger,
    decisionResultRef: input.decisionResultRef
  });
  const stored = decisionResult.semanticPayload;
  const actor = decisionResult.decisionResultPrincipal;
  const expectedInputs = decisionResultExactRefs(stored);
  const publicationAuditEvent = input.ledger.auditFor(decisionResult.record.ref).find((event) =>
    validPublicationAudit({
      event,
      record: decisionResult.record,
      stored,
      actor,
      expectedInputs
    }));

  if (!publicationAuditEvent) {
    throw new HistoricalDecisionBasisError(
      'HISTORICAL_BASIS_DECISION_RESULT_PUBLICATION_AUDIT_INVALID',
      'historical DecisionResult lacks a hash-valid exact publication AuditEvent matching frozen D06 authority closure'
    );
  }

  const publicationAuditClosure = {
    projectionClass: HISTORICAL_DECISION_BASIS_PUBLICATION_AUDIT_CLASS,
    decisionResultRef: decisionResult.record.ref,
    auditEvent: cloneCanonicalValue(publicationAuditEvent)
  };

  return deepFreeze({
    ...cloneCanonicalValue(basis),
    publicationAuditClosure: cloneCanonicalValue(publicationAuditClosure)
  });
}
