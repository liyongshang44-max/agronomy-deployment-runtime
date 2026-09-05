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
const HISTORICAL_A_CANDIDATE_ID = 'sha256:cf4d00647e019bbc07eacc148ccec43d93cb72491e7b642d3b5dc421b8337adc';
const HISTORICAL_B_CANDIDATE_ID = 'sha256:439cf78bf33da119c67e76fc25c9983d72385b38b1d50bf0ef9dd6242530ecff';
const HISTORICAL_AB_TRANSITION_ID = 'sha256:27a4c39735e11ceb3f2707b7ee9d8db14958f1ed4dbfe74e4e56a35218abee9e';
const HISTORICAL_AB_LINEAGE_ID = 'sha256:bfbecffc29dae26daeec19ec7111693eb60a98e2a3e0ee15b0cc525505427cd9';
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

function exactCurrentSourceCommit() {
  const explicit = process.env.ADR_LIFECYCLE_QUALIFICATION_HEAD?.trim();
  const value = explicit || run('git', ['rev-parse', 'HEAD']).stdout.trim();
  assert.match(value, /^[0-9a-f]{40}$/);
  return value;
}

function ensureCommit(commit) {
  const probe = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (probe.status === 0) return;
  run('git', ['fetch', '--no-tags', '--depth=1', 'origin', commit]);
  const verified = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(verified.status, 0, `exact candidate commit ${commit} must be available after fetch`);
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

function buildQualifiedCandidate({ commit, root }) {
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
      assert.equal(removed.status, 0, `candidate worktree ${worktree} must be removable`);
    }
  }
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `expected lifecycle error ${code}`);
}

const currentSourceCommit = exactCurrentSourceCommit();
const root = mkdtempSync(join(tmpdir(), 'adr-geox-release-candidate-lifecycle-'));
try {
  const a = buildQualifiedCandidate({ commit: CANDIDATE_A_SOURCE_COMMIT, root });
  const b = buildQualifiedCandidate({ commit: CANDIDATE_B_SOURCE_COMMIT, root });
  const c = buildQualifiedCandidate({ commit: currentSourceCommit, root });
  const candidateA = a.candidate;
  const candidateB = b.candidate;
  const candidateC = c.candidate;

  assert.equal(candidateA.candidateId, HISTORICAL_A_CANDIDATE_ID);
  assert.equal(candidateB.candidateId, HISTORICAL_B_CANDIDATE_ID);
  assert.equal(candidateA.descriptor.source_commit, CANDIDATE_A_SOURCE_COMMIT);
  assert.equal(candidateB.descriptor.source_commit, CANDIDATE_B_SOURCE_COMMIT);
  assert.equal(candidateC.descriptor.source_commit, currentSourceCommit);
  assert.equal(candidateA.descriptor.package_name, '@adr/geox-adapter');
  assert.equal(candidateB.descriptor.package_name, '@adr/geox-adapter');
  assert.equal(candidateC.descriptor.package_name, '@adr/geox-adapter');
  assert.equal(candidateA.descriptor.package_metadata_version, '0.1.0-development');
  assert.equal(candidateB.descriptor.package_metadata_version, '0.1.0-development');
  assert.equal(candidateC.descriptor.package_metadata_version, '0.1.0-development');
  assert.equal(candidateA.descriptor.package_tarball_sha256, candidateB.descriptor.package_tarball_sha256,
    'historical A/B must retain the exact #199 identical-byte proof');
  assert.equal(candidateA.descriptor.consumer_api_surface_hash, candidateB.descriptor.consumer_api_surface_hash);
  assert.equal(candidateB.descriptor.consumer_api_surface_hash, candidateC.descriptor.consumer_api_surface_hash,
    'runtime support change must not masquerade as an API export change');
  assert.equal(candidateB.descriptor.target_correspondence_profile_set_hash, candidateC.descriptor.target_correspondence_profile_set_hash,
    'runtime support change must not alter correspondence profile authority');
  assert.notEqual(candidateB.descriptor.compatibility_envelope_hash, candidateC.descriptor.compatibility_envelope_hash,
    'runtime-bound v2 envelope must produce a distinct compatibility identity');
  assert.notEqual(candidateB.candidateId, candidateC.candidateId);

  requireKnownReleaseCandidate(candidateA.candidateId, [candidateA, candidateB, candidateC]);
  requireKnownReleaseCandidate(candidateB.candidateId, [candidateA, candidateB, candidateC]);
  requireKnownReleaseCandidate(candidateC.candidateId, [candidateA, candidateB, candidateC]);
  expectCode(
    () => requireKnownReleaseCandidate(`sha256:${'f'.repeat(64)}`, [candidateA, candidateB, candidateC]),
    'UNKNOWN_CANDIDATE'
  );

  const historicalTransition = assessReleaseCandidateTransitionCompatibility({ predecessor: candidateA, successor: candidateB });
  assert.equal(historicalTransition.transitionDecisionId, HISTORICAL_AB_TRANSITION_ID,
    'runtime-aware lifecycle must not rewrite #199 historical A/B transition identity');
  assert.equal(historicalTransition.decision.contract_version, 'adr.geox-release-candidate-transition-compatibility-decision.v1');
  assert.equal(historicalTransition.decision.package_metadata_version, 'SAME_INFORMATIONAL_ONLY');
  assert.equal(historicalTransition.decision.artifact_tarball, 'SAME');
  assert.equal(historicalTransition.decision.consumer_api_surface, 'SAME');
  assert.equal(historicalTransition.decision.target_correspondence_profile_set, 'SAME');
  assert.equal(historicalTransition.decision.compatibility_envelope, 'SAME');
  assert.equal(historicalTransition.decision.decision, 'REPLACEMENT_ELIGIBLE_FOR_SHADOW_INSTALL');

  const historicalLineage = createReleaseCandidateLineage({
    predecessor: candidateA,
    successor: candidateB,
    transitionDecision: historicalTransition,
    retainPredecessorForRollback: true
  });
  assert.equal(historicalLineage.lineageId, HISTORICAL_AB_LINEAGE_ID,
    'runtime-aware lifecycle must not rewrite #199 historical lineage identity');
  assert.equal(historicalLineage.lineage.predecessor.validity_after_supersession, 'VALID_QUALIFIED_CANDIDATE_NOT_INVALIDATED');

  const adoptionTransition = assessReleaseCandidateTransitionCompatibility({ predecessor: candidateB, successor: candidateC });
  assert.equal(adoptionTransition.decision.contract_version, 'adr.geox-release-candidate-transition-compatibility-decision.v2');
  assert.equal(adoptionTransition.decision.package_metadata_version, 'SAME_INFORMATIONAL_ONLY');
  assert.equal(adoptionTransition.decision.consumer_api_surface, 'SAME');
  assert.equal(adoptionTransition.decision.target_correspondence_profile_set, 'SAME');
  assert.equal(adoptionTransition.decision.compatibility_contract, 'CHANGED_REQUIRES_REVIEW');
  assert.equal(adoptionTransition.decision.runtime_environment, 'CHANGED_OR_UNBOUND_REQUIRES_REVIEW');
  assert.equal(adoptionTransition.decision.compatibility_envelope, 'CHANGED_REQUIRES_REVIEW');
  assert.equal(adoptionTransition.decision.decision, 'REVIEW_REQUIRED');
  assert.equal(adoptionTransition.decision.predecessor_rollback_eligibility, 'NOT_ESTABLISHED');
  assert.equal(adoptionTransition.decision.authority.replacement_authorized, false);
  assert.equal(adoptionTransition.decision.authority.rollback_authorized, false);
  assert.equal(adoptionTransition.decision.authority.shadow_install_authorized, false);
  expectCode(
    () => createReleaseCandidateLineage({
      predecessor: candidateB,
      successor: candidateC,
      transitionDecision: adoptionTransition,
      retainPredecessorForRollback: true
    }),
    'TRANSITION_NOT_ELIGIBLE'
  );

  const sameV2 = compareReleaseCandidateCompatibility(
    candidateC.artifactFingerprint.compatibility,
    candidateC.artifactFingerprint.compatibility
  );
  assert.equal(sameV2.compatibilityContract, 'SAME');
  assert.equal(sameV2.runtimeEnvironment, 'SAME');
  assert.equal(sameV2.decision, 'SAME');

  const runtimeDrift = structuredClone(candidateC.artifactFingerprint.compatibility);
  runtimeDrift.runtime_environment.node_engine = '>=24 <25';
  const runtimeDriftDecision = compareReleaseCandidateCompatibility(
    candidateC.artifactFingerprint.compatibility,
    runtimeDrift
  );
  assert.equal(runtimeDriftDecision.consumerApiSurface, 'SAME');
  assert.equal(runtimeDriftDecision.targetCorrespondenceProfileSet, 'SAME');
  assert.equal(runtimeDriftDecision.runtimeEnvironment, 'CHANGED_OR_UNBOUND_REQUIRES_REVIEW');
  assert.equal(runtimeDriftDecision.compatibilityEnvelope, 'CHANGED_REQUIRES_REVIEW');
  assert.equal(runtimeDriftDecision.decision, 'REVIEW_REQUIRED');

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

  const tampered = structuredClone(candidateC);
  tampered.descriptor.package_name = '@adr/unqualified-injected-package';
  expectCode(() => verifyReleaseCandidateRecord(tampered), 'CANDIDATE_DESCRIPTOR_MISMATCH');

  const evidence = {
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_RELEASE_CANDIDATE_RUNTIME_COMPATIBILITY_V2',
    historicalA: {
      sourceCommit: candidateA.descriptor.source_commit,
      candidateId: candidateA.candidateId
    },
    historicalB: {
      sourceCommit: candidateB.descriptor.source_commit,
      candidateId: candidateB.candidateId
    },
    candidateC: {
      sourceCommit: candidateC.descriptor.source_commit,
      candidateId: candidateC.candidateId,
      packageMetadataVersion: candidateC.descriptor.package_metadata_version,
      packageTarballHash: candidateC.descriptor.package_tarball_sha256,
      apiSurfaceHash: candidateC.descriptor.consumer_api_surface_hash,
      profileSetHash: candidateC.descriptor.target_correspondence_profile_set_hash,
      compatibilityEnvelopeHash: candidateC.descriptor.compatibility_envelope_hash,
      runtimeNodeEngine: candidateC.artifactFingerprint.compatibility.runtime_environment.node_engine,
      qualificationReceiptHash: candidateC.qualificationReceiptHash,
      verifierSourceHash: c.verifierSourceHash
    },
    historicalTransitionIdPreserved: historicalTransition.transitionDecisionId,
    historicalLineageIdPreserved: historicalLineage.lineageId,
    adoptionTransition,
    proofs: {
      historicalV1ReplayIdentityPreserved: true,
      v1ToV2RequiresReview: true,
      v2RuntimeEngineDriftRequiresReview: true,
      apiSurfaceUnchanged: true,
      profileSetUnchanged: true,
      packageMetadataVersionStillInformational: true,
      automaticReplacementAuthorized: false,
      rollbackAuthorized: false,
      shadowInstallAuthorized: false,
      runtimeActivationAuthorized: false,
      packagePublicationAuthorized: false,
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
