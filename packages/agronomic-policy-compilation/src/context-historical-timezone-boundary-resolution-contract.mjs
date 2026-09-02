import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_CONTRACT_VERSION =
  'adr.agronomic-context-historical-timezone-boundary-resolution.v1';
export const AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-context-historical-timezone-boundary-resolution-compilation.v1';

export const AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY =
  deepFreeze({
    provider: 'IANA_TZDB',
    release: '2026c',
    releaseCommit: '71f28b9ab3b67c0f9466803f6151812d4fc8e357',
    dataArtifact: 'tzdata2026c.tar.gz',
    sha512: 'e0b4b7044b66fbc27bc21d13d18063abcdf78ab58d5ba5fd64bd1a88d86e9d495f45add4d8e65bb6c40249f9c94ca29b72c8ebba8d0e4c468f2965ac77932ef0',
    ruleFile: 'northamerica',
    retainedEvidence: deepFreeze({
      releaseEvidenceSha256: 'sha256:055162be6f6d98fefeabb54b1a6c01ce1b67964f6d45ea0cc30ff05a04386032',
      northamericaRuleEvidenceSha256: 'sha256:91447e93780354cd95cf00c944c8034c08b9be4b9e23f165307baf7ae3b0cb5a',
      transitionDerivationSha256: 'sha256:75dbb5b05789e53ebd602113ac17baf48086363f6a3db9ede4a094968ae42655'
    })
  });

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const SHA512_RE = /^[0-9a-f]{128}$/;

export class AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
        'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIELD',
        `${name}.${key} is not part of the historical timezone boundary resolution contract`
      );
    }
  }
}

function exactAuthorityRef(value, name) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (ref.kind !== 'AgronomicContextCalendarDateLocalCivilFrameBindingCompilation') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_AUTHORITY_REF',
      `${name} must reference AgronomicContextCalendarDateLocalCivilFrameBindingCompilation`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const text = requiredText(value, name);
  if (!HASH_RE.test(text)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return text;
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'DUPLICATE_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function targetContextSemantic(value) {
  exactObject(value, 'targetContextSemantic', new Set(['semanticId', 'value']));
  exactObject(value.value, 'targetContextSemantic.value', new Set(['type', 'date']));
  const normalized = {
    semanticId: requiredText(value.semanticId, 'targetContextSemantic.semanticId'),
    value: {
      type: requiredText(value.value.type, 'targetContextSemantic.value.type'),
      date: requiredText(value.value.date, 'targetContextSemantic.value.date')
    }
  };
  if (
    normalized.semanticId !== 'crop.planting_date'
    || normalized.value.type !== 'DATE'
    || normalized.value.date !== '2011-05-03'
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_TARGET',
      'v1 supports only crop.planting_date = DATE 2011-05-03'
    );
  }
  return deepFreeze({semanticId: normalized.semanticId, value: deepFreeze(normalized.value)});
}

function localCivilFrame(value) {
  exactObject(value, 'localCivilFrame', new Set(['kind', 'civilDate', 'zoneScheme', 'zoneId']));
  const normalized = {
    kind: requiredText(value.kind, 'localCivilFrame.kind'),
    civilDate: requiredText(value.civilDate, 'localCivilFrame.civilDate'),
    zoneScheme: requiredText(value.zoneScheme, 'localCivilFrame.zoneScheme'),
    zoneId: requiredText(value.zoneId, 'localCivilFrame.zoneId')
  };
  if (
    normalized.kind !== 'LOCAL_CIVIL_DAY'
    || normalized.civilDate !== '2011-05-03'
    || normalized.zoneScheme !== 'IANA'
    || normalized.zoneId !== 'America/Chicago'
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_LOCAL_CIVIL_FRAME',
      'v1 supports only LOCAL_CIVIL_DAY 2011-05-03 / IANA America/Chicago'
    );
  }
  return deepFreeze(normalized);
}

