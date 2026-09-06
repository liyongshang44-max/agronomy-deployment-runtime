import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { ApplicabilityError, APPLICABILITY_ASSESSMENT_CONTRACT_VERSION, APPLICABILITY_AUTHORITY_CLASS, normalizeApplicabilityAssessment } from './contract.mjs';

const SUPPORTED_TRANSPORT_CONSTRAINTS = new Set(['DECISION_TYPE_IN', 'CALIBRATION_REQUIRED', 'BOUNDED_EXTRAPOLATION']);
const SUPPORTED_MISMATCH_DISPOSITIONS = new Set(['CONFLICT', 'CALIBRATION_REQUIRED', 'BOUNDED_EXTRAPOLATION']);
const SUPPORT_OPERATOR = 'CONTEXT_DATUM_SUPPORT_MATCH';
const SUPPORT_DIMENSION = 'VERTICAL_INTERVAL';
const SUPPORT_RELATION = 'EXACT_INTERVAL_MATCH';
const SUPPORT_BASIS_KINDS = new Set(['EXACT_INTERVAL', 'CONTEXT_SEMANTIC_INTERVAL']);
const DECIMAL_RE = /^(?:0|-?[1-9]\d*)(?:\.\d+)?$/;

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

function exactKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key));
}

function canonicalDecimal(value) {
  if (typeof value !== 'string' || !DECIMAL_RE.test(value)) return null;
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer, rawFraction = ''] = unsigned.split('.');
  const fraction = rawFraction.replace(/0+$/, '');
  const normalized = fraction ? `${integer}.${fraction}` : integer;
  if (normalized === '0') return '0';
  return negative ? `-${normalized}` : normalized;
}

function compareDecimal(left, right) {
  const a = canonicalDecimal(left);
  const b = canonicalDecimal(right);
  if (a === null || b === null) return null;
  const split = (value) => {
    const negative = value.startsWith('-');
    const unsigned = negative ? value.slice(1) : value;
    const [integer, fraction = ''] = unsigned.split('.');
    return { negative, integer, fraction };
  };
  const ap = split(a);
  const bp = split(b);
  const scale = Math.max(ap.fraction.length, bp.fraction.length);
  const ai = BigInt(`${ap.negative ? '-' : ''}${ap.integer}${ap.fraction.padEnd(scale, '0')}`);
  const bi = BigInt(`${bp.negative ? '-' : ''}${bp.integer}${bp.fraction.padEnd(scale, '0')}`);
  return ai < bi ? -1 : ai > bi ? 1 : 0;
}

function normalizeSupportBasis(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.kind !== 'string') {
    return { valid: false, code: 'SEMANTIC_PRECONDITION_SUPPORT_BASIS_INVALID' };
  }
  if (!SUPPORT_BASIS_KINDS.has(raw.kind)) {
    return { valid: false, code: 'SEMANTIC_PRECONDITION_UNSUPPORTED_SUPPORT_BASIS' };
  }
  if (raw.kind === 'EXACT_INTERVAL') {
    if (!exactKeys(raw, new Set(['kind', 'fromMm', 'toMm']))) {
      return { valid: false, code: 'SEMANTIC_PRECONDITION_SUPPORT_BASIS_INVALID' };
    }
    const fromMm = canonicalDecimal(raw.fromMm);
    const toMm = canonicalDecimal(raw.toMm);
    if (fromMm === null || toMm === null || compareDecimal(fromMm, toMm) > 0) {
      return { valid: false, code: 'SEMANTIC_PRECONDITION_SUPPORT_INTERVAL_INVALID' };
    }
    return { valid: true, basis: deepFreeze({ kind: 'EXACT_INTERVAL', fromMm, toMm }) };
  }
  if (!exactKeys(raw, new Set(['kind', 'semanticId', 'unit']))) {
    return { valid: false, code: 'SEMANTIC_PRECONDITION_SUPPORT_BASIS_INVALID' };
  }
  let semanticId;
  let unit;
  try {
    semanticId = text(raw.semanticId, 'SEMANTIC_PRECONDITION.expectedSupportBasis.semanticId');
    unit = text(raw.unit, 'SEMANTIC_PRECONDITION.expectedSupportBasis.unit');
  } catch {
    return { valid: false, code: 'SEMANTIC_PRECONDITION_SUPPORT_BASIS_INVALID' };
  }
  if (unit !== 'mm') {
    return { valid: false, code: 'SEMANTIC_PRECONDITION_UNSUPPORTED_SUPPORT_BASIS_UNIT' };
  }
  return { valid: true, basis: deepFreeze({ kind: 'CONTEXT_SEMANTIC_INTERVAL', semanticId, unit }) };
}

