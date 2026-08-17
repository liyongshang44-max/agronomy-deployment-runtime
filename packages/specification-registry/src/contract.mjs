import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { CONTEXT_VALUE_TYPES, EPISTEMIC_CLASSES } from '../../context-contract/src/index.mjs';

export const QUALIFIED_TRANSFORMATION_CONTRACT_VERSION = 'adr.qualified-transformation.v1';
export const MODEL_CONTRACT_VERSION = 'adr.model.v1';
export const POLICY_LEGACY_CONTRACT_VERSION = 'adr.policy.v1';
export const POLICY_CONTRACT_VERSION = 'adr.policy.v2';

export const SPECIFICATION_KINDS = deepFreeze(['QualifiedTransformation', 'Model', 'Policy']);
export const SPECIFICATION_AUTHORITY_CLASSES = deepFreeze({
  QualifiedTransformation: 'SEMANTIC_TRANSFORMATION_SPECIFICATION',
  Model: 'COMPUTATIONAL_SEMANTIC_SPECIFICATION',
  Policy: 'DECISION_LOGIC_SPECIFICATION'
});

const VALUE_TYPES = new Set(CONTEXT_VALUE_TYPES);
const EPISTEMIC = new Set(EPISTEMIC_CLASSES);
const MODEL_OUTPUT_EPISTEMIC = new Set(['DERIVED', 'STATE_ESTIMATE', 'FORECAST', 'MODEL_PRIOR']);
const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const CALIBRATION_MODES = new Set(['NONE', 'OPTIONAL', 'REQUIRED']);
const UNCERTAINTY_MODES = new Set(['PRESERVE', 'WIDEN', 'TRANSFORM_WITH_DECLARED_METHOD']);
const HUMAN_GATE_MODES = new Set(['NONE', 'REQUIRED']);
const FALLBACK_DISPOSITIONS = new Set(['WAIT', 'ABSTAIN', 'EXTERNAL_AUTHORITY']);
const THRESHOLD_MODES = new Set(['SPEC_DEFINED', 'EXTERNAL_AUTHORITY']);
const POLICY_ACTION_EQUIVALENCE_MODES = new Set(['EXACT_MATERIAL_PARAMETERS']);
const HASH_RE = /^sha256:[a-f0-9]{64}$/;

export class SpecificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SpecificationError';
    this.code = code;
  }
}

export function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new SpecificationError('INVALID_SPECIFICATION_FIELD', `${name}.${key} is not part of the frozen S01 contract`);
    }
  }
}

