import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION = 'adr.agronomic-action-regimen.v1';
export const AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION = 'adr.agronomic-action-regimen-compilation.v1';
export const AGRONOMIC_ACTION_REGIMEN_OCCURRENCE_MODES = deepFreeze(['SOURCE_STATED_BOUNDED_RANGE']);
export const AGRONOMIC_ACTION_REGIMEN_PERIOD_KINDS = deepFreeze(['EACH_CALENDAR_YEAR']);

const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const OCCURRENCE_MODES = new Set(AGRONOMIC_ACTION_REGIMEN_OCCURRENCE_MODES);
const PERIOD_KINDS = new Set(AGRONOMIC_ACTION_REGIMEN_PERIOD_KINDS);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicActionRegimenCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicActionRegimenCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicActionRegimenCompilationError(
        'INVALID_AGRONOMIC_ACTION_REGIMEN_FIELD',
        `${name}.${key} is not part of the action-regimen contract`
      );
    }
  }
}

function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_COUNT',
      `${name} must be a positive safe integer`
    );
  }
  return value;
}

function authorityRef(value, name, kinds) {
  const ref = assertAuthorityRef(value);
  if (!kinds.has(ref.kind)) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_AUTHORITY_REF',
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
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) => authorityRef(value, `${name}[${index}]`, kinds));
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicActionRegimenCompilationError(
      'DUPLICATE_AGRONOMIC_ACTION_REGIMEN_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicActionRegimenCompilationError(
      'DUPLICATE_AGRONOMIC_ACTION_REGIMEN_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function authorityBinding(value, name) {
  exactObject(value, name, new Set(['role', 'authorityRef', 'rationale']));
  return deepFreeze({
    role: requiredText(value.role, `${name}.role`),
    authorityRef: authorityRef(value.authorityRef, `${name}.authorityRef`, KNOWLEDGE_KINDS),
    rationale: requiredText(value.rationale, `${name}.rationale`)
  });
}

function authorityBindings(values, name) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_INPUT',
      `${name} must be a non-empty array`
    );
  }
  const normalized = values.map((value, index) => authorityBinding(value, `${name}[${index}]`));
  const keys = normalized.map((binding) => JSON.stringify([binding.role, refKey(binding.authorityRef), binding.rationale]));
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicActionRegimenCompilationError(
      'DUPLICATE_AGRONOMIC_ACTION_REGIMEN_BINDING',
      `${name} cannot contain duplicate bindings`
    );
  }
  return deepFreeze([...normalized].sort((a, b) =>
    JSON.stringify([a.role, refKey(a.authorityRef), a.rationale])
      .localeCompare(JSON.stringify([b.role, refKey(b.authorityRef), b.rationale]))
  ));
}

function normalizeOccurrenceDescriptor(value) {
  exactObject(value, 'regimen.occurrenceDescriptor', new Set(['mode', 'minCount', 'maxCount', 'period']));
  const mode = requiredText(value.mode, 'regimen.occurrenceDescriptor.mode');
  if (!OCCURRENCE_MODES.has(mode)) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_OCCURRENCE_MODE',
      `unsupported action-regimen occurrence mode ${mode}`
    );
  }
  const minCount = positiveSafeInteger(value.minCount, 'regimen.occurrenceDescriptor.minCount');
  const maxCount = positiveSafeInteger(value.maxCount, 'regimen.occurrenceDescriptor.maxCount');
  if (minCount > maxCount) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_COUNT_RANGE',
      'regimen.occurrenceDescriptor.minCount must be <= maxCount'
    );
  }
  exactObject(value.period, 'regimen.occurrenceDescriptor.period', new Set(['kind']));
  const kind = requiredText(value.period.kind, 'regimen.occurrenceDescriptor.period.kind');
  if (!PERIOD_KINDS.has(kind)) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_PERIOD',
      `unsupported action-regimen period kind ${kind}`
    );
  }
  return deepFreeze({
    mode,
    minCount,
    maxCount,
    period: deepFreeze({ kind })
  });
}

