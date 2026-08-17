import {
  canonicalizeSemanticJson,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizeMaterialActionSignature } from '../../decision-robustness/src/index.mjs';

export const DECISION_RESULT_CONTRACT_VERSION = 'adr.decision-result.v1';
export const DECISION_RESULT_AUTHORITY_CLASS = 'STRUCTURED_DECISION_AUTHORITY';
export const DECISION_DISPOSITIONS = deepFreeze(['ACT', 'WAIT', 'ASK', 'ABSTAIN']);
export const DECISION_RESULT_AUTHORITY_MODES = deepFreeze(['ADR_POLICY', 'EXTERNAL_POLICY']);
export const DECISION_RESULT_WAIT_MODE = 'REEVALUATE_ON_NEW_DECISION_MATERIAL_EVIDENCE_OR_DEADLINE';
export const DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY = 'NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY';
export const DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY = 'NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY';

const DISPOSITIONS = new Set(DECISION_DISPOSITIONS);
const AUTHORITY_MODES = new Set(DECISION_RESULT_AUTHORITY_MODES);
const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const RESULT_KEYS = new Set([
  'contractVersion', 'authorityClass', 'decisionProblemRef', 'decisionAuthority',
  'decisionDisposition', 'structuredAction', 'waitSemantics', 'informationRequirementRefs',
  'abstentionReasonAuthority', 'humanGate', 'policyResultRefs', 'decisionRobustnessRef',
  'runtimeAlternativeSetRef', 'runtimeBindingRefs', 'decidedAt',
  'humanApprovalAuthority', 'machineExecutionAuthority'
]);
const AUTHORITY_KEYS = new Set(['mode', 'authorityRef']);
const WAIT_KEYS = new Set(['mode', 'decisionDeadline', 'basis', 'decisionRobustnessRef', 'policyRef']);
const INFO_REF_KEYS = new Set(['requirementId', 'semanticHash']);
const ABSTAIN_KEYS = new Set(['decisionRobustnessRef', 'policyRef', 'reasonCodes']);
const HUMAN_GATE_KEYS = new Set(['mode', 'policyRef']);
const POLICY_RESULT_REF_KEYS = new Set([
  'decisionRobustnessRef', 'pathId', 'runtimeBindingRef', 'policyRef',
  'executionEvidenceHash', 'materialActionSignatureHash', 'policyResultHash'
]);

export class DecisionResultError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DecisionResultError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new DecisionResultError('INVALID_DECISION_RESULT_FIELD', `${name}.${key} is outside the frozen D06 contract`);
    }
  }
}

function exactRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_REF', `${name} must be exact ${kind}`);
  }
  return ref;
}

function hash(value, name) {
  const normalized = text(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_HASH', `${name} must be sha256:<64 lowercase hex>`);
  }
  return normalized;
}

function strings(values, name, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`);
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new DecisionResultError('DUPLICATE_DECISION_RESULT_VALUE', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...normalized].sort());
}

function refs(values, kind, name, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`);
  }
  const normalized = values.map((value, index) => exactRef(value, kind, `${name}[${index}]`));
  const keys = normalized.map((ref) => canonicalizeSemanticJson(ref));
  if (new Set(keys).size !== keys.length) {
    throw new DecisionResultError('DUPLICATE_DECISION_RESULT_REF', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...normalized].sort((a, b) =>
    canonicalizeSemanticJson(a).localeCompare(canonicalizeSemanticJson(b))));
}

function timestamp(value, name) {
  const normalized = text(value, name);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_TIME', `${name} must be an explicit offset-aware timestamp`);
  }
  return new Date(normalized).toISOString();
}

