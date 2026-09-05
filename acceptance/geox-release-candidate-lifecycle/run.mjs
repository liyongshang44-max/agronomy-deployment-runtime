import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  assertReleaseCandidateLifecycleTransition,
  assessReleaseCandidateTransitionCompatibility,
  compareReleaseCandidateCompatibility,
  createReleaseCandidateFromVerifiedBundle,
  createReleaseCandidateLineage,
  requireKnownReleaseCandidate,
  verifyReleaseCandidateRecord
} from '../../adapters/geox/scripts/release-candidate-lifecycle.mjs';

const CANDIDATE_A_SOURCE_COMMIT = '953e5def4913d9b7d597126adfc4760ea1ecf375';
const CANDIDATE_B_SOURCE_COMMIT = 'c49afa1d70421f2402fabf0294ea6b50a58013c1';
const REPO_ROOT = resolve(process.cwd());

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

function ensureCommit(commit) {
  const probe = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (probe.status === 0) return;
  run('git', ['fetch', '--no-tags', '--depth=1', 'origin', commit]);
  const verified = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(verified.status, 0, `exact historical candidate commit ${commit} must be available after fetch`);
}

function lifecycleVerificationSubset(verified) {
  return {
    verifierVersion: verified.verifierVersion,
    bundleContractVersion: verified.bundleContractVersion,
    sourceCommit: verified.sourceCommit,
    packageName: verified.packageName,
    packageVersion: verified.packageVersion,
    packageTarballHash: verified.packageTarballHash,
    releaseStatus: verified.releaseStatus,
    compatibility: verified.compatibility,
    evidenceHash: verified.evidenceHash,
    authorityClaim: verified.authorityClaim
  };
}

function buildHistoricalQualifiedCandidate({ commit, root }) {
  ensureCommit(commit);
  const worktree = join(root, `worktree-${commit.slice(0, 12)}`);
  const buildRoot = join(root, `bundle-${commit.slice(0, 12)}`);
  let worktreeAdded = false;
  try {
    run('git', ['worktree', 'add', '--detach', worktree, commit]);
    worktreeAdded = true;
    run(process.execPath, [
      'adapters/geox/scripts/build-consumer-release-bundle.mjs',
      buildRoot,
      commit
    ], { cwd: worktree });
    const verifiedRaw = run(process.execPath, [
      'adapters/geox/scripts/verify-consumer-release-bundle.mjs',
      join(buildRoot, 'bundle'),
      commit
    ], { cwd: worktree }).stdout.trim();
    const verified = JSON.parse(verifiedRaw);
    assert.equal(verified.sourceCommit, commit);

    const provenance = JSON.parse(readFileSync(join(buildRoot, 'bundle', 'RELEASE-PROVENANCE.json'), 'utf8'));
    assert.equal(provenance.source.commit_sha, commit);
    const verifierSourceHash = sha256(readFileSync(join(worktree, 'adapters/geox/scripts/verify-consumer-release-bundle.mjs')));
    const candidate = createReleaseCandidateFromVerifiedBundle({
      sourceRepository: provenance.source.repository,
      verification: lifecycleVerificationSubset(verified),
      verifierSourceHash
    });
    verifyReleaseCandidateRecord(candidate);
    return { candidate, verified, verifierSourceHash };
  } finally {
    if (worktreeAdded) {
      const removed = spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(removed.status, 0, `historical worktree ${worktree} must be removable`);
    }
  }
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `expected lifecycle error ${code}`);
}

const root = mkdtempSync(join(tmpdir(), 'adr-geox-release-candidate-lifecycle-'));
try {
  const a = buildHistoricalQualifiedCandidate({ commit: CANDIDATE_A_SOURCE_COMMIT, root });
  const b = buildHistoricalQualifiedCandidate({ commit: CANDIDATE_B_SOURCE_COMMIT, root });
  const candidateA = a.candidate;
  const candidateB = b.candidate;

  assert.equal(candidateA.descriptor.source_commit, CANDIDATE_A_SOURCE_COMMIT);
  assert.equal(candidateB.descriptor.source_commit, CANDIDATE_B_SOURCE_COMMIT);
  assert.equal(candidateA.descriptor.package_name, '@adr/geox-adapter');
  assert.equal(candidateB.descriptor.package_name, '@adr/geox-adapter');
  assert.equal(candidateA.descriptor.package_metadata_version, '0.1.0-development');
  assert.equal(candidateB.descriptor.package_metadata_version, '0.1.0-development');
  assert.equal(candidateA.descriptor.package_tarball_sha256, candidateB.descriptor.package_tarball_sha256,
    'A and B intentionally prove distinct candidate identity despite identical package bytes');
  assert.equal(candidateA.descriptor.consumer_api_surface_hash, candidateB.descriptor.consumer_api_surface_hash);
  assert.equal(candidateA.descriptor.target_correspondence_profile_set_hash, candidateB.descriptor.target_correspondence_profile_set_hash);
  assert.equal(candidateA.descriptor.compatibility_envelope_hash, candidateB.descriptor.compatibility_envelope_hash);
  assert.notEqual(candidateA.candidateId, candidateB.candidateId, 'different source/qualification identity must create distinct candidate IDs');
  assert.notEqual(candidateA.qualificationReceiptHash, candidateB.qualificationReceiptHash);
  assert.notEqual(a.verifierSourceHash, b.verifierSourceHash,
    'qualification receipt must distinguish verifier implementation changes even when verifier version text remains v1');

  requireKnownReleaseCandidate(candidateA.candidateId, [candidateA, candidateB]);
  requireKnownReleaseCandidate(candidateB.candidateId, [candidateA, candidateB]);
  expectCode(
    () => requireKnownReleaseCandidate(`sha256:${'f'.repeat(64)}`, [candidateA, candidateB]),
    'UNKNOWN_CANDIDATE'
  );

  const transition = assessReleaseCandidateTransitionCompatibility({ predecessor: candidateA, successor: candidateB });
  assert.equal(transition.decision.package_metadata_version, 'SAME_INFORMATIONAL_ONLY');
  assert.equal(transition.decision.artifact_tarball, 'SAME');
  assert.equal(transition.decision.source_commit, 'DIFFERENT');
  assert.equal(transition.decision.qualification_receipt, 'DIFFERENT');
  assert.equal(transition.decision.consumer_api_surface, 'SAME');
  assert.equal(transition.decision.target_correspondence_profile_set, 'SAME');
  assert.equal(transition.decision.compatibility_envelope, 'SAME');
  assert.equal(transition.decision.decision, 'REPLACEMENT_ELIGIBLE_FOR_SHADOW_INSTALL');
  assert.equal(transition.decision.predecessor_rollback_eligibility, 'ELIGIBLE_IF_RETAINED');
  assert.equal(transition.decision.authority.replacement_authorized, false);
  assert.equal(transition.decision.authority.rollback_authorized, false);
  assert.equal(transition.decision.authority.shadow_install_authorized, false);

  const lineage = createReleaseCandidateLineage({
    predecessor: candidateA,
    successor: candidateB,
    transitionDecision: transition,
    retainPredecessorForRollback: true
  });
  assert.equal(lineage.lineage.relation, 'REPLACES');
  assert.equal(lineage.lineage.predecessor.validity_after_supersession, 'VALID_QUALIFIED_CANDIDATE_NOT_INVALIDATED');
  assert.equal(lineage.lineage.predecessor.retained_state, 'RETAINED_FOR_ROLLBACK');
  assert.equal(lineage.lineage.predecessor.rollback_eligibility, 'ELIGIBLE');
  assert.equal(lineage.lineage.predecessor.rollback_authorization, 'NONE_CONSUMER_DEPLOYMENT_AUTHORITY_REQUIRED');
  assert.equal(lineage.lineage.successor.lifecycle_state, 'ELIGIBLE_FOR_SHADOW_INSTALL');
  assert.equal(lineage.lineage.successor.shadow_install_authorization, 'NONE_CONSUMER_DEPLOYMENT_AUTHORITY_REQUIRED');
  assert.equal(lineage.lineage.authority.runtime_activation_authorized, false);
  assert.equal(lineage.lineage.authority.publication_authorized, false);

  for (const [from, to] of [
    ['BUILT', 'QUALIFIED'],
    ['QUALIFIED', 'ELIGIBLE_FOR_SHADOW_INSTALL'],
    ['ELIGIBLE_FOR_SHADOW_INSTALL', 'SUPERSEDED'],
    ['SUPERSEDED', 'RETAINED_FOR_ROLLBACK']
  ]) {
    assert.equal(assertReleaseCandidateLifecycleTransition(from, to), true);
  }
  expectCode(() => assertReleaseCandidateLifecycleTransition('QUALIFIED', 'SUPERSEDED'), 'LIFECYCLE_TRANSITION_INVALID');
  expectCode(() => assertReleaseCandidateLifecycleTransition('RETAINED_FOR_ROLLBACK', 'ELIGIBLE_FOR_SHADOW_INSTALL'), 'LIFECYCLE_TRANSITION_INVALID');

  const tampered = structuredClone(candidateB);
  tampered.descriptor.package_name = '@adr/unqualified-injected-package';
  expectCode(() => verifyReleaseCandidateRecord(tampered), 'CANDIDATE_DESCRIPTOR_MISMATCH');

  const incompatibleEnvelope = structuredClone(candidateB.artifactFingerprint.compatibility);
  incompatibleEnvelope.consumer_api_surface.surface_hash = `sha256:${'0'.repeat(64)}`;
  const incompatibleDecision = compareReleaseCandidateCompatibility(
    candidateB.artifactFingerprint.compatibility,
    incompatibleEnvelope
  );
  assert.equal(incompatibleDecision.consumerApiSurface, 'CHANGED_REQUIRES_REVIEW');
  assert.equal(incompatibleDecision.decision, 'REVIEW_REQUIRED');

  const evidence = {
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_RELEASE_CANDIDATE_LIFECYCLE_V1',
    candidateA: {
      sourceCommit: candidateA.descriptor.source_commit,
      candidateId: candidateA.candidateId,
      packageMetadataVersion: candidateA.descriptor.package_metadata_version,
      packageTarballHash: candidateA.descriptor.package_tarball_sha256,
      apiSurfaceHash: candidateA.descriptor.consumer_api_surface_hash,
      profileSetHash: candidateA.descriptor.target_correspondence_profile_set_hash,
      compatibilityEnvelopeHash: candidateA.descriptor.compatibility_envelope_hash,
      qualificationReceiptHash: candidateA.qualificationReceiptHash,
      verifierSourceHash: a.verifierSourceHash
    },
    candidateB: {
      sourceCommit: candidateB.descriptor.source_commit,
      candidateId: candidateB.candidateId,
      packageMetadataVersion: candidateB.descriptor.package_metadata_version,
      packageTarballHash: candidateB.descriptor.package_tarball_sha256,
      apiSurfaceHash: candidateB.descriptor.consumer_api_surface_hash,
      profileSetHash: candidateB.descriptor.target_correspondence_profile_set_hash,
      compatibilityEnvelopeHash: candidateB.descriptor.compatibility_envelope_hash,
      qualificationReceiptHash: candidateB.qualificationReceiptHash,
      verifierSourceHash: b.verifierSourceHash
    },
    transitionCompatibilityDecision: transition,
    releaseCandidateLineage: lineage,
    proofs: {
      samePackageMetadataVersionDoesNotCollapseCandidateIdentity: true,
      samePackageBytesDoNotCollapseCandidateIdentity: true,
      sourceCommitParticipatesInCandidateIdentity: true,
      qualificationReceiptParticipatesInCandidateIdentity: true,
      verifierImplementationHashBoundIntoQualificationReceipt: true,
      supersededDoesNotMeanInvalid: true,
      rollbackEligibleDoesNotMeanRollbackAuthorized: true,
      incompatibleEnvelopeRequiresReview: true,
      tamperedCandidateRejected: true,
      unknownCandidateRejected: true,
      semverCreated: false,
      packagePublicationAuthorized: false,
      shadowInstallAuthorized: false,
      runtimeActivationAuthorized: false,
      geoxWriteAuthorityCreated: false,
      approvalAuthorityCreated: false,
      dispatchAuthorityCreated: false,
      machineExecutionAuthorityCreated: false,
      newArchitectureDecisionRequired: false
    }
  };

  const evidencePath = process.env.ADR_LIFECYCLE_EVIDENCE_PATH?.trim();
  if (evidencePath) {
    mkdirSync(resolve(evidencePath, '..'), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