function timezoneRuleAuthority(value) {
  exactObject(
    value,
    'timezoneRuleAuthority',
    new Set(['provider', 'release', 'releaseCommit', 'dataArtifact', 'sha512', 'ruleFile', 'retainedEvidence'])
  );
  exactObject(
    value.retainedEvidence,
    'timezoneRuleAuthority.retainedEvidence',
    new Set(['releaseEvidenceSha256', 'northamericaRuleEvidenceSha256', 'transitionDerivationSha256'])
  );
  const normalized = {
    provider: requiredText(value.provider, 'timezoneRuleAuthority.provider'),
    release: requiredText(value.release, 'timezoneRuleAuthority.release'),
    releaseCommit: requiredText(value.releaseCommit, 'timezoneRuleAuthority.releaseCommit'),
    dataArtifact: requiredText(value.dataArtifact, 'timezoneRuleAuthority.dataArtifact'),
    sha512: requiredText(value.sha512, 'timezoneRuleAuthority.sha512'),
    ruleFile: requiredText(value.ruleFile, 'timezoneRuleAuthority.ruleFile'),
    retainedEvidence: {
      releaseEvidenceSha256: hashValue(value.retainedEvidence.releaseEvidenceSha256, 'timezoneRuleAuthority.retainedEvidence.releaseEvidenceSha256'),
      northamericaRuleEvidenceSha256: hashValue(value.retainedEvidence.northamericaRuleEvidenceSha256, 'timezoneRuleAuthority.retainedEvidence.northamericaRuleEvidenceSha256'),
      transitionDerivationSha256: hashValue(value.retainedEvidence.transitionDerivationSha256, 'timezoneRuleAuthority.retainedEvidence.transitionDerivationSha256')
    }
  };
  if (!SHA512_RE.test(normalized.sha512)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_SHA512',
      'timezoneRuleAuthority.sha512 must be 128 lowercase hex characters'
    );
  }
  const expected = AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY;
  if (
    normalized.provider !== expected.provider
    || normalized.release !== expected.release
    || normalized.releaseCommit !== expected.releaseCommit
    || normalized.dataArtifact !== expected.dataArtifact
    || normalized.sha512 !== expected.sha512
    || normalized.ruleFile !== expected.ruleFile
    || normalized.retainedEvidence.releaseEvidenceSha256 !== expected.retainedEvidence.releaseEvidenceSha256
    || normalized.retainedEvidence.northamericaRuleEvidenceSha256 !== expected.retainedEvidence.northamericaRuleEvidenceSha256
    || normalized.retainedEvidence.transitionDerivationSha256 !== expected.retainedEvidence.transitionDerivationSha256
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_AUTHORITY',
      'v1 requires exact IANA tzdb 2026c / tzdata2026c.tar.gz / northamerica retained evidence'
    );
  }
  return deepFreeze({
    ...normalized,
    retainedEvidence: deepFreeze(normalized.retainedEvidence)
  });
}

function historicalResolution(value) {
  exactObject(
    value,
    'historicalResolution',
    new Set(['springTransitionDate', 'fallTransitionDate', 'baseOffset', 'daylightSave', 'effectiveOffset', 'dstState'])
  );
  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, requiredText(item, `historicalResolution.${key}`)])
  );
  const expected = {
    springTransitionDate: '2011-03-13',
    fallTransitionDate: '2011-11-06',
    baseOffset: '-06:00',
    daylightSave: '+01:00',
    effectiveOffset: '-05:00',
    dstState: 'DAYLIGHT'
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (normalized[key] !== expectedValue) {
      throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
        'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_HISTORICAL_STATE',
        `v1 requires exact historicalResolution.${key} = ${expectedValue}`
      );
    }
  }
  return deepFreeze(normalized);
}

function localBoundaryProjection(value) {
  exactObject(value, 'localBoundaryProjection', new Set(['start', 'end']));
  const normalized = {
    start: requiredText(value.start, 'localBoundaryProjection.start'),
    end: requiredText(value.end, 'localBoundaryProjection.end')
  };
  if (
    normalized.start !== '2011-05-03T00:00:00-05:00'
    || normalized.end !== '2011-05-04T00:00:00-05:00'
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_LOCAL_BOUNDARY',
      'v1 requires exact 2011-05-03 America/Chicago daylight local boundaries'
    );
  }
  return deepFreeze(normalized);
}

function effectiveInterval(value) {
  exactObject(value, 'effectiveInterval', new Set(['start', 'end']));
  const normalized = {
    start: requiredText(value.start, 'effectiveInterval.start'),
    end: requiredText(value.end, 'effectiveInterval.end')
  };
  if (
    normalized.start !== '2011-05-03T05:00:00.000Z'
    || normalized.end !== '2011-05-04T05:00:00.000Z'
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_EFFECTIVE_INTERVAL',
      'v1 requires exact canonical UTC effectiveInterval boundaries'
    );
  }
  return deepFreeze(normalized);
}