function bool(value, name) {
  if (typeof value !== 'boolean') throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} must be boolean`);
  return value;
}

function list(values, name, { allowEmpty = true, allowed } = {}) {
  if (!Array.isArray(values)) throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} must be an array`);
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (!allowEmpty && normalized.length === 0) {
    throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} cannot be empty`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new SpecificationError('DUPLICATE_SPECIFICATION_VALUE', `${name} cannot contain duplicates`);
  }
  if (allowed) {
    for (const value of normalized) {
      if (!allowed.has(value)) throw new SpecificationError('INVALID_SPECIFICATION_ENUM', `${name} contains unsupported value ${value}`);
    }
  }
  return deepFreeze([...normalized].sort());
}

function controlScope(value) {
  exactObject(value, 'controlScope', new Set(['organizationId', 'tenantId']));
  return deepFreeze({
    organizationId: text(value.organizationId, 'controlScope.organizationId'),
    ...(value.tenantId ? { tenantId: text(value.tenantId, 'controlScope.tenantId') } : {})
  });
}

function method(value, name) {
  exactObject(value, name, new Set(['methodId', 'definitionHash']));
  const definitionHash = text(value.definitionHash, `${name}.definitionHash`);
  if (!HASH_RE.test(definitionHash)) {
    throw new SpecificationError('INVALID_SPECIFICATION_DEFINITION_HASH', `${name}.definitionHash must be canonical sha256:<64 lowercase hex>`);
  }
  return deepFreeze({ methodId: text(value.methodId, `${name}.methodId`), definitionHash });
}

function semanticPort(value, name) {
  exactObject(value, name, new Set(['semanticId', 'valueType', 'unit', 'epistemicClasses', 'measurementConvention']));
  const valueType = text(value.valueType, `${name}.valueType`);
  if (!VALUE_TYPES.has(valueType)) throw new SpecificationError('INVALID_SPECIFICATION_VALUE_TYPE', `${name} contains unsupported value type ${valueType}`);
  const epistemicClasses = list(value.epistemicClasses, `${name}.epistemicClasses`, { allowEmpty: false, allowed: EPISTEMIC });
  return deepFreeze({
    semanticId: text(value.semanticId, `${name}.semanticId`),
    valueType,
    unit: text(value.unit, `${name}.unit`),
    epistemicClasses,
    ...(value.measurementConvention
      ? { measurementConvention: text(value.measurementConvention, `${name}.measurementConvention`) }
      : {})
  });
}

function portList(values, name, { allowEmpty = false } = {}) {
  if (!Array.isArray(values)) throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} must be an array`);
  if (!allowEmpty && values.length === 0) throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} cannot be empty`);
  const normalized = values.map((value, index) => semanticPort(value, `${name}[${index}]`));
  const ids = normalized.map((value) => value.semanticId);
  if (new Set(ids).size !== ids.length) {
    throw new SpecificationError('DUPLICATE_SPECIFICATION_PORT', `${name} cannot repeat semanticId`);
  }
  return deepFreeze([...normalized].sort((a, b) => a.semanticId.localeCompare(b.semanticId)));
}

function applicabilityDomain(value) {
  exactObject(value, 'applicabilityDomain', new Set(['requiredSemanticIds']));
  return deepFreeze({ requiredSemanticIds: list(value.requiredSemanticIds ?? [], 'applicabilityDomain.requiredSemanticIds') });
}

function parameterSlots(values) {
  if (!Array.isArray(values)) throw new SpecificationError('INVALID_SPECIFICATION_INPUT', 'parameterSlots must be an array');
  const normalized = values.map((value, index) => {
    const name = `parameterSlots[${index}]`;
    exactObject(value, name, new Set(['name', 'semanticId', 'valueType', 'unit', 'required']));
    const valueType = text(value.valueType, `${name}.valueType`);
    if (!VALUE_TYPES.has(valueType)) throw new SpecificationError('INVALID_SPECIFICATION_VALUE_TYPE', `${name} contains unsupported value type ${valueType}`);
    return deepFreeze({
      name: text(value.name, `${name}.name`),
      semanticId: text(value.semanticId, `${name}.semanticId`),
      valueType,
      unit: text(value.unit, `${name}.unit`),
      required: bool(value.required, `${name}.required`)
    });
  });
  const names = normalized.map((value) => value.name);
  if (new Set(names).size !== names.length) throw new SpecificationError('DUPLICATE_PARAMETER_SLOT', 'parameter slot names must be unique');
  return deepFreeze([...normalized].sort((a, b) => a.name.localeCompare(b.name)));
}

function calibrationRequirements(values, slots) {
  if (!Array.isArray(values)) throw new SpecificationError('INVALID_SPECIFICATION_INPUT', 'calibrationRequirements must be an array');
  const slotNames = new Set(slots.map((slot) => slot.name));
  const normalized = values.map((value, index) => {
    const name = `calibrationRequirements[${index}]`;
    exactObject(value, name, new Set(['parameterSlot', 'mode']));
    const parameterSlot = text(value.parameterSlot, `${name}.parameterSlot`);
    const mode = text(value.mode, `${name}.mode`);
    if (!slotNames.has(parameterSlot)) throw new SpecificationError('UNKNOWN_CALIBRATION_PARAMETER_SLOT', `${parameterSlot} is not a declared parameter slot`);
    if (!CALIBRATION_MODES.has(mode)) throw new SpecificationError('INVALID_CALIBRATION_REQUIREMENT', `unsupported calibration mode ${mode}`);
    return deepFreeze({ parameterSlot, mode });
  });
  const names = normalized.map((value) => value.parameterSlot);
  if (new Set(names).size !== names.length) throw new SpecificationError('DUPLICATE_CALIBRATION_REQUIREMENT', 'one calibration requirement per parameter slot is allowed');
  return deepFreeze([...normalized].sort((a, b) => a.parameterSlot.localeCompare(b.parameterSlot)));
}

function refList(values, name, { allowEmpty = true } = {}) {
  if (!Array.isArray(values)) throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} must be an array`);
  if (!allowEmpty && values.length === 0) throw new SpecificationError('INVALID_SPECIFICATION_INPUT', `${name} cannot be empty`);
  const normalized = values.map((ref) => assertAuthorityRef(ref));
  const keyed = normalized.map((ref) => [JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]), ref]);
  if (new Set(keyed.map(([key]) => key)).size !== keyed.length) throw new SpecificationError('DUPLICATE_SPECIFICATION_AUTHORITY_REF', `${name} cannot contain duplicate refs`);
  keyed.sort(([a], [b]) => a.localeCompare(b));
  return deepFreeze(keyed.map(([, ref]) => ref));
}

