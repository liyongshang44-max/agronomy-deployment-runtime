import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { ApplicabilityError, APPLICABILITY_ASSESSMENT_CONTRACT_VERSION, APPLICABILITY_AUTHORITY_CLASS, normalizeApplicabilityAssessment } from './contract.mjs';

const SUPPORTED_TRANSPORT_CONSTRAINTS = new Set(['DECISION_TYPE_IN', 'CALIBRATION_REQUIRED', 'BOUNDED_EXTRAPOLATION']);
const SUPPORTED_MISMATCH_DISPOSITIONS = new Set(['CONFLICT', 'CALIBRATION_REQUIRED', 'BOUNDED_EXTRAPOLATION']);

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ApplicabilityError('INVALID_APPLICABILITY_INPUT', `${name} must be a non-empty string`);
  return value.trim();
}

function unwrapAggregated(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
      && 'qualificationDecisionRef' in entry && 'value' in entry
      ? entry.value
      : entry
  ));
}

function valueScalar(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object' || Array.isArray(value)) return value;
  switch (value.type) {
    case 'DECIMAL': return value.decimal;
    case 'INTEGER': return value.integer;
    case 'BOOLEAN': return value.boolean;
    case 'STRING': return value.string;
    case 'CATEGORY': return value.category;
    case 'DATE': return value.date;
    case 'TIMESTAMP': return value.timestamp;
    case 'UNKNOWN': return null;
    default: return cloneCanonicalValue(value);
  }
}

function canonicalEqual(left, right) {
  return semanticHash('A08-Canonical-Value', left) === semanticHash('A08-Canonical-Value', right);
}

function targetIndex(manifestAuthority) {
  const map = new Map();
  for (const validated of manifestAuthority.datums ?? []) {
    const payload = validated.semanticPayload ?? validated.record?.semanticPayload;
    if (!payload?.semanticId) continue;
    const values = map.get(payload.semanticId) ?? [];
    values.push(payload);
    map.set(payload.semanticId, values);
  }
  return map;
}

function normalizePredicate(raw, source) {
  const value = raw;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, code: `${source}_INVALID_OBJECT` };
  const allowed = source === 'EFFECT_MODIFIER'
    ? new Set(['semanticId', 'operator', 'value', 'unit', 'mismatchDisposition', 'code'])
    : new Set(['semanticId', 'operator', 'value', 'unit']);
  if (Object.keys(value).some((key) => !allowed.has(key))) return { valid: false, code: `${source}_UNSUPPORTED_SHAPE` };
  if (typeof value.semanticId !== 'string' || value.semanticId.trim() === '' || value.operator !== 'EQUALS') {
    return { valid: false, code: `${source}_UNSUPPORTED_PREDICATE` };
  }
  if (source === 'EFFECT_MODIFIER' && !SUPPORTED_MISMATCH_DISPOSITIONS.has(value.mismatchDisposition)) {
    return { valid: false, code: 'EFFECT_MODIFIER_MISMATCH_DISPOSITION_REQUIRED' };
  }
  return {
    valid: true,
    predicate: {
      source,
      semanticId: value.semanticId.trim(),
      operator: 'EQUALS',
      expected: cloneCanonicalValue(value.value),
      ...(value.unit ? { unit: text(value.unit, `${source}.unit`) } : {}),
      mismatchDisposition: source === 'EFFECT_MODIFIER' ? value.mismatchDisposition : 'CONFLICT',
      ...(source === 'EFFECT_MODIFIER' && value.code ? { code: text(value.code, 'EFFECT_MODIFIER.code') } : {})
    }
  };
}

