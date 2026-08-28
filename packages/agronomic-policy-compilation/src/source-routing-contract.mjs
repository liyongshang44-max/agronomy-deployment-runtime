import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION =
  'adr.agronomic-source-authority-routing.v1';
export const AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-source-authority-routing-compilation.v1';

export const AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SUBJECT_SCOPES = deepFreeze([
  'FIELD_OPERATION_OCCURRENCE'
]);
export const AGRONOMIC_SOURCE_AUTHORITY_ROUTING_PLANNING_ROLES = deepFreeze([
  'PLANNED_MANAGEMENT_GUIDANCE'
]);
export const AGRONOMIC_SOURCE_AUTHORITY_ROUTING_ACTUAL_OPERATION_ROLES = deepFreeze([
  'ACTUAL_FIELD_OPERATION_RECORD'
]);
export const AGRONOMIC_SOURCE_AUTHORITY_ROUTING_RELATIONS = deepFreeze([
  'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE'
]);

const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const REQUIRED_BINDING_ROLES = new Set([
  'PLANNING_ROUTING_ASSERTION',
  'ACTUAL_OPERATION_RECORD_SOURCE_IDENTITY'
]);

export class AgronomicSourceAuthorityRoutingCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicSourceAuthorityRoutingCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicSourceAuthorityRoutingCompilationError(
        'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_FIELD',
        `${name}.${key} is not part of the source-authority-routing contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  const ref = assertAuthorityRef(value);
  if (!kinds.has(ref.kind)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_AUTHORITY_REF',
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
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) =>
    authorityRef(value, `${name}[${index}]`, kinds));
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'DUPLICATE_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'DUPLICATE_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function normalizeTemporalScope(value) {
  exactObject(value, 'routing.temporalScope', new Set(['kind', 'year']));
  if (value.kind !== 'CALENDAR_YEAR') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_TEMPORAL_SCOPE',
      'v1 source-authority routing requires CALENDAR_YEAR temporal scope'
    );
  }
  if (!Number.isInteger(value.year) || value.year < 1 || value.year > 9999) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_YEAR',
      'routing.temporalScope.year must be an integer from 1 through 9999'
    );
  }
  return deepFreeze({ kind: 'CALENDAR_YEAR', year: value.year });
}

function normalizeBinding(value, index) {
  const name = `routing.authorityBindings[${index}]`;
  exactObject(value, name, new Set(['role', 'authorityRef', 'rationale']));
  const role = requiredText(value.role, `${name}.role`);
  if (!REQUIRED_BINDING_ROLES.has(role)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_BINDING_ROLE',
      `unsupported source-authority-routing binding role ${role}`
    );
  }
  return deepFreeze({
    role,
    authorityRef: authorityRef(value.authorityRef, `${name}.authorityRef`, KNOWLEDGE_KINDS),
    rationale: requiredText(value.rationale, `${name}.rationale`)
  });
}

function normalizeBindings(values) {
  if (!Array.isArray(values)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_INPUT',
      'routing.authorityBindings must be an array'
    );
  }
  const normalized = values.map(normalizeBinding);
  const roles = normalized.map((binding) => binding.role).sort();
  if (normalized.length !== 2
    || JSON.stringify(roles)
      !== JSON.stringify([...REQUIRED_BINDING_ROLES].sort())) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_BINDING_SHAPE_MISMATCH',
      'v1 requires exactly one planning-routing and one actual-record-source identity binding'
    );
  }
  if (new Set(normalized.map((binding) => refKey(binding.authorityRef))).size !== 2) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_DISTINCT_KNOWLEDGE_REQUIRED',
      'planning and actual-operation record roles require distinct exact knowledge authorities'
    );
  }
  return deepFreeze([...normalized].sort((a, b) => a.role.localeCompare(b.role)));
}

export function normalizeAgronomicSourceAuthorityRouting(value) {
  exactObject(value, 'AgronomicSourceAuthorityRouting', new Set([
    'contractVersion',
    'routingId',
    'sourceExpression',
    'actualOperationRecordSourceExpression',
    'planningSourceRef',
    'actualOperationRecordSourceRef',
    'subjectScope',
    'planningRole',
    'actualOperationRole',
    'routingRelation',
    'temporalScope',
    'authorityBindings',
    'transformationRationale'
  ]));
  if (requiredText(value.contractVersion, 'routing.contractVersion')
    !== AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'UNSUPPORTED_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT',
      'unsupported agronomic source-authority-routing contractVersion'
    );
  }

  const planningSourceRef = authorityRef(
    value.planningSourceRef,
    'routing.planningSourceRef',
    new Set(['Source'])
  );
  const actualOperationRecordSourceRef = authorityRef(
    value.actualOperationRecordSourceRef,
    'routing.actualOperationRecordSourceRef',
    new Set(['Source'])
  );
  if (refKey(planningSourceRef) === refKey(actualOperationRecordSourceRef)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_DISTINCT_SOURCES_REQUIRED',
      'planning and actual-operation record sources must remain distinct exact Source authorities'
    );
  }

  if (value.subjectScope !== 'FIELD_OPERATION_OCCURRENCE') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SUBJECT_SCOPE',
      'v1 source-authority routing requires FIELD_OPERATION_OCCURRENCE subject scope'
    );
  }
  if (value.planningRole !== 'PLANNED_MANAGEMENT_GUIDANCE') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_PLANNING_ROLE',
      'v1 requires PLANNED_MANAGEMENT_GUIDANCE planning role'
    );
  }
  if (value.actualOperationRole !== 'ACTUAL_FIELD_OPERATION_RECORD') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_ACTUAL_ROLE',
      'v1 requires ACTUAL_FIELD_OPERATION_RECORD actual-operation role'
    );
  }
  if (value.routingRelation !== 'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_RELATION',
      'v1 requires ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE routing relation'
    );
  }

  return deepFreeze({
    contractVersion: AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION,
    routingId: requiredText(value.routingId, 'routing.routingId'),
    sourceExpression: requiredText(value.sourceExpression, 'routing.sourceExpression'),
    actualOperationRecordSourceExpression: requiredText(
      value.actualOperationRecordSourceExpression,
      'routing.actualOperationRecordSourceExpression'
    ),
    planningSourceRef,
    actualOperationRecordSourceRef,
    subjectScope: 'FIELD_OPERATION_OCCURRENCE',
    planningRole: 'PLANNED_MANAGEMENT_GUIDANCE',
    actualOperationRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    routingRelation: 'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE',
    temporalScope: normalizeTemporalScope(value.temporalScope),
    authorityBindings: normalizeBindings(value.authorityBindings),
    transformationRationale: requiredText(
      value.transformationRationale,
      'routing.transformationRationale'
    )
  });
}

export function agronomicSourceAuthorityRoutingHash(value) {
  return semanticHash(
    'AgronomicSourceAuthorityRouting',
    normalizeAgronomicSourceAuthorityRouting(value)
  );
}

export function normalizeAgronomicSourceAuthorityRoutingCompilation(value) {
  exactObject(value, 'AgronomicSourceAuthorityRoutingCompilation', new Set([
    'contractVersion',
    'authorityClass',
    'planningSourceArtifactRefs',
    'actualOperationRecordSourceArtifactRefs',
    'planningKnowledgeRefs',
    'actualOperationRecordKnowledgeRefs',
    'routing',
    'routingHash',
    'semanticReviewRef',
    'losslessCoverage',
    'limitations'
  ]));
  if (requiredText(value.contractVersion, 'contractVersion')
    !== AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'UNSUPPORTED_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT',
      'unsupported agronomic source-authority-routing compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_AUTHORITY') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_AUTHORITY'
    );
  }

  const routing = normalizeAgronomicSourceAuthorityRouting(value.routing);
  const planningSourceArtifactRefs = refList(
    value.planningSourceArtifactRefs,
    'planningSourceArtifactRefs',
    new Set(['SourceArtifact']),
    { nonEmpty: true }
  );
  const actualOperationRecordSourceArtifactRefs = refList(
    value.actualOperationRecordSourceArtifactRefs,
    'actualOperationRecordSourceArtifactRefs',
    new Set(['SourceArtifact']),
    { nonEmpty: true }
  );
  const planningKnowledgeRefs = refList(
    value.planningKnowledgeRefs,
    'planningKnowledgeRefs',
    KNOWLEDGE_KINDS,
    { nonEmpty: true }
  );
  const actualOperationRecordKnowledgeRefs = refList(
    value.actualOperationRecordKnowledgeRefs,
    'actualOperationRecordKnowledgeRefs',
    KNOWLEDGE_KINDS,
    { nonEmpty: true }
  );
  const routingHash = requiredText(value.routingHash, 'routingHash');
  const expectedHash = agronomicSourceAuthorityRoutingHash(routing);
  if (!HASH_RE.test(routingHash) || routingHash !== expectedHash) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_HASH_MISMATCH',
      'routingHash must exactly match the normalized source-authority routing'
    );
  }
  const semanticReviewRef = authorityRef(
    value.semanticReviewRef,
    'semanticReviewRef',
    new Set(['AgronomicSourceAuthorityRoutingReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(
    value.losslessCoverage.coveredElements ?? [],
    'losslessCoverage.coveredElements'
  );
  const unrepresentedElements = stringList(
    value.losslessCoverage.unrepresentedElements ?? [],
    'losslessCoverage.unrepresentedElements'
  );
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COVERAGE',
      'COMPLETE routing coverage cannot declare targeted unrepresented elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COVERAGE',
      'INCOMPLETE routing coverage must name at least one targeted unrepresented element'
    );
  }

  return deepFreeze({
    contractVersion: AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_AUTHORITY',
    planningSourceArtifactRefs,
    actualOperationRecordSourceArtifactRefs,
    planningKnowledgeRefs,
    actualOperationRecordKnowledgeRefs,
    routing,
    routingHash,
    semanticReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicSourceAuthorityRoutingCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicSourceAuthorityRoutingCompilation(value);
  return deepFreeze([
    normalized.routing.planningSourceRef,
    normalized.routing.actualOperationRecordSourceRef,
    ...normalized.planningSourceArtifactRefs,
    ...normalized.actualOperationRecordSourceArtifactRefs,
    ...normalized.planningKnowledgeRefs,
    ...normalized.actualOperationRecordKnowledgeRefs,
    normalized.semanticReviewRef
  ]);
}