function normalizePredicate(raw, source) {
  const value = raw;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, code: `${source}_INVALID_OBJECT` };
  const operator = value.operator;
  const isSupport = operator === SUPPORT_OPERATOR;
  const allowed = source === 'EFFECT_MODIFIER'
    ? new Set(['semanticId', 'operator', 'value', 'unit', 'mismatchDisposition', 'code'])
    : (isSupport
      ? new Set(['semanticId', 'operator', 'supportDimension', 'requiredRelation', 'expectedSupportBasis'])
      : new Set(['semanticId', 'operator', 'value', 'unit']));
  if (Object.keys(value).some((key) => !allowed.has(key))) return { valid: false, code: `${source}_UNSUPPORTED_SHAPE` };
  if (typeof value.semanticId !== 'string' || value.semanticId.trim() === '') {
    return { valid: false, code: `${source}_UNSUPPORTED_PREDICATE` };
  }
  if (isSupport) {
    if (source !== 'SEMANTIC_PRECONDITION') return { valid: false, code: `${source}_UNSUPPORTED_PREDICATE` };
    if (value.supportDimension !== SUPPORT_DIMENSION) {
      return { valid: false, code: 'SEMANTIC_PRECONDITION_UNSUPPORTED_SUPPORT_DIMENSION' };
    }
    if (value.requiredRelation !== SUPPORT_RELATION) {
      return { valid: false, code: 'SEMANTIC_PRECONDITION_UNSUPPORTED_SUPPORT_RELATION' };
    }
    const supportBasis = normalizeSupportBasis(value.expectedSupportBasis);
    if (!supportBasis.valid) return supportBasis;
    return {
      valid: true,
      predicate: deepFreeze({
        source,
        semanticId: value.semanticId.trim(),
        operator: SUPPORT_OPERATOR,
        supportDimension: SUPPORT_DIMENSION,
        requiredRelation: SUPPORT_RELATION,
        expectedSupportBasis: supportBasis.basis,
        mismatchDisposition: 'CONFLICT'
      })
    };
  }
  if (operator !== 'EQUALS') return { valid: false, code: `${source}_UNSUPPORTED_PREDICATE` };
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

function supportExpectedDescriptor(predicate, resolvedSupport) {
  return deepFreeze({
    supportDimension: predicate.supportDimension,
    requiredRelation: predicate.requiredRelation,
    expectedSupportBasis: cloneCanonicalValue(predicate.expectedSupportBasis),
    ...(resolvedSupport ? { resolvedSupport: cloneCanonicalValue(resolvedSupport) } : {})
  });
}

function supportResult(predicate, { expected, target, status, disposition }) {
  return deepFreeze({
    source: predicate.source,
    semanticId: predicate.semanticId,
    operator: predicate.operator,
    expected,
    ...(target !== undefined ? { target } : {}),
    status,
    disposition
  });
}