function evaluatePredicate(predicate, targets) {
  const candidates = targets.get(predicate.semanticId) ?? [];
  if (candidates.length === 0) {
    return {
      result: deepFreeze({
        source: predicate.source,
        semanticId: predicate.semanticId,
        operator: predicate.operator,
        expected: predicate.expected,
        ...(predicate.unit ? { unit: predicate.unit } : {}),
        status: 'UNKNOWN',
        disposition: 'UNRESOLVED'
      }),
      disposition: 'UNRESOLVED',
      missing: predicate.semanticId
    };
  }
  if (candidates.length !== 1) {
    return {
      result: deepFreeze({
        source: predicate.source,
        semanticId: predicate.semanticId,
        operator: predicate.operator,
        expected: predicate.expected,
        status: 'AMBIGUOUS',
        disposition: 'UNRESOLVED'
      }),
      disposition: 'UNRESOLVED',
      missing: predicate.semanticId
    };
  }
  const target = candidates[0];
  const scalar = valueScalar(target.value);
  if (scalar === null || scalar === undefined) {
    return {
      result: deepFreeze({
        source: predicate.source,
        semanticId: predicate.semanticId,
        operator: predicate.operator,
        expected: predicate.expected,
        target: cloneCanonicalValue(target.value),
        status: 'UNKNOWN',
        disposition: 'UNRESOLVED'
      }),
      disposition: 'UNRESOLVED',
      missing: predicate.semanticId
    };
  }
  if (predicate.unit && predicate.unit !== target.unit) {
    return {
      result: deepFreeze({
        source: predicate.source,
        semanticId: predicate.semanticId,
        operator: predicate.operator,
        expected: predicate.expected,
        target: cloneCanonicalValue(target.value),
        unit: predicate.unit,
        status: 'INVALID',
        disposition: 'CONFLICT'
      }),
      disposition: 'CONFLICT',
      conflict: { code: 'MEASUREMENT_CONVENTION_MISMATCH', semanticId: predicate.semanticId, expectedUnit: predicate.unit, targetUnit: target.unit }
    };
  }
  const expectedScalar = valueScalar(predicate.expected);
  const matches = canonicalEqual(expectedScalar, scalar);
  const disposition = matches ? 'MATCH' : predicate.mismatchDisposition;
  return {
    result: deepFreeze({
      source: predicate.source,
      semanticId: predicate.semanticId,
      operator: predicate.operator,
      expected: cloneCanonicalValue(predicate.expected),
      target: cloneCanonicalValue(target.value),
      ...(predicate.unit ? { unit: predicate.unit } : {}),
      status: matches ? 'MATCH' : 'MISMATCH',
      disposition
    }),
    disposition,
    ...(matches ? {} : { conflict: { code: `${predicate.source}_MISMATCH`, semanticId: predicate.semanticId, disposition } })
  };
}

function evaluateTransportConstraints(rawConstraints, decisionProblem) {
  let decisionRelevance = 'MATERIAL';
  const calibrationCodes = [];
  const limitations = [];
  const unsupported = [];
  let bounded = false;
  for (const raw of rawConstraints) {
    const constraint = raw;
    if (!constraint || typeof constraint !== 'object' || Array.isArray(constraint) || typeof constraint.type !== 'string') {
      unsupported.push('TRANSPORT_CONSTRAINT_INVALID');
      continue;
    }
    if (!SUPPORTED_TRANSPORT_CONSTRAINTS.has(constraint.type)) {
      unsupported.push(`UNSUPPORTED_TRANSPORT_CONSTRAINT:${constraint.type}`);
      continue;
    }
    if (constraint.type === 'DECISION_TYPE_IN') {
      if (!Array.isArray(constraint.decisionTypes) || constraint.decisionTypes.length === 0
        || !constraint.decisionTypes.every((item) => typeof item === 'string' && item.trim())) {
        unsupported.push('DECISION_TYPE_IN_INVALID');
      } else if (!constraint.decisionTypes.includes(decisionProblem.decisionType)) {
        decisionRelevance = 'NOT_RELEVANT';
      }
    } else if (constraint.type === 'CALIBRATION_REQUIRED') {
      if (typeof constraint.code !== 'string' || !constraint.code.trim()) unsupported.push('CALIBRATION_REQUIRED_INVALID');
      else calibrationCodes.push(constraint.code.trim());
    } else if (constraint.type === 'BOUNDED_EXTRAPOLATION') {
      if (typeof constraint.code !== 'string' || !constraint.code.trim()) unsupported.push('BOUNDED_EXTRAPOLATION_INVALID');
      else {
        bounded = true;
        limitations.push({ code: constraint.code.trim(), source: 'TRANSPORT_CONSTRAINT' });
      }
    }
  }
  return {
    decisionRelevance,
    calibrationCodes: [...new Set(calibrationCodes)].sort(),
    limitations,
    unsupported: [...new Set(unsupported)].sort(),
    bounded
  };
}

function runtimeUseDisposition({ scientificUseStatus, decisionRelevance, transportStatus }) {
  if (scientificUseStatus !== 'QUALIFIED' || decisionRelevance !== 'MATERIAL') return 'BLOCKED';
  if (transportStatus === 'DIRECTLY_APPLICABLE' || transportStatus === 'BOUNDED_EXTRAPOLATION') return 'ALLOWED';
  if (transportStatus === 'CALIBRATION_REQUIRED') return 'CONDITIONAL';
  return 'BLOCKED';
}