function policyActionParameter(value, name) {
  exactObject(value, name, new Set(['name', 'semanticId', 'valueType', 'unit', 'required', 'material']));
  const valueType = text(value.valueType, `${name}.valueType`);
  if (!VALUE_TYPES.has(valueType)) {
    throw new SpecificationError('INVALID_SPECIFICATION_VALUE_TYPE', `${name} contains unsupported value type ${valueType}`);
  }
  return deepFreeze({
    name: text(value.name, `${name}.name`),
    semanticId: text(value.semanticId, `${name}.semanticId`),
    valueType,
    unit: text(value.unit, `${name}.unit`),
    required: bool(value.required, `${name}.required`),
    material: bool(value.material, `${name}.material`)
  });
}

function policyActionSemantics(value, actionSpace) {
  exactObject(value, 'actionSemantics', new Set(['equivalenceMode', 'actions']));
  const equivalenceMode = text(value.equivalenceMode, 'actionSemantics.equivalenceMode');
  if (!POLICY_ACTION_EQUIVALENCE_MODES.has(equivalenceMode)) {
    throw new SpecificationError(
      'INVALID_POLICY_ACTION_EQUIVALENCE',
      `unsupported Policy action equivalence mode ${equivalenceMode}`
    );
  }
  if (!Array.isArray(value.actions) || value.actions.length === 0) {
    throw new SpecificationError('INVALID_POLICY_ACTION_SEMANTICS', 'actionSemantics.actions must be a non-empty array');
  }
  const actions = value.actions.map((action, index) => {
    const name = `actionSemantics.actions[${index}]`;
    exactObject(action, name, new Set(['actionCode', 'parameters']));
    if (!Array.isArray(action.parameters)) {
      throw new SpecificationError('INVALID_POLICY_ACTION_SEMANTICS', `${name}.parameters must be an array`);
    }
    const parameters = action.parameters.map((parameter, parameterIndex) =>
      policyActionParameter(parameter, `${name}.parameters[${parameterIndex}]`));
    const parameterNames = parameters.map((parameter) => parameter.name);
    const semanticIds = parameters.map((parameter) => parameter.semanticId);
    if (new Set(parameterNames).size !== parameterNames.length) {
      throw new SpecificationError('DUPLICATE_POLICY_ACTION_PARAMETER', `${name} cannot repeat parameter name`);
    }
    if (new Set(semanticIds).size !== semanticIds.length) {
      throw new SpecificationError('DUPLICATE_POLICY_ACTION_PARAMETER_SEMANTIC', `${name} cannot repeat parameter semanticId`);
    }
    return deepFreeze({
      actionCode: text(action.actionCode, `${name}.actionCode`),
      parameters: deepFreeze([...parameters].sort((a, b) => a.name.localeCompare(b.name)))
    });
  });
  const actionCodes = actions.map((action) => action.actionCode);
  if (new Set(actionCodes).size !== actionCodes.length) {
    throw new SpecificationError('DUPLICATE_POLICY_ACTION_SEMANTIC', 'actionSemantics cannot repeat actionCode');
  }
  const sortedActionCodes = [...actionCodes].sort();
  if (JSON.stringify(sortedActionCodes) !== JSON.stringify(actionSpace)) {
    throw new SpecificationError(
      'POLICY_ACTION_SEMANTICS_COVERAGE_MISMATCH',
      'Policy actionSemantics must define exactly one semantic contract for every actionSpace code and no others'
    );
  }
  return deepFreeze({
    equivalenceMode,
    actions: deepFreeze([...actions].sort((a, b) => a.actionCode.localeCompare(b.actionCode)))
  });
}