function normalizeDecisionAuthority(value) {
  exactObject(value, 'decisionAuthority', AUTHORITY_KEYS);
  const mode = text(value.mode, 'decisionAuthority.mode');
  if (!AUTHORITY_MODES.has(mode)) {
    throw new DecisionResultError('DECISION_RESULT_AUTHORITY_MODE_FORBIDDEN', `DecisionResult cannot be published under ${mode}`);
  }
  const authorityRef = assertAuthorityRef(value.authorityRef);
  if (!['Policy', 'DecisionRobustness'].includes(authorityRef.kind)) {
    throw new DecisionResultError(
      'INVALID_DECISION_RESULT_AUTHORITY_REF',
      'decisionAuthority.authorityRef must be exact Policy or DecisionRobustness authority'
    );
  }
  if (mode === 'EXTERNAL_POLICY' && authorityRef.kind !== 'Policy') {
    throw new DecisionResultError(
      'EXTERNAL_POLICY_AUTHORITY_REF_REQUIRED',
      'EXTERNAL_POLICY DecisionResult requires an exact authorized Policy authority ref'
    );
  }
  return deepFreeze({ mode, authorityRef });
}

function normalizeWait(value) {
  if (value === null) return null;
  exactObject(value, 'waitSemantics', WAIT_KEYS);
  if (value.mode !== DECISION_RESULT_WAIT_MODE) {
    throw new DecisionResultError('INVALID_DECISION_WAIT_SEMANTICS', 'WAIT must use the frozen D06 reevaluation mode');
  }
  const basis = text(value.basis, 'waitSemantics.basis');
  if (basis !== 'POLICY_FALLBACK_WAIT') {
    throw new DecisionResultError('INVALID_DECISION_WAIT_BASIS', `unsupported WAIT basis ${basis}`);
  }
  return deepFreeze({
    mode: DECISION_RESULT_WAIT_MODE,
    decisionDeadline: timestamp(value.decisionDeadline, 'waitSemantics.decisionDeadline'),
    basis,
    decisionRobustnessRef: exactRef(value.decisionRobustnessRef, 'DecisionRobustness', 'waitSemantics.decisionRobustnessRef'),
    policyRef: exactRef(value.policyRef, 'Policy', 'waitSemantics.policyRef')
  });
}

function normalizeInformationRefs(values) {
  if (!Array.isArray(values)) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', 'informationRequirementRefs must be an array');
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `informationRequirementRefs[${index}]`, INFO_REF_KEYS);
    const requirementId = text(value.requirementId, `informationRequirementRefs[${index}].requirementId`);
    const semanticHashValue = hash(value.semanticHash, `informationRequirementRefs[${index}].semanticHash`);
    if (!/^ir:[0-9a-f]{24}$/.test(requirementId)) {
      throw new DecisionResultError('INVALID_INFORMATION_REQUIREMENT_REF', 'InformationRequirement ref requires frozen ir:<24hex> identity');
    }
    return deepFreeze({ requirementId, semanticHash: semanticHashValue });
  });
  const keys = normalized.map((item) => `${item.requirementId}:${item.semanticHash}`);
  if (new Set(keys).size !== keys.length) {
    throw new DecisionResultError('DUPLICATE_INFORMATION_REQUIREMENT_REF', 'informationRequirementRefs cannot contain duplicates');
  }
  return deepFreeze([...normalized].sort((a, b) => a.requirementId.localeCompare(b.requirementId)));
}

function normalizeAbstention(value) {
  if (value === null) return null;
  exactObject(value, 'abstentionReasonAuthority', ABSTAIN_KEYS);
  return deepFreeze({
    decisionRobustnessRef: exactRef(value.decisionRobustnessRef, 'DecisionRobustness', 'abstentionReasonAuthority.decisionRobustnessRef'),
    policyRef: value.policyRef === null ? null : exactRef(value.policyRef, 'Policy', 'abstentionReasonAuthority.policyRef'),
    reasonCodes: strings(value.reasonCodes, 'abstentionReasonAuthority.reasonCodes', { nonEmpty: true })
  });
}

function normalizeHumanGate(value) {
  if (value === null) return null;
  exactObject(value, 'humanGate', HUMAN_GATE_KEYS);
  const mode = text(value.mode, 'humanGate.mode');
  if (!['NONE', 'REQUIRED'].includes(mode)) {
    throw new DecisionResultError('INVALID_DECISION_HUMAN_GATE', `unsupported humanGate mode ${mode}`);
  }
  return deepFreeze({ mode, policyRef: exactRef(value.policyRef, 'Policy', 'humanGate.policyRef') });
}

function policyResultCore(value) {
  return {
    decisionRobustnessRef: value.decisionRobustnessRef,
    pathId: value.pathId,
    runtimeBindingRef: value.runtimeBindingRef,
    policyRef: value.policyRef,
    executionEvidenceHash: value.executionEvidenceHash,
    materialActionSignatureHash: value.materialActionSignatureHash
  };
}

function normalizePolicyResultRef(value, index) {
  exactObject(value, `policyResultRefs[${index}]`, POLICY_RESULT_REF_KEYS);
  const normalized = {
    decisionRobustnessRef: exactRef(value.decisionRobustnessRef, 'DecisionRobustness', `policyResultRefs[${index}].decisionRobustnessRef`),
    pathId: text(value.pathId, `policyResultRefs[${index}].pathId`),
    runtimeBindingRef: exactRef(value.runtimeBindingRef, 'RuntimeBinding', `policyResultRefs[${index}].runtimeBindingRef`),
    policyRef: exactRef(value.policyRef, 'Policy', `policyResultRefs[${index}].policyRef`),
    executionEvidenceHash: hash(value.executionEvidenceHash, `policyResultRefs[${index}].executionEvidenceHash`),
    materialActionSignatureHash: value.materialActionSignatureHash === null
      ? null
      : hash(value.materialActionSignatureHash, `policyResultRefs[${index}].materialActionSignatureHash`)
  };
  const expected = semanticHash('PolicyResultReference', policyResultCore(normalized));
  if (hash(value.policyResultHash, `policyResultRefs[${index}].policyResultHash`) !== expected) {
    throw new DecisionResultError(
      'POLICY_RESULT_REF_HASH_MISMATCH',
      'policyResultHash must reproduce exact DecisionRobustness action-evaluation identity'
    );
  }
  return deepFreeze({ ...normalized, policyResultHash: expected });
}

function normalizePolicyResultRefs(values) {
  if (!Array.isArray(values)) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', 'policyResultRefs must be an array');
  }
  const normalized = values.map(normalizePolicyResultRef);
  const hashes = normalized.map((item) => item.policyResultHash);
  if (new Set(hashes).size !== hashes.length) {
    throw new DecisionResultError('DUPLICATE_POLICY_RESULT_REF', 'policyResultRefs cannot contain duplicates');
  }
  return deepFreeze([...normalized].sort((a, b) => a.pathId.localeCompare(b.pathId)));
}

function exactBindingMember(runtimeBindingRefs, expected) {
  return runtimeBindingRefs.some((ref) => sameAuthorityRef(ref, expected));
}

function decisionPolicyRef(decisionAuthority) {
  return decisionAuthority.authorityRef.kind === 'Policy' ? decisionAuthority.authorityRef : null;
}

function assertTopLevelRelations({
  decisionAuthority,
  decisionDisposition,
  structuredAction,
  waitSemantics,
  abstentionReasonAuthority,
  humanGate,
  policyResultRefs,
  runtimeBindingRefs,
  decisionRobustnessRef
}) {
  const policyRef = decisionPolicyRef(decisionAuthority);
  if (decisionAuthority.authorityRef.kind === 'DecisionRobustness'
    && !sameAuthorityRef(decisionAuthority.authorityRef, decisionRobustnessRef)) {
    throw new DecisionResultError(
      'DECISION_RESULT_ROBUSTNESS_AUTHORITY_MISMATCH',
      'DecisionRobustness decision authority must equal the exact top-level DecisionRobustness ref'
    );
  }
  if (policyRef) {
    if (!humanGate || !sameAuthorityRef(humanGate.policyRef, policyRef)) {
      throw new DecisionResultError(
        'DECISION_RESULT_HUMAN_GATE_POLICY_MISMATCH',
        'Policy-authorized DecisionResult must preserve the exact Policy humanGate'
      );
    }
  } else if (humanGate !== null || policyResultRefs.length !== 0) {
    throw new DecisionResultError(
      'DECISION_RESULT_POLICY_EVIDENCE_WITHOUT_POLICY_AUTHORITY',
      'DecisionRobustness-authorized ASK/ABSTAIN cannot fabricate Policy humanGate or Policy-result refs'
    );
  }
  if (decisionDisposition === 'ACT') {
    if (!policyRef || !sameAuthorityRef(structuredAction.policyRef, policyRef)) {
      throw new DecisionResultError(
        'DECISION_RESULT_ACTION_POLICY_MISMATCH',
        'ACT requires exact Policy decision authority and MaterialActionSignature from that Policy'
      );
    }
  }
  if (waitSemantics && (!policyRef
    || !sameAuthorityRef(waitSemantics.policyRef, policyRef)
    || !sameAuthorityRef(waitSemantics.decisionRobustnessRef, decisionRobustnessRef))) {
    throw new DecisionResultError(
      'DECISION_RESULT_WAIT_AUTHORITY_MISMATCH',
      'WAIT semantics must bind exact Policy decision authority and DecisionRobustness'
    );
  }
  if (abstentionReasonAuthority) {
    if (!sameAuthorityRef(abstentionReasonAuthority.decisionRobustnessRef, decisionRobustnessRef)
      || (policyRef && (!abstentionReasonAuthority.policyRef || !sameAuthorityRef(abstentionReasonAuthority.policyRef, policyRef)))
      || (!policyRef && abstentionReasonAuthority.policyRef !== null)) {
      throw new DecisionResultError(
        'DECISION_RESULT_ABSTAIN_AUTHORITY_MISMATCH',
        'ABSTAIN reason authority must preserve exact DecisionRobustness and optional exact decision Policy'
      );
    }
  }
  for (const resultRef of policyResultRefs) {
    if (!policyRef
      || !sameAuthorityRef(resultRef.decisionRobustnessRef, decisionRobustnessRef)
      || !sameAuthorityRef(resultRef.policyRef, policyRef)
      || !exactBindingMember(runtimeBindingRefs, resultRef.runtimeBindingRef)) {
      throw new DecisionResultError(
        'DECISION_RESULT_POLICY_RESULT_RELATION_MISMATCH',
        'each Policy-result ref must point into the exact DecisionRobustness, decision Policy, and retained RuntimeBinding universe'
      );
    }
  }
  if (decisionDisposition === 'ACT' && policyResultRefs.length === 0) {
    throw new DecisionResultError(
      'DECISION_RESULT_ACT_POLICY_RESULT_REQUIRED',
      'ACT requires at least one exact Policy-result reference from DecisionRobustness evidence'
    );
  }
  if (['ACT', 'WAIT'].includes(decisionDisposition) && !policyRef) {
    throw new DecisionResultError(
      'DECISION_RESULT_POLICY_AUTHORITY_REQUIRED',
      `${decisionDisposition} requires exact Policy decision authority`
    );
  }
}