export function normalizeAgronomicActionRegimen(value) {
  exactObject(value, 'AgronomicActionRegimen', new Set([
    'contractVersion', 'regimenId', 'sourceExpression', 'actionCode',
    'occurrenceDescriptor', 'modalityCompilationRef', 'goalConditionCompilationRef',
    'authorityBindings', 'transformationRationale'
  ]));
  if (requiredText(value.contractVersion, 'regimen.contractVersion') !== AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION) {
    throw new AgronomicActionRegimenCompilationError(
      'UNSUPPORTED_AGRONOMIC_ACTION_REGIMEN_CONTRACT',
      'unsupported agronomic action-regimen contractVersion'
    );
  }
  const actionCode = requiredText(value.actionCode, 'regimen.actionCode');
  if (actionCode !== 'TILL') {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_ACTION',
      'DEC-0009 v1 accepts only the source-proven TILL action-regimen shape'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
    regimenId: requiredText(value.regimenId, 'regimen.regimenId'),
    sourceExpression: requiredText(value.sourceExpression, 'regimen.sourceExpression'),
    actionCode,
    occurrenceDescriptor: normalizeOccurrenceDescriptor(value.occurrenceDescriptor),
    modalityCompilationRef: authorityRef(
      value.modalityCompilationRef,
      'regimen.modalityCompilationRef',
      new Set(['AgronomicNormativeModalityCompilation'])
    ),
    goalConditionCompilationRef: authorityRef(
      value.goalConditionCompilationRef,
      'regimen.goalConditionCompilationRef',
      new Set(['AgronomicGoalConditionCompilation'])
    ),
    authorityBindings: authorityBindings(value.authorityBindings, 'regimen.authorityBindings'),
    transformationRationale: requiredText(value.transformationRationale, 'regimen.transformationRationale')
  });
}

export function agronomicActionRegimenHash(value) {
  return semanticHash('AgronomicActionRegimen', normalizeAgronomicActionRegimen(value));
}

export function normalizeAgronomicActionRegimenCompilation(value) {
  exactObject(value, 'AgronomicActionRegimenCompilation', new Set([
    'contractVersion', 'authorityClass', 'sourceProtocolRefs', 'sourceProtocolArtifactRefs',
    'knowledgeRefs', 'regimen', 'regimenHash', 'semanticReviewRef',
    'losslessCoverage', 'limitations'
  ]));
  if (requiredText(value.contractVersion, 'contractVersion') !== AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicActionRegimenCompilationError(
      'UNSUPPORTED_AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT',
      'unsupported agronomic action-regimen compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY') {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY'
    );
  }
  const sourceProtocolRefs = refList(value.sourceProtocolRefs, 'sourceProtocolRefs', new Set(['Source']), { nonEmpty: true });
  const sourceProtocolArtifactRefs = refList(value.sourceProtocolArtifactRefs, 'sourceProtocolArtifactRefs', new Set(['SourceArtifact']), { nonEmpty: true });
  const knowledgeRefs = refList(value.knowledgeRefs, 'knowledgeRefs', KNOWLEDGE_KINDS, { nonEmpty: true });
  const regimen = normalizeAgronomicActionRegimen(value.regimen);
  const regimenHash = requiredText(value.regimenHash, 'regimenHash');
  const expectedHash = agronomicActionRegimenHash(regimen);
  if (!HASH_RE.test(regimenHash) || regimenHash !== expectedHash) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_HASH_MISMATCH',
      'regimenHash must exactly match the normalized action regimen'
    );
  }
  const semanticReviewRef = authorityRef(
    value.semanticReviewRef,
    'semanticReviewRef',
    new Set(['AgronomicActionRegimenReviewDecision'])
  );

  exactObject(value.losslessCoverage, 'losslessCoverage', new Set(['status', 'coveredElements', 'unrepresentedElements']));
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(value.losslessCoverage.coveredElements ?? [], 'losslessCoverage.coveredElements');
  const unrepresentedElements = stringList(value.losslessCoverage.unrepresentedElements ?? [], 'losslessCoverage.unrepresentedElements');
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_COVERAGE',
      'COMPLETE action-regimen coverage cannot declare unrepresented regimen elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_COVERAGE',
      'INCOMPLETE action-regimen coverage must name at least one unrepresented regimen element'
    );
  }

  return deepFreeze({
    contractVersion: AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY',
    sourceProtocolRefs,
    sourceProtocolArtifactRefs,
    knowledgeRefs,
    regimen,
    regimenHash,
    semanticReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicActionRegimenCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicActionRegimenCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.sourceProtocolArtifactRefs,
    ...normalized.knowledgeRefs,
    normalized.regimen.modalityCompilationRef,
    normalized.regimen.goalConditionCompilationRef,
    normalized.semanticReviewRef
  ]);
}