export function normalizeQualifiedTransformation(value) {
  exactObject(value, 'QualifiedTransformation', new Set([
    'contractVersion', 'authorityClass', 'controlScope', 'inputContract', 'outputContract',
    'method', 'applicabilityDomain', 'uncertaintyConsequence', 'limitations', 'epistemicRule'
  ]));
  if (text(value.contractVersion, 'contractVersion') !== QUALIFIED_TRANSFORMATION_CONTRACT_VERSION) {
    throw new SpecificationError('UNSUPPORTED_SPECIFICATION_CONTRACT', 'unsupported QualifiedTransformation contractVersion');
  }
  if (value.authorityClass !== undefined && value.authorityClass !== SPECIFICATION_AUTHORITY_CLASSES.QualifiedTransformation) {
    throw new SpecificationError('INVALID_SPECIFICATION_AUTHORITY_CLASS', 'invalid QualifiedTransformation authorityClass');
  }
  const inputContract = semanticPort(value.inputContract, 'inputContract');
  const outputContract = semanticPort(value.outputContract, 'outputContract');
  const epistemicRule = text(value.epistemicRule, 'epistemicRule');
  if (epistemicRule !== 'PRESERVE') {
    throw new SpecificationError('TRANSFORMATION_EPISTEMIC_UPGRADE_FORBIDDEN', 'S01 QualifiedTransformation supports only explicit epistemic PRESERVE');
  }
  if (JSON.stringify(inputContract.epistemicClasses) !== JSON.stringify(outputContract.epistemicClasses)) {
    throw new SpecificationError('TRANSFORMATION_EPISTEMIC_UPGRADE_FORBIDDEN', 'PRESERVE requires identical input/output epistemic classes');
  }
  exactObject(value.uncertaintyConsequence, 'uncertaintyConsequence', new Set(['mode']));
  const uncertaintyMode = text(value.uncertaintyConsequence.mode, 'uncertaintyConsequence.mode');
  if (!UNCERTAINTY_MODES.has(uncertaintyMode)) throw new SpecificationError('INVALID_UNCERTAINTY_CONSEQUENCE', `unsupported uncertainty consequence ${uncertaintyMode}`);
  return deepFreeze({
    contractVersion: QUALIFIED_TRANSFORMATION_CONTRACT_VERSION,
    authorityClass: SPECIFICATION_AUTHORITY_CLASSES.QualifiedTransformation,
    controlScope: controlScope(value.controlScope),
    inputContract,
    outputContract,
    method: method(value.method, 'method'),
    applicabilityDomain: applicabilityDomain(value.applicabilityDomain),
    uncertaintyConsequence: deepFreeze({ mode: uncertaintyMode }),
    limitations: list(value.limitations ?? [], 'limitations'),
    epistemicRule
  });
}