export function normalizeDecisionResult(value) {
  exactObject(value, 'DecisionResult', RESULT_KEYS);
  if (value.contractVersion !== DECISION_RESULT_CONTRACT_VERSION) {
    throw new DecisionResultError('UNSUPPORTED_DECISION_RESULT_CONTRACT', `unsupported contractVersion ${value.contractVersion}`);
  }
  if (value.authorityClass !== DECISION_RESULT_AUTHORITY_CLASS) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_AUTHORITY_CLASS', 'DecisionResult authority class mismatch');
  }
  const decisionDisposition = text(value.decisionDisposition, 'decisionDisposition');
  if (!DISPOSITIONS.has(decisionDisposition)) {
    throw new DecisionResultError('INVALID_DECISION_DISPOSITION', `unsupported disposition ${decisionDisposition}`);
  }
  const decisionRobustnessRef = exactRef(value.decisionRobustnessRef, 'DecisionRobustness', 'decisionRobustnessRef');
  const runtimeAlternativeSetRef = exactRef(value.runtimeAlternativeSetRef, 'RuntimeAlternativeSet', 'runtimeAlternativeSetRef');
  const decisionAuthority = normalizeDecisionAuthority(value.decisionAuthority);
  const structuredAction = value.structuredAction === null ? null : normalizeMaterialActionSignature(value.structuredAction);
  const waitSemantics = normalizeWait(value.waitSemantics);
  const informationRequirementRefs = normalizeInformationRefs(value.informationRequirementRefs);
  const abstentionReasonAuthority = normalizeAbstention(value.abstentionReasonAuthority);
  const humanGate = normalizeHumanGate(value.humanGate);
  const policyResultRefs = normalizePolicyResultRefs(value.policyResultRefs);
  const runtimeBindingRefs = refs(value.runtimeBindingRefs, 'RuntimeBinding', 'runtimeBindingRefs');

  if (decisionDisposition === 'ACT') {
    if (!structuredAction || waitSemantics !== null || informationRequirementRefs.length !== 0 || abstentionReasonAuthority !== null) {
      throw new DecisionResultError('INVALID_ACT_DECISION_RESULT', 'ACT requires only structured material action semantics');
    }
  } else if (decisionDisposition === 'WAIT') {
    if (structuredAction !== null || waitSemantics === null || informationRequirementRefs.length !== 0 || abstentionReasonAuthority !== null) {
      throw new DecisionResultError('INVALID_WAIT_DECISION_RESULT', 'WAIT requires governed reevaluation semantics only');
    }
  } else if (decisionDisposition === 'ASK') {
    if (structuredAction !== null || waitSemantics !== null || informationRequirementRefs.length === 0 || abstentionReasonAuthority !== null) {
      throw new DecisionResultError('INVALID_ASK_DECISION_RESULT', 'ASK requires exact decision-material InformationRequirement refs only');
    }
  } else if (structuredAction !== null || waitSemantics !== null || informationRequirementRefs.length !== 0 || abstentionReasonAuthority === null) {
    throw new DecisionResultError('INVALID_ABSTAIN_DECISION_RESULT', 'ABSTAIN requires governed abstention reason authority only');
  }

  assertTopLevelRelations({
    decisionAuthority,
    decisionDisposition,
    structuredAction,
    waitSemantics,
    abstentionReasonAuthority,
    humanGate,
    policyResultRefs,
    runtimeBindingRefs,
    decisionRobustnessRef
  });

  if (value.humanApprovalAuthority !== DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY
    || value.machineExecutionAuthority !== DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY) {
    throw new DecisionResultError(
      'DECISION_RESULT_DOWNSTREAM_AUTHORITY_LAUNDERING',
      'DecisionResult is neither human approval nor machine execution authority'
    );
  }
  return deepFreeze({
    contractVersion: DECISION_RESULT_CONTRACT_VERSION,
    authorityClass: DECISION_RESULT_AUTHORITY_CLASS,
    decisionProblemRef: exactRef(value.decisionProblemRef, 'DecisionProblem', 'decisionProblemRef'),
    decisionAuthority,
    decisionDisposition,
    structuredAction,
    waitSemantics,
    informationRequirementRefs,
    abstentionReasonAuthority,
    humanGate,
    policyResultRefs,
    decisionRobustnessRef,
    runtimeAlternativeSetRef,
    runtimeBindingRefs,
    decidedAt: timestamp(value.decidedAt, 'decidedAt'),
    humanApprovalAuthority: DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY,
    machineExecutionAuthority: DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY
  });
}

export function decisionResultExactRefs(payload) {
  const normalized = normalizeDecisionResult(payload);
  const values = [
    normalized.decisionProblemRef,
    normalized.decisionAuthority.authorityRef,
    normalized.decisionRobustnessRef,
    normalized.runtimeAlternativeSetRef,
    ...normalized.runtimeBindingRefs,
    ...normalized.policyResultRefs.flatMap((item) => [item.runtimeBindingRef, item.policyRef])
  ];
  if (normalized.humanGate) values.push(normalized.humanGate.policyRef);
  if (normalized.waitSemantics) {
    values.push(normalized.waitSemantics.policyRef, normalized.waitSemantics.decisionRobustnessRef);
  }
  if (normalized.abstentionReasonAuthority) {
    values.push(normalized.abstentionReasonAuthority.decisionRobustnessRef);
    if (normalized.abstentionReasonAuthority.policyRef) values.push(normalized.abstentionReasonAuthority.policyRef);
  }
  const map = new Map(values.map((ref) => [canonicalizeSemanticJson(ref), ref]));
  return deepFreeze([...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}

export function decisionResultSemanticHash(value) {
  return semanticHash('DecisionResult', normalizeDecisionResult(value));
}
