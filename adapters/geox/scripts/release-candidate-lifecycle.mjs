import { createHash } from 'node:crypto';

export const GEOX_RELEASE_CANDIDATE_ARTIFACT_FINGERPRINT_VERSION = 'adr.geox-release-candidate-artifact-fingerprint.v1';
export const GEOX_RELEASE_CANDIDATE_QUALIFICATION_RECEIPT_VERSION = 'adr.geox-release-candidate-qualification-receipt.v1';
export const GEOX_RELEASE_CANDIDATE_DESCRIPTOR_VERSION = 'adr.geox-release-candidate-descriptor.v1';
export const GEOX_RELEASE_CANDIDATE_TRANSITION_DECISION_VERSION = 'adr.geox-release-candidate-transition-compatibility-decision.v1';
export const GEOX_RELEASE_CANDIDATE_LINEAGE_VERSION = 'adr.geox-release-candidate-lineage.v1';

const COMMIT_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const QUALIFIED_RELEASE_STATUS = 'QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED';
const LIFECYCLE_AUTHORITY_CLAIM = 'NONE_RELEASE_CANDIDATE_IDENTITY_AND_ELIGIBILITY_ONLY';
const QUALIFICATION_AUTHORITY_CLAIM = 'NONE_QUALIFICATION_RECEIPT_DOES_NOT_AUTHORIZE_INSTALL_ROLLBACK_OR_PUBLICATION';

const ALLOWED_TRANSITIONS = new Set([
  'BUILT->QUALIFIED',
  'QUALIFIED->ELIGIBLE_FOR_SHADOW_INSTALL',
  'ELIGIBLE_FOR_SHADOW_INSTALL->SUPERSEDED',
  'SUPERSEDED->RETAINED_FOR_ROLLBACK'
]);

export class GeoxReleaseCandidateLifecycleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxReleaseCandidateLifecycleError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new GeoxReleaseCandidateLifecycleError(code, message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function exactObject(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function exactKeys(value, expected, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!exactObject(actual, wanted)) fail(code, `${label} field set drifted: ${actual.join(', ')}`);
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function hashCanonicalReleaseCandidateValue(value) {
  return sha256(Buffer.from(JSON.stringify(canonical(value)), 'utf8'));
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) fail('LIFECYCLE_INPUT_INVALID', `${label} must be non-empty text`);
  return value.trim();
}

function requireCommit(value, label) {
  const commit = requireText(value, label);
  if (!COMMIT_RE.test(commit)) fail('LIFECYCLE_INPUT_INVALID', `${label} must be an exact lowercase 40-hex Git SHA`);
  return commit;
}

function requireHash(value, label) {
  const hash = requireText(value, label);
  if (!SHA256_RE.test(hash)) fail('LIFECYCLE_INPUT_INVALID', `${label} must be sha256:<64 lowercase hex>`);
  return hash;
}

function normalizedCompatibility(value) {
  exactKeys(value, [
    'contract_version',
    'package_version',
    'consumer_api_surface',
    'target_correspondence_profile_registry',
    'change_policy',
    'authority_claim'
  ], 'COMPATIBILITY_ENVELOPE_INVALID', 'compatibility envelope');
  exactKeys(value.consumer_api_surface, ['contract_version', 'surface_hash'], 'COMPATIBILITY_ENVELOPE_INVALID', 'consumer_api_surface');
  exactKeys(value.target_correspondence_profile_registry, ['registry_version', 'profile_set_hash'], 'COMPATIBILITY_ENVELOPE_INVALID', 'target_correspondence_profile_registry');
  requireText(value.contract_version, 'compatibility.contract_version');
  requireText(value.package_version, 'compatibility.package_version');
  requireText(value.consumer_api_surface.contract_version, 'compatibility.consumer_api_surface.contract_version');
  requireHash(value.consumer_api_surface.surface_hash, 'compatibility.consumer_api_surface.surface_hash');
  requireText(value.target_correspondence_profile_registry.registry_version, 'compatibility.target_correspondence_profile_registry.registry_version');
  requireHash(value.target_correspondence_profile_registry.profile_set_hash, 'compatibility.target_correspondence_profile_registry.profile_set_hash');
  requireText(value.change_policy, 'compatibility.change_policy');
  requireText(value.authority_claim, 'compatibility.authority_claim');
  return canonical(value);
}

function compatibilityFacts(value) {
  const compatibility = normalizedCompatibility(value);
  return Object.freeze({
    compatibility,
    compatibilityEnvelopeHash: hashCanonicalReleaseCandidateValue(compatibility),
    apiSurfaceHash: compatibility.consumer_api_surface.surface_hash,
    profileSetHash: compatibility.target_correspondence_profile_registry.profile_set_hash
  });
}

function artifactFingerprintFromVerifiedBundle({ sourceRepository, verification }) {
  exactKeys(verification, [
    'verifierVersion',
    'bundleContractVersion',
    'sourceCommit',
    'packageName',
    'packageVersion',
    'packageTarballHash',
    'releaseStatus',
    'compatibility',
    'evidenceHash',
    'authorityClaim'
  ], 'VERIFIED_BUNDLE_EVIDENCE_INVALID', 'verified bundle evidence');
  const source = requireText(sourceRepository, 'sourceRepository');
  const sourceCommit = requireCommit(verification.sourceCommit, 'verification.sourceCommit');
  const packageName = requireText(verification.packageName, 'verification.packageName');
  const packageVersion = requireText(verification.packageVersion, 'verification.packageVersion');
  const packageTarballHash = requireHash(verification.packageTarballHash, 'verification.packageTarballHash');
  if (verification.releaseStatus !== QUALIFIED_RELEASE_STATUS) {
    fail('VERIFIED_BUNDLE_EVIDENCE_INVALID', `release status must remain ${QUALIFIED_RELEASE_STATUS}`);
  }
  const facts = compatibilityFacts(verification.compatibility);
  if (facts.compatibility.package_version !== packageVersion) {
    fail('VERIFIED_BUNDLE_EVIDENCE_INVALID', 'compatibility package_version must match package metadata version');
  }

  const artifactFingerprint = canonical({
    contract_version: GEOX_RELEASE_CANDIDATE_ARTIFACT_FINGERPRINT_VERSION,
    source_repository: source,
    source_commit: sourceCommit,
    package: {
      name: packageName,
      metadata_version: packageVersion,
      tarball_sha256: packageTarballHash
    },
    compatibility: facts.compatibility,
    release_status: QUALIFIED_RELEASE_STATUS
  });
  return Object.freeze({
    artifactFingerprint: Object.freeze(artifactFingerprint),
    artifactFingerprintHash: hashCanonicalReleaseCandidateValue(artifactFingerprint),
    facts
  });
}

function qualificationReceiptFromVerifiedBundle({ artifactFingerprintHash, verification, verifierSourceHash }) {
  const receipt = canonical({
    contract_version: GEOX_RELEASE_CANDIDATE_QUALIFICATION_RECEIPT_VERSION,
    artifact_fingerprint_hash: requireHash(artifactFingerprintHash, 'artifactFingerprintHash'),
    verifier: {
      version: requireText(verification.verifierVersion, 'verification.verifierVersion'),
      source_hash: requireHash(verifierSourceHash, 'verifierSourceHash')
    },
    release_bundle_evidence_hash: requireHash(verification.evidenceHash, 'verification.evidenceHash'),
    qualification_status: 'VALID',
    shadow_install_eligibility: 'ELIGIBILITY_ONLY_NOT_INSTALL_AUTHORIZATION',
    authority_claim: QUALIFICATION_AUTHORITY_CLAIM
  });
  return Object.freeze({
    qualificationReceipt: Object.freeze(receipt),
    qualificationReceiptHash: hashCanonicalReleaseCandidateValue(receipt)
  });
}

function descriptorFromParts({ artifactFingerprint, artifactFingerprintHash, qualificationReceiptHash, facts }) {
  const descriptor = canonical({
    contract_version: GEOX_RELEASE_CANDIDATE_DESCRIPTOR_VERSION,
    artifact_fingerprint_hash: artifactFingerprintHash,
    qualification_receipt_hash: qualificationReceiptHash,
    source_repository: artifactFingerprint.source_repository,
    source_commit: artifactFingerprint.source_commit,
    package_name: artifactFingerprint.package.name,
    package_metadata_version: artifactFingerprint.package.metadata_version,
    package_tarball_sha256: artifactFingerprint.package.tarball_sha256,
    consumer_api_surface_hash: facts.apiSurfaceHash,
    target_correspondence_profile_set_hash: facts.profileSetHash,
    compatibility_envelope_hash: facts.compatibilityEnvelopeHash,
    authority_claim: LIFECYCLE_AUTHORITY_CLAIM
  });
  return Object.freeze({
    descriptor: Object.freeze(descriptor),
    candidateId: hashCanonicalReleaseCandidateValue(descriptor)
  });
}

export function createReleaseCandidateFromVerifiedBundle({ sourceRepository, verification, verifierSourceHash }) {
  const artifact = artifactFingerprintFromVerifiedBundle({ sourceRepository, verification });
  const receipt = qualificationReceiptFromVerifiedBundle({
    artifactFingerprintHash: artifact.artifactFingerprintHash,
    verification,
    verifierSourceHash
  });
  const descriptor = descriptorFromParts({
    artifactFingerprint: artifact.artifactFingerprint,
    artifactFingerprintHash: artifact.artifactFingerprintHash,
    qualificationReceiptHash: receipt.qualificationReceiptHash,
    facts: artifact.facts
  });
  const record = Object.freeze({
    candidateId: descriptor.candidateId,
    artifactFingerprint: artifact.artifactFingerprint,
    artifactFingerprintHash: artifact.artifactFingerprintHash,
    qualificationReceipt: receipt.qualificationReceipt,
    qualificationReceiptHash: receipt.qualificationReceiptHash,
    descriptor: descriptor.descriptor
  });
  verifyReleaseCandidateRecord(record);
  return record;
}

export function verifyReleaseCandidateRecord(record) {
  exactKeys(record, [
    'candidateId', 'artifactFingerprint', 'artifactFingerprintHash',
    'qualificationReceipt', 'qualificationReceiptHash', 'descriptor'
  ], 'CANDIDATE_RECORD_INVALID', 'candidate record');
  requireHash(record.candidateId, 'candidateId');
  requireHash(record.artifactFingerprintHash, 'artifactFingerprintHash');
  requireHash(record.qualificationReceiptHash, 'qualificationReceiptHash');

  exactKeys(record.artifactFingerprint, [
    'contract_version', 'source_repository', 'source_commit', 'package', 'compatibility', 'release_status'
  ], 'CANDIDATE_RECORD_INVALID', 'artifact fingerprint');
  if (record.artifactFingerprint.contract_version !== GEOX_RELEASE_CANDIDATE_ARTIFACT_FINGERPRINT_VERSION) {
    fail('CANDIDATE_RECORD_INVALID', 'artifact fingerprint contract version drifted');
  }
  exactKeys(record.artifactFingerprint.package, ['name', 'metadata_version', 'tarball_sha256'], 'CANDIDATE_RECORD_INVALID', 'artifact fingerprint package');
  requireText(record.artifactFingerprint.source_repository, 'artifactFingerprint.source_repository');
  requireCommit(record.artifactFingerprint.source_commit, 'artifactFingerprint.source_commit');
  requireText(record.artifactFingerprint.package.name, 'artifactFingerprint.package.name');
  requireText(record.artifactFingerprint.package.metadata_version, 'artifactFingerprint.package.metadata_version');
  requireHash(record.artifactFingerprint.package.tarball_sha256, 'artifactFingerprint.package.tarball_sha256');
  if (record.artifactFingerprint.release_status !== QUALIFIED_RELEASE_STATUS) {
    fail('CANDIDATE_RECORD_INVALID', 'artifact fingerprint release status is not qualified candidate status');
  }
  const facts = compatibilityFacts(record.artifactFingerprint.compatibility);
  const actualArtifactHash = hashCanonicalReleaseCandidateValue(record.artifactFingerprint);
  if (actualArtifactHash !== record.artifactFingerprintHash) {
    fail('ARTIFACT_FINGERPRINT_HASH_MISMATCH', 'artifact fingerprint hash does not match exact candidate artifact facts');
  }

  exactKeys(record.qualificationReceipt, [
    'contract_version', 'artifact_fingerprint_hash', 'verifier', 'release_bundle_evidence_hash',
    'qualification_status', 'shadow_install_eligibility', 'authority_claim'
  ], 'CANDIDATE_RECORD_INVALID', 'qualification receipt');
  if (record.qualificationReceipt.contract_version !== GEOX_RELEASE_CANDIDATE_QUALIFICATION_RECEIPT_VERSION) {
    fail('CANDIDATE_RECORD_INVALID', 'qualification receipt contract version drifted');
  }
  exactKeys(record.qualificationReceipt.verifier, ['version', 'source_hash'], 'CANDIDATE_RECORD_INVALID', 'qualification receipt verifier');
  if (record.qualificationReceipt.artifact_fingerprint_hash !== record.artifactFingerprintHash) {
    fail('QUALIFICATION_RECEIPT_ARTIFACT_MISMATCH', 'qualification receipt does not bind this artifact fingerprint');
  }
  requireText(record.qualificationReceipt.verifier.version, 'qualificationReceipt.verifier.version');
  requireHash(record.qualificationReceipt.verifier.source_hash, 'qualificationReceipt.verifier.source_hash');
  requireHash(record.qualificationReceipt.release_bundle_evidence_hash, 'qualificationReceipt.release_bundle_evidence_hash');
  if (record.qualificationReceipt.qualification_status !== 'VALID') fail('CANDIDATE_RECORD_INVALID', 'qualification receipt must remain VALID');
  if (record.qualificationReceipt.shadow_install_eligibility !== 'ELIGIBILITY_ONLY_NOT_INSTALL_AUTHORIZATION') {
    fail('CANDIDATE_RECORD_INVALID', 'qualification receipt must not create install authorization');
  }
  if (record.qualificationReceipt.authority_claim !== QUALIFICATION_AUTHORITY_CLAIM) {
    fail('CANDIDATE_RECORD_INVALID', 'qualification receipt authority claim drifted');
  }
  const actualReceiptHash = hashCanonicalReleaseCandidateValue(record.qualificationReceipt);
  if (actualReceiptHash !== record.qualificationReceiptHash) {
    fail('QUALIFICATION_RECEIPT_HASH_MISMATCH', 'qualification receipt hash does not match receipt content');
  }

  const expectedDescriptor = descriptorFromParts({
    artifactFingerprint: record.artifactFingerprint,
    artifactFingerprintHash: record.artifactFingerprintHash,
    qualificationReceiptHash: record.qualificationReceiptHash,
    facts
  });
  if (!exactObject(record.descriptor, expectedDescriptor.descriptor)) {
    fail('CANDIDATE_DESCRIPTOR_MISMATCH', 'candidate descriptor does not exactly match bound artifact and qualification evidence');
  }
  if (record.candidateId !== expectedDescriptor.candidateId) {
    fail('CANDIDATE_ID_MISMATCH', 'candidate id does not match canonical descriptor');
  }
  return true;
}

export function requireKnownReleaseCandidate(candidateId, knownCandidates) {
  const wanted = requireHash(candidateId, 'candidateId');
  if (!Array.isArray(knownCandidates)) fail('LIFECYCLE_INPUT_INVALID', 'knownCandidates must be an array');
  for (const candidate of knownCandidates) {
    verifyReleaseCandidateRecord(candidate);
    if (candidate.candidateId === wanted) return candidate;
  }
  fail('UNKNOWN_CANDIDATE', `candidate ${wanted} is not present in the supplied qualified candidate set`);
}

export function compareReleaseCandidateCompatibility(leftCompatibility, rightCompatibility) {
  const left = compatibilityFacts(leftCompatibility);
  const right = compatibilityFacts(rightCompatibility);
  const api = left.apiSurfaceHash === right.apiSurfaceHash ? 'SAME' : 'CHANGED_REQUIRES_REVIEW';
  const profiles = left.profileSetHash === right.profileSetHash ? 'SAME' : 'CHANGED_REQUIRES_REVIEW';
  const envelope = left.compatibilityEnvelopeHash === right.compatibilityEnvelopeHash ? 'SAME' : 'CHANGED_REQUIRES_REVIEW';
  return Object.freeze({
    consumerApiSurface: api,
    targetCorrespondenceProfileSet: profiles,
    compatibilityEnvelope: envelope,
    decision: api === 'SAME' && profiles === 'SAME' && envelope === 'SAME' ? 'SAME' : 'REVIEW_REQUIRED'
  });
}

export function assessReleaseCandidateTransitionCompatibility({ predecessor, successor }) {
  verifyReleaseCandidateRecord(predecessor);
  verifyReleaseCandidateRecord(successor);
  const compatibility = compareReleaseCandidateCompatibility(
    predecessor.artifactFingerprint.compatibility,
    successor.artifactFingerprint.compatibility
  );
  const samePackageName = predecessor.descriptor.package_name === successor.descriptor.package_name;
  const sameCandidate = predecessor.candidateId === successor.candidateId;
  let decision;
  if (sameCandidate) decision = 'NO_REPLACEMENT_REQUIRED_SAME_CANDIDATE';
  else if (!samePackageName) decision = 'INELIGIBLE_PACKAGE_IDENTITY_MISMATCH';
  else if (compatibility.decision !== 'SAME') decision = 'REVIEW_REQUIRED';
  else decision = 'REPLACEMENT_ELIGIBLE_FOR_SHADOW_INSTALL';

  const body = canonical({
    contract_version: GEOX_RELEASE_CANDIDATE_TRANSITION_DECISION_VERSION,
    predecessor_candidate_id: predecessor.candidateId,
    successor_candidate_id: successor.candidateId,
    qualification: {
      predecessor: 'VALID',
      successor: 'VALID'
    },
    package_identity: samePackageName ? 'SAME_PACKAGE_NAME' : 'DIFFERENT_PACKAGE_NAME',
    package_metadata_version: predecessor.descriptor.package_metadata_version === successor.descriptor.package_metadata_version
      ? 'SAME_INFORMATIONAL_ONLY'
      : 'DIFFERENT_INFORMATIONAL_ONLY',
    artifact_tarball: predecessor.descriptor.package_tarball_sha256 === successor.descriptor.package_tarball_sha256 ? 'SAME' : 'DIFFERENT',
    source_commit: predecessor.descriptor.source_commit === successor.descriptor.source_commit ? 'SAME' : 'DIFFERENT',
    qualification_receipt: predecessor.qualificationReceiptHash === successor.qualificationReceiptHash ? 'SAME' : 'DIFFERENT',
    consumer_api_surface: compatibility.consumerApiSurface,
    target_correspondence_profile_set: compatibility.targetCorrespondenceProfileSet,
    compatibility_envelope: compatibility.compatibilityEnvelope,
    decision,
    predecessor_rollback_eligibility: decision === 'REPLACEMENT_ELIGIBLE_FOR_SHADOW_INSTALL' ? 'ELIGIBLE_IF_RETAINED' : 'NOT_ESTABLISHED',
    authority: {
      shadow_install_authorized: false,
      replacement_authorized: false,
      rollback_authorized: false,
      publication_authorized: false
    }
  });
  return Object.freeze({
    transitionDecisionId: hashCanonicalReleaseCandidateValue(body),
    decision: Object.freeze(body)
  });
}

export function assertReleaseCandidateLifecycleTransition(fromState, toState) {
  const from = requireText(fromState, 'fromState');
  const to = requireText(toState, 'toState');
  if (!ALLOWED_TRANSITIONS.has(`${from}->${to}`)) {
    fail('LIFECYCLE_TRANSITION_INVALID', `transition ${from}->${to} is not allowed by release-candidate lifecycle v1`);
  }
  return true;
}

export function createReleaseCandidateLineage({ predecessor, successor, transitionDecision, retainPredecessorForRollback = true }) {
  verifyReleaseCandidateRecord(predecessor);
  verifyReleaseCandidateRecord(successor);
  const recomputed = assessReleaseCandidateTransitionCompatibility({ predecessor, successor });
  if (!transitionDecision || transitionDecision.transitionDecisionId !== recomputed.transitionDecisionId
    || !exactObject(transitionDecision.decision, recomputed.decision)) {
    fail('TRANSITION_DECISION_MISMATCH', 'lineage transition decision must be the exact recomputed decision');
  }
  if (recomputed.decision.decision !== 'REPLACEMENT_ELIGIBLE_FOR_SHADOW_INSTALL') {
    fail('TRANSITION_NOT_ELIGIBLE', `cannot create replacement lineage from decision ${recomputed.decision.decision}`);
  }

  assertReleaseCandidateLifecycleTransition('QUALIFIED', 'ELIGIBLE_FOR_SHADOW_INSTALL');
  assertReleaseCandidateLifecycleTransition('ELIGIBLE_FOR_SHADOW_INSTALL', 'SUPERSEDED');
  if (retainPredecessorForRollback) assertReleaseCandidateLifecycleTransition('SUPERSEDED', 'RETAINED_FOR_ROLLBACK');

  const lineage = canonical({
    contract_version: GEOX_RELEASE_CANDIDATE_LINEAGE_VERSION,
    relation: 'REPLACES',
    predecessor_candidate_id: predecessor.candidateId,
    successor_candidate_id: successor.candidateId,
    transition_decision_id: recomputed.transitionDecisionId,
    predecessor: {
      superseded_state: 'SUPERSEDED',
      validity_after_supersession: 'VALID_QUALIFIED_CANDIDATE_NOT_INVALIDATED',
      retained_state: retainPredecessorForRollback ? 'RETAINED_FOR_ROLLBACK' : 'NOT_RETAINED',
      rollback_eligibility: retainPredecessorForRollback ? 'ELIGIBLE' : 'NOT_ELIGIBLE_NOT_RETAINED',
      rollback_authorization: 'NONE_CONSUMER_DEPLOYMENT_AUTHORITY_REQUIRED'
    },
    successor: {
      lifecycle_state: 'ELIGIBLE_FOR_SHADOW_INSTALL',
      shadow_install_authorization: 'NONE_CONSUMER_DEPLOYMENT_AUTHORITY_REQUIRED'
    },
    authority: {
      replacement_authorized: false,
      rollback_authorized: false,
      runtime_activation_authorized: false,
      publication_authorized: false
    }
  });
  return Object.freeze({
    lineageId: hashCanonicalReleaseCandidateValue(lineage),
    lineage: Object.freeze(lineage)
  });
}