export function normalizeModel(value) {
  exactObject(value, 'Model', new Set([
    'contractVersion', 'authorityClass', 'controlScope', 'purpose', 'inputs', 'outputs',
    'evidenceStateRequirements', 'parameterSlots', 'acceptedKnowledgeAuthorityKinds',
    'measurementConventions', 'applicabilityDomain', 'calibrationRequirements', 'limitations', 'computation'
  ]));
  if (text(value.contractVersion, 'contractVersion') !== MODEL_CONTRACT_VERSION) {
    throw new SpecificationError('UNSUPPORTED_SPECIFICATION_CONTRACT', 'unsupported Model contractVersion');
  }
  if (value.authorityClass !== undefined && value.authorityClass !== SPECIFICATION_AUTHORITY_CLASSES.Model) {
    throw new SpecificationError('INVALID_SPECIFICATION_AUTHORITY_CLASS', 'invalid Model authorityClass');
  }
  const inputs = portList(value.inputs, 'inputs');
  const outputs = portList(value.outputs, 'outputs');
  for (const output of outputs) {
    if (output.epistemicClasses.length !== 1 || !MODEL_OUTPUT_EPISTEMIC.has(output.epistemicClasses[0])) {
      throw new SpecificationError(
        'MODEL_OUTPUT_EPISTEMIC_INVALID',
        'Model outputs must declare exactly one of DERIVED, STATE_ESTIMATE, FORECAST or MODEL_PRIOR; OBSERVATION is forbidden'
      );
    }
  }
  const slots = parameterSlots(value.parameterSlots ?? []);
  return deepFreeze({
    contractVersion: MODEL_CONTRACT_VERSION,
    authorityClass: SPECIFICATION_AUTHORITY_CLASSES.Model,
    controlScope: controlScope(value.controlScope),
    purpose: text(value.purpose, 'purpose'),
    inputs,
    outputs,
    evidenceStateRequirements: list(value.evidenceStateRequirements ?? [], 'evidenceStateRequirements'),
    parameterSlots: slots,
    acceptedKnowledgeAuthorityKinds: list(value.acceptedKnowledgeAuthorityKinds ?? [], 'acceptedKnowledgeAuthorityKinds', { allowed: KNOWLEDGE_KINDS }),
    measurementConventions: list(value.measurementConventions ?? [], 'measurementConventions'),
    applicabilityDomain: applicabilityDomain(value.applicabilityDomain),
    calibrationRequirements: calibrationRequirements(value.calibrationRequirements ?? [], slots),
    limitations: list(value.limitations ?? [], 'limitations'),
    computation: method(value.computation, 'computation')
  });
}