function resolveSupportBasis(predicate, targets) {
  const basis = predicate.expectedSupportBasis;
  if (basis.kind === 'EXACT_INTERVAL') {
    return { support: deepFreeze({ fromMm: basis.fromMm, toMm: basis.toMm }) };
  }
  const candidates = targets.get(basis.semanticId) ?? [];
  if (candidates.length === 0) return { missing: basis.semanticId };
  if (candidates.length !== 1) return { unsupported: 'MEASUREMENT_SUPPORT_BASIS_AMBIGUOUS' };
  const datum = candidates[0];
  if (datum.unit !== basis.unit) {
    return {
      conflict: {
        code: 'MEASUREMENT_SUPPORT_BASIS_UNIT_MISMATCH',
        semanticId: basis.semanticId,
        expectedUnit: basis.unit,
        targetUnit: datum.unit
      }
    };
  }
  const value = datum.value;
  if (!value || value.type !== 'INTERVAL'
    || value.lower?.type !== 'DECIMAL' || value.upper?.type !== 'DECIMAL') {
    return {
      conflict: {
        code: 'MEASUREMENT_SUPPORT_BASIS_VALUE_INVALID',
        semanticId: basis.semanticId,
        expectedValueType: 'INTERVAL<DECIMAL>'
      }
    };
  }
  return {
    support: deepFreeze({ fromMm: value.lower.decimal, toMm: value.upper.decimal })
  };
}

function evaluateSupportPredicate(predicate, targets) {
  const targetCandidates = targets.get(predicate.semanticId) ?? [];
  const unresolvedExpected = supportExpectedDescriptor(predicate);
  if (targetCandidates.length === 0) {
    return {
      result: supportResult(predicate, {
        expected: unresolvedExpected,
        status: 'UNKNOWN',
        disposition: 'UNRESOLVED'
      }),
      disposition: 'UNRESOLVED',
      missing: predicate.semanticId
    };
  }
  if (targetCandidates.length !== 1) {
    return {
      result: supportResult(predicate, {
        expected: unresolvedExpected,
        status: 'AMBIGUOUS',
        disposition: 'UNRESOLVED'
      }),
      disposition: 'UNRESOLVED',
      unsupported: 'MEASUREMENT_SUPPORT_TARGET_AMBIGUOUS'
    };
  }

  const target = targetCandidates[0];
  const basis = resolveSupportBasis(predicate, targets);
  if (basis.missing) {
    return {
      result: supportResult(predicate, {
        expected: unresolvedExpected,
        target: { verticalSupport: cloneCanonicalValue(target.verticalSupport) },
        status: 'UNKNOWN',
        disposition: 'UNRESOLVED'
      }),
      disposition: 'UNRESOLVED',
      missing: basis.missing
    };
  }
  if (basis.unsupported) {
    return {
      result: supportResult(predicate, {
        expected: unresolvedExpected,
        target: { verticalSupport: cloneCanonicalValue(target.verticalSupport) },
        status: 'AMBIGUOUS',
        disposition: 'UNRESOLVED'
      }),
      disposition: 'UNRESOLVED',
      unsupported: basis.unsupported
    };
  }
  if (basis.conflict) {
    return {
      result: supportResult(predicate, {
        expected: unresolvedExpected,
        target: { verticalSupport: cloneCanonicalValue(target.verticalSupport) },
        status: 'INVALID',
        disposition: 'CONFLICT'
      }),
      disposition: 'CONFLICT',
      conflict: basis.conflict
    };
  }

  const expected = supportExpectedDescriptor(predicate, basis.support);
  const observed = { verticalSupport: cloneCanonicalValue(target.verticalSupport) };
  const matches = target.verticalSupport !== null
    && target.verticalSupport !== undefined
    && canonicalEqual(target.verticalSupport, basis.support);
  return {
    result: supportResult(predicate, {
      expected,
      target: observed,
      status: matches ? 'MATCH' : 'MISMATCH',
      disposition: matches ? 'MATCH' : 'CONFLICT'
    }),
    disposition: matches ? 'MATCH' : 'CONFLICT',
    ...(matches ? {} : {
      conflict: {
        code: 'MEASUREMENT_SUPPORT_MISMATCH',
        semanticId: predicate.semanticId,
        expectedVerticalSupport: cloneCanonicalValue(basis.support),
        targetVerticalSupport: cloneCanonicalValue(target.verticalSupport)
      }
    })
  };
}

function evaluatePredicate(predicate, targets) {
  if (predicate.operator === SUPPORT_OPERATOR) return evaluateSupportPredicate(predicate, targets);
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
    if (evaluated.unsupported) unsupported.push(evaluated.unsupported);
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
    if (evaluated.unsupported) unsupported.push(evaluated.unsupported);
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