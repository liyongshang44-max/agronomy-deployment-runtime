import {
  assess,
  publishTargetDatum,
  rebuildWorldWithTransportConstraints
} from '../applicability/fixture.mjs';
import { publishManifest } from '../context-manifest/fixtures.mjs';
import {
  directPlanWorld,
  multiCandidatePlanWorld,
  planCompilerInput
} from '../runtime-plan/fixture.mjs';
import { compileRuntimePlan } from '../../packages/runtime-plan/src/index.mjs';
import { publishRuntimeEligibility } from '../../packages/runtime-eligibility/src/index.mjs';

let seq = 0;
export function audit(actor, suffix = 'r03') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:10:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'runtime-eligibility' }
  };
}

export function compileWorld(world) {
  return compileRuntimePlan(planCompilerInput(world));
}

export function directEligibilityWorld(label = 'direct', options = {}) {
  const world = directPlanWorld(`r03-${label}`, options);
  return { ...world, runtimePlan: compileWorld(world) };
}

export function multiEligibilityWorld(label = 'multi') {
  const world = multiCandidatePlanWorld(`r03-${label}`);
  return { ...world, runtimePlan: compileWorld(world) };
}

export function transportEligibilityWorld(label, transportConstraints) {
  const base = rebuildWorldWithTransportConstraints(`r03-${label}`, transportConstraints);
  const soil = publishTargetDatum(base.env, {
    suffix: `r03-${label}-soil`,
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.27' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION'
  });
  const manifest = publishManifest(base.env.ledger, {
    logicalId: `manifest.r03.${label}`,
    decisionProblem: base.decision,
    datumRefs: [...base.manifest.semanticPayload.datumRefs, soil.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const world = {
    ...base,
    env: { ...base.env, profile: base.profile },
    deployment: base.deployment,
    manifest
  };
  const assessment = assess(world, {
    logicalId: `applicability.r03.${label}`,
    knowledgeRef: base.retrieval.semanticPayload.candidateRefs[0],
    manifest
  });
  const complete = { ...world, assessments: [assessment] };
  return { ...complete, runtimePlan: compileWorld(complete) };
}

export function publishEligibility(world, label = 'base') {
  return publishRuntimeEligibility({
    ledger: world.env.ledger,
    logicalId: `runtime-eligibility.r03.${label}`,
    version: '1',
    runtimePlan: world.runtimePlan,
    audit: audit(world.env.runtimePrincipal, `publish-${label}`)
  });
}