export function normalizePolicy(value) {
  exactObject(value, 'Policy', new Set([
    'contractVersion', 'authorityClass', 'controlScope', 'decisionType', 'actionSpace',
    'actionSemantics', 'requiredInputs', 'requiredRuntimeOutputs', 'decisionLogic', 'thresholdAuthority',
    'operationalConstraints', 'jurisdictionConstraints', 'humanGate', 'fallback',
    'abstentionConditions', 'limitations'
  ]));
  const contractVersion = text(value.contractVersion, 'contractVersion');
  if (contractVersion !== POLICY_CONTRACT_VERSION && contractVersion !== POLICY_LEGACY_CONTRACT_VERSION) {
    throw new SpecificationError('UNSUPPORTED_SPECIFICATION_CONTRACT', 'unsupported Policy contractVersion');
  }
  if (value.authorityClass !== undefined && value.authorityClass !== SPECIFICATION_AUTHORITY_CLASSES.Policy) {
    throw new SpecificationError('INVALID_SPECIFICATION_AUTHORITY_CLASS', 'invalid Policy authorityClass');
  }
  const actionSpace = list(value.actionSpace, 'actionSpace', { allowEmpty: false });
  let actionSemantics;
  if (contractVersion === POLICY_LEGACY_CONTRACT_VERSION) {
    if (value.actionSemantics !== undefined) {
      throw new SpecificationError(
        'POLICY_V1_ACTION_SEMANTICS_FORBIDDEN',
        'adr.policy.v1 historical semantics do not include governed action equivalence; publish adr.policy.v2 instead'
      );
    }
  } else {
    if (value.actionSemantics === undefined) {
      throw new SpecificationError(
        'POLICY_ACTION_SEMANTICS_REQUIRED',
        'adr.policy.v2 requires governed action semantics and material-equivalence authority'
      );
    }
    actionSemantics = policyActionSemantics(value.actionSemantics, actionSpace);
  }
  exactObject(value.thresholdAuthority, 'thresholdAuthority', new Set(['mode', 'authorityRefs']));
  const thresholdMode = text(value.thresholdAuthority.mode, 'thresholdAuthority.mode');
  if (!THRESHOLD_MODES.has(thresholdMode)) throw new SpecificationError('INVALID_THRESHOLD_AUTHORITY', `unsupported threshold authority mode ${thresholdMode}`);
  const thresholdRefs = refList(value.thresholdAuthority.authorityRefs ?? [], 'thresholdAuthority.authorityRefs', { allowEmpty: thresholdMode === 'SPEC_DEFINED' });
  if (thresholdMode === 'SPEC_DEFINED' && thresholdRefs.length !== 0) {
    throw new SpecificationError('INVALID_THRESHOLD_AUTHORITY', 'SPEC_DEFINED threshold authority cannot carry external refs');
  }
  exactObject(value.humanGate, 'humanGate', new Set(['mode']));
  const humanGateMode = text(value.humanGate.mode, 'humanGate.mode');
  if (!HUMAN_GATE_MODES.has(humanGateMode)) throw new SpecificationError('INVALID_HUMAN_GATE', `unsupported human gate ${humanGateMode}`);
  exactObject(value.fallback, 'fallback', new Set(['disposition']));
  const fallbackDisposition = text(value.fallback.disposition, 'fallback.disposition');
  if (!FALLBACK_DISPOSITIONS.has(fallbackDisposition)) throw new SpecificationError('INVALID_POLICY_FALLBACK', `unsupported fallback ${fallbackDisposition}`);
  return deepFreeze({
    contractVersion,
    authorityClass: SPECIFICATION_AUTHORITY_CLASSES.Policy,
    controlScope: controlScope(value.controlScope),
    decisionType: text(value.decisionType, 'decisionType'),
    actionSpace,
    ...(actionSemantics ? { actionSemantics } : {}),
    requiredInputs: portList(value.requiredInputs ?? [], 'requiredInputs', { allowEmpty: true }),
    requiredRuntimeOutputs: portList(value.requiredRuntimeOutputs, 'requiredRuntimeOutputs'),
    decisionLogic: method(value.decisionLogic, 'decisionLogic'),
    thresholdAuthority: deepFreeze({ mode: thresholdMode, authorityRefs: thresholdRefs }),
    operationalConstraints: list(value.operationalConstraints ?? [], 'operationalConstraints'),
    jurisdictionConstraints: list(value.jurisdictionConstraints ?? [], 'jurisdictionConstraints'),
    humanGate: deepFreeze({ mode: humanGateMode }),
    fallback: deepFreeze({ disposition: fallbackDisposition }),
    abstentionConditions: list(value.abstentionConditions ?? [], 'abstentionConditions'),
    limitations: list(value.limitations ?? [], 'limitations')
  });
}

export function normalizeSpecification(kind, value) {
  if (kind === 'QualifiedTransformation') return normalizeQualifiedTransformation(value);
  if (kind === 'Model') return normalizeModel(value);
  if (kind === 'Policy') return normalizePolicy(value);
  throw new SpecificationError('UNSUPPORTED_SPECIFICATION_KIND', `unsupported specification kind ${kind}`);
}

export function specificationAuthorityRefs(kind, value) {
  const normalized = normalizeSpecification(kind, value);
  if (kind === 'Policy') return normalized.thresholdAuthority.authorityRefs;
  return deepFreeze([]);
}