export function normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(value) {
  exactObject(
    value,
    'AgronomicContextHistoricalTimezoneBoundaryResolution',
    new Set([
      'contractVersion',
      'resolutionId',
      'parentCalendarDateLocalCivilFrameBindingCompilationRef',
      'targetContextSemantic',
      'localCivilFrame',
      'timezoneRuleAuthority',
      'historicalResolution',
      'localBoundaryProjection',
      'effectiveInterval',
      'rationale'
    ])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
    !== AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_CONTRACT_VERSION
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_CONTRACT',
      'unsupported historical timezone boundary resolution contractVersion'
    );
  }
  const target = targetContextSemantic(value.targetContextSemantic);
  const frame = localCivilFrame(value.localCivilFrame);
  if (target.value.date !== frame.civilDate) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_DATE_MISMATCH',
      'target DATE must equal local civil frame date'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_CONTRACT_VERSION,
    resolutionId: requiredText(value.resolutionId, 'resolutionId'),
    parentCalendarDateLocalCivilFrameBindingCompilationRef: exactAuthorityRef(
      value.parentCalendarDateLocalCivilFrameBindingCompilationRef,
      'parentCalendarDateLocalCivilFrameBindingCompilationRef'
    ),
    targetContextSemantic: target,
    localCivilFrame: frame,
    timezoneRuleAuthority: timezoneRuleAuthority(value.timezoneRuleAuthority),
    historicalResolution: historicalResolution(value.historicalResolution),
    localBoundaryProjection: localBoundaryProjection(value.localBoundaryProjection),
    effectiveInterval: effectiveInterval(value.effectiveInterval),
    rationale: requiredText(value.rationale, 'rationale')
  });
}

export function agronomicContextHistoricalTimezoneBoundaryResolutionHash(value) {
  return semanticHash(
    'AgronomicContextHistoricalTimezoneBoundaryResolution',
    normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(value)
  );
}

export function normalizeAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation(value) {
  exactObject(
    value,
    'AgronomicContextHistoricalTimezoneBoundaryResolutionCompilation',
    new Set(['contractVersion', 'authorityClass', 'resolution', 'resolutionHash', 'boundaryReviewRef', 'losslessCoverage', 'limitations'])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
    !== AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_CONTRACT_VERSION
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_CONTRACT',
      'unsupported historical timezone boundary resolution compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_AUTHORITY') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_AUTHORITY',
      'invalid authorityClass'
    );
  }
  const resolution = normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(value.resolution);
  const resolutionHash = hashValue(value.resolutionHash, 'resolutionHash');
  if (resolutionHash !== agronomicContextHistoricalTimezoneBoundaryResolutionHash(resolution)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_HASH_MISMATCH',
      'resolutionHash must exactly match normalized resolution'
    );
  }
  let boundaryReviewRef;
  try {
    boundaryReviewRef = assertAuthorityRef(value.boundaryReviewRef);
  } catch (error) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_AUTHORITY_REF',
      `boundaryReviewRef must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (boundaryReviewRef.kind !== 'AgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_AUTHORITY_REF',
      'boundaryReviewRef must reference AgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision'
    );
  }
  exactObject(value.losslessCoverage, 'losslessCoverage', new Set(['status', 'coveredElements', 'unrepresentedElements']));
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COVERAGE',
      'status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(value.losslessCoverage.coveredElements ?? [], 'losslessCoverage.coveredElements');
  const unrepresentedElements = stringList(value.losslessCoverage.unrepresentedElements ?? [], 'losslessCoverage.unrepresentedElements');
  if (status === 'COMPLETE' && unrepresentedElements.length > 0) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COVERAGE',
      'COMPLETE cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COVERAGE',
      'INCOMPLETE must name unrepresented targeted elements'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_AUTHORITY',
    resolution,
    resolutionHash,
    boundaryReviewRef,
    losslessCoverage: deepFreeze({status, coveredElements, unrepresentedElements}),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation(value);
  return deepFreeze([
    normalized.resolution.parentCalendarDateLocalCivilFrameBindingCompilationRef,
    normalized.boundaryReviewRef
  ]);
}
