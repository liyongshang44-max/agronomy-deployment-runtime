import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION = 'adr.agronomic-policy-obligation.v1';
export const AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION = 'adr.agronomic-policy-obligation-compilation.v1';
export const AGRONOMIC_POLICY_OBLIGATION_EFFECTS = deepFreeze(['REQUIRE']);
export const AGRONOMIC_POLICY_OBLIGATION_OCCURRENCE_MODES = deepFreeze(['EXACT_COUNT', 'BOUNDED_COUNT']);
export const AGRONOMIC_POLICY_OBLIGATION_PERIOD_KINDS = deepFreeze(['FIXED_CALENDAR_YEAR', 'EACH_CALENDAR_YEAR']);

const EFFECTS = new Set(AGRONOMIC_POLICY_OBLIGATION_EFFECTS);
const OCCURRENCE_MODES = new Set(AGRONOMIC_POLICY_OBLIGATION_OCCURRENCE_MODES);
const PERIOD_KINDS = new Set(AGRONOMIC_POLICY_OBLIGATION_PERIOD_KINDS);
const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicPolicyObligationCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicPolicyObligationCompilationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicPolicyObligationCompilationError(
        'INVALID_AGRONOMIC_POLICY_OBLIGATION_FIELD',
        `${name}.${key} is not part of the obligation contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  const ref = assertAuthorityRef(value);
  if (!kinds.has(ref.kind)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function refList(values, name, kinds, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) => authorityRef(value, `${name}[${index}]`, kinds));
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicPolicyObligationCompilationError(
      'DUPLICATE_AGRONOMIC_POLICY_OBLIGATION_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicPolicyObligationCompilationError(
      'DUPLICATE_AGRONOMIC_POLICY_OBLIGATION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_COUNT',
      `${name} must be a positive safe integer`
    );
  }
  return value;
}

function authorityBinding(value, name) {
  exactObject(value, name, new Set(['role', 'authorityRef', 'rationale']));
  return deepFreeze({
    role: text(value.role, `${name}.role`),
    authorityRef: authorityRef(value.authorityRef, `${name}.authorityRef`, KNOWLEDGE_KINDS),
    rationale: text(value.rationale, `${name}.rationale`)
  });
}

function authorityBindings(values, name, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_INPUT',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  return deepFreeze(values.map((value, index) => authorityBinding(value, `${name}[${index}]`)));
}

function normalizePeriod(value) {
  exactObject(value, 'obligation.occurrence.period', new Set(['kind', 'year', 'authorityBindings']));
  const kind = text(value.kind, 'obligation.occurrence.period.kind');
  if (!PERIOD_KINDS.has(kind)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_PERIOD',
      `unsupported obligation period kind ${kind}`
    );
  }
  if (kind === 'FIXED_CALENDAR_YEAR') {
    if (!Number.isSafeInteger(value.year) || value.year < 1000 || value.year > 9999) {
      throw new AgronomicPolicyObligationCompilationError(
        'INVALID_AGRONOMIC_POLICY_OBLIGATION_PERIOD',
        'FIXED_CALENDAR_YEAR requires a four-digit integer year'
      );
    }
  } else if (value.year !== undefined) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_PERIOD',
      'EACH_CALENDAR_YEAR forbids a fixed year value'
    );
  }
  return deepFreeze({
    kind,
    ...(kind === 'FIXED_CALENDAR_YEAR' ? { year: value.year } : {}),
    authorityBindings: authorityBindings(
      value.authorityBindings,
      'obligation.occurrence.period.authorityBindings',
      { nonEmpty: true }
    )
  });
}

function normalizeOccurrence(value) {
  exactObject(value, 'obligation.occurrence', new Set([
    'mode', 'exactCount', 'minCount', 'maxCount', 'period', 'authorityBindings'
  ]));
  const mode = text(value.mode, 'obligation.occurrence.mode');
  if (!OCCURRENCE_MODES.has(mode)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_OCCURRENCE',
      `unsupported occurrence mode ${mode}`
    );
  }
  const normalized = {
    mode,
    period: normalizePeriod(value.period),
    authorityBindings: authorityBindings(
      value.authorityBindings,
      'obligation.occurrence.authorityBindings',
      { nonEmpty: true }
    )
  };
  if (mode === 'EXACT_COUNT') {
    if (value.minCount !== undefined || value.maxCount !== undefined) {
      throw new AgronomicPolicyObligationCompilationError(
        'INVALID_AGRONOMIC_POLICY_OBLIGATION_OCCURRENCE',
        'EXACT_COUNT forbids minCount/maxCount'
      );
    }
    normalized.exactCount = positiveInteger(value.exactCount, 'obligation.occurrence.exactCount');
  } else {
    if (value.exactCount !== undefined) {
      throw new AgronomicPolicyObligationCompilationError(
        'INVALID_AGRONOMIC_POLICY_OBLIGATION_OCCURRENCE',
        'BOUNDED_COUNT forbids exactCount'
      );
    }
    normalized.minCount = positiveInteger(value.minCount, 'obligation.occurrence.minCount');
    normalized.maxCount = positiveInteger(value.maxCount, 'obligation.occurrence.maxCount');
    if (normalized.minCount > normalized.maxCount) {
      throw new AgronomicPolicyObligationCompilationError(
        'INVALID_AGRONOMIC_POLICY_OBLIGATION_OCCURRENCE',
        'BOUNDED_COUNT requires minCount <= maxCount'
      );
    }
  }
  return deepFreeze(normalized);
}

export function normalizeAgronomicPolicyObligation(value) {
  exactObject(value, 'AgronomicPolicyObligation', new Set([
    'contractVersion', 'obligationId', 'decisionType', 'effect', 'actionCode',
    'occurrence', 'authorityBindings'
  ]));
  if (text(value.contractVersion, 'obligation.contractVersion') !== AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION) {
    throw new AgronomicPolicyObligationCompilationError(
      'UNSUPPORTED_AGRONOMIC_POLICY_OBLIGATION_CONTRACT',
      'unsupported agronomic policy obligation contractVersion'
    );
  }
  const effect = text(value.effect, 'obligation.effect');
  if (!EFFECTS.has(effect)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_EFFECT',
      `unsupported obligation effect ${effect}`
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
    obligationId: text(value.obligationId, 'obligation.obligationId'),
    decisionType: text(value.decisionType, 'obligation.decisionType'),
    effect,
    actionCode: text(value.actionCode, 'obligation.actionCode'),
    occurrence: normalizeOccurrence(value.occurrence),
    authorityBindings: authorityBindings(
      value.authorityBindings,
      'obligation.authorityBindings',
      { nonEmpty: true }
    )
  });
}

export function agronomicPolicyObligationHash(value) {
  return semanticHash('AgronomicPolicyObligation', normalizeAgronomicPolicyObligation(value));
}

export function normalizeAgronomicPolicyObligationCompilation(value) {
  exactObject(value, 'AgronomicPolicyObligationCompilation', new Set([
    'contractVersion', 'authorityClass', 'sourceProtocolRefs', 'sourceProtocolArtifactRefs',
    'knowledgeRefs', 'policyRef', 'obligation', 'obligationHash', 'transformationRationale',
    'losslessCoverage', 'approverPrincipal', 'approvalRef', 'limitations'
  ]));
  if (text(value.contractVersion, 'contractVersion') !== AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicPolicyObligationCompilationError(
      'UNSUPPORTED_AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT',
      'unsupported agronomic policy obligation compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY') {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY'
    );
  }
  const sourceProtocolRefs = refList(value.sourceProtocolRefs, 'sourceProtocolRefs', new Set(['Source']), { nonEmpty: true });
  const sourceProtocolArtifactRefs = refList(value.sourceProtocolArtifactRefs, 'sourceProtocolArtifactRefs', new Set(['SourceArtifact']), { nonEmpty: true });
  const knowledgeRefs = refList(value.knowledgeRefs, 'knowledgeRefs', KNOWLEDGE_KINDS, { nonEmpty: true });
  const policyRef = authorityRef(value.policyRef, 'policyRef', new Set(['Policy']));
  const obligation = normalizeAgronomicPolicyObligation(value.obligation);
  const obligationHash = text(value.obligationHash, 'obligationHash');
  const expectedHash = agronomicPolicyObligationHash(obligation);
  if (!HASH_RE.test(obligationHash) || obligationHash !== expectedHash) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_HASH_MISMATCH',
      'obligationHash must exactly match the normalized agronomic policy obligation'
    );
  }

  exactObject(value.losslessCoverage, 'losslessCoverage', new Set(['status', 'coveredElements', 'unrepresentedElements']));
  const status = text(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(value.losslessCoverage.coveredElements ?? [], 'losslessCoverage.coveredElements');
  const unrepresentedElements = stringList(value.losslessCoverage.unrepresentedElements ?? [], 'losslessCoverage.unrepresentedElements');
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_COVERAGE',
      'COMPLETE coverage cannot declare unrepresented elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_COVERAGE',
      'INCOMPLETE coverage must name at least one unrepresented element'
    );
  }

  exactObject(value.approverPrincipal, 'approverPrincipal', new Set([
    'principalId', 'type', 'organizationId', 'tenantId'
  ]));
  const approvalRef = authorityRef(value.approvalRef, 'approvalRef', new Set(['AuthorizationDecisionAudit']));

  return deepFreeze({
    contractVersion: AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs,
    sourceProtocolArtifactRefs,
    knowledgeRefs,
    policyRef,
    obligation,
    obligationHash,
    transformationRationale: text(value.transformationRationale, 'transformationRationale'),
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    approverPrincipal: deepFreeze({
      principalId: text(value.approverPrincipal.principalId, 'approverPrincipal.principalId'),
      type: text(value.approverPrincipal.type, 'approverPrincipal.type'),
      organizationId: text(value.approverPrincipal.organizationId, 'approverPrincipal.organizationId'),
      ...(value.approverPrincipal.tenantId
        ? { tenantId: text(value.approverPrincipal.tenantId, 'approverPrincipal.tenantId') }
        : {})
    }),
    approvalRef,
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicPolicyObligationCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicPolicyObligationCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.sourceProtocolArtifactRefs,
    ...normalized.knowledgeRefs,
    normalized.policyRef,
    normalized.approvalRef
  ]);
}