export function buildApplicabilityAssessment({
  knowledgeRetrievalResultRef,
  knowledgeRef,
  knowledgeOriginContextRefs,
  contextManifestRef,
  decisionProblemRef,
  decisionProblem,
  manifestAuthority,
  scientificUseStatus,
  semanticPreconditions = [],
  effectModifiers = [],
  transportConstraints = [],
  limitations = [],
  unresolvedContextHeterogeneity = []
}) {
  const targets = targetIndex(manifestAuthority);
  const conditionResults = [];
  const conflicts = [];
  const missing = [];
  const unsupported = [];
  const dispositions = [];
  const predicateCalibrationCodes = [];
  const predicateLimitations = [];

  for (const raw of unwrapAggregated(semanticPreconditions)) {
    const normalized = normalizePredicate(raw, 'SEMANTIC_PRECONDITION');
    if (!normalized.valid) {
      unsupported.push(normalized.code);
      dispositions.push('UNRESOLVED');
      continue;
    }
    const evaluated = evaluatePredicate(normalized.predicate, targets);
    conditionResults.push(evaluated.result);
    dispositions.push(evaluated.disposition);
    if (evaluated.missing) missing.push(evaluated.missing);
    if (evaluated.conflict) conflicts.push(evaluated.conflict);
  }
  for (const raw of unwrapAggregated(effectModifiers)) {
    const normalized = normalizePredicate(raw, 'EFFECT_MODIFIER');
    if (!normalized.valid) {
      unsupported.push(normalized.code);
      dispositions.push('UNRESOLVED');
      continue;
    }
    const evaluated = evaluatePredicate(normalized.predicate, targets);
    conditionResults.push(evaluated.result);
    dispositions.push(evaluated.disposition);
    if (evaluated.missing) missing.push(evaluated.missing);
    if (evaluated.conflict) conflicts.push(evaluated.conflict);
    if (evaluated.disposition === 'CALIBRATION_REQUIRED') {
      predicateCalibrationCodes.push(normalized.predicate.code ?? `EFFECT_MODIFIER_CALIBRATION:${normalized.predicate.semanticId}`);
    }
    if (evaluated.disposition === 'BOUNDED_EXTRAPOLATION') {
      predicateLimitations.push({ code: normalized.predicate.code ?? `EFFECT_MODIFIER_EXTRAPOLATION:${normalized.predicate.semanticId}`, source: 'EFFECT_MODIFIER' });
    }
  }

  const transport = evaluateTransportConstraints(unwrapAggregated(transportConstraints), decisionProblem);
  unsupported.push(...transport.unsupported);
  if (transport.unsupported.length > 0) dispositions.push('UNRESOLVED');
  if (unresolvedContextHeterogeneity.length > 0) {
    unsupported.push('DERIVED_CONTEXT_HETEROGENEITY_UNRESOLVED');
    dispositions.push('UNRESOLVED');
  }

  let transportStatus = 'DIRECTLY_APPLICABLE';
  if (transport.decisionRelevance === 'NOT_RELEVANT') transportStatus = 'NOT_RELEVANT';
  else if (dispositions.includes('CONFLICT')) transportStatus = 'CONFLICT';
  else if (dispositions.includes('UNRESOLVED')) transportStatus = 'UNRESOLVED';
  else if (transport.calibrationCodes.length > 0 || predicateCalibrationCodes.length > 0 || dispositions.includes('CALIBRATION_REQUIRED')) transportStatus = 'CALIBRATION_REQUIRED';
  else if (transport.bounded || dispositions.includes('BOUNDED_EXTRAPOLATION')) transportStatus = 'BOUNDED_EXTRAPOLATION';

  const allLimitations = [
    ...unwrapAggregated(limitations).map((item) => cloneCanonicalValue(item)),
    ...transport.limitations,
    ...predicateLimitations,
    ...unresolvedContextHeterogeneity.map((item) => ({ source: 'DERIVED_CONTEXT_HETEROGENEITY', detail: cloneCanonicalValue(item) }))
  ].sort((a, b) => semanticHash('A08-Limitation', a).localeCompare(semanticHash('A08-Limitation', b)));
  const assessment = {
    contractVersion: APPLICABILITY_ASSESSMENT_CONTRACT_VERSION,
    authorityClass: APPLICABILITY_AUTHORITY_CLASS,
    knowledgeRetrievalResultRef,
    knowledgeRef,
    knowledgeOriginContextRefs,
    contextManifestRef,
    decisionProblemRef,
    usePurpose: decisionProblem.usePurpose,
    conditionResults: [...conditionResults].sort((a, b) => semanticHash('A08-Condition', a).localeCompare(semanticHash('A08-Condition', b))),
    transportStatus,
    scientificUseStatus,
    decisionRelevance: transport.decisionRelevance,
    runtimeUse: runtimeUseDisposition({ scientificUseStatus, decisionRelevance: transport.decisionRelevance, transportStatus }),
    requiredTransformationRefs: [],
    requiredCalibrationCodes: [...new Set([...transport.calibrationCodes, ...predicateCalibrationCodes])].sort(),
    limitations: allLimitations,
    conflicts: [...conflicts].sort((a, b) => semanticHash('A08-Conflict', a).localeCompare(semanticHash('A08-Conflict', b))),
    missingContextSemanticIds: [...new Set(missing)].sort(),
    unsupportedConstraintCodes: [...new Set(unsupported)].sort()
  };
  return normalizeApplicabilityAssessment(assessment);
}
