import {
  directEligibilityWorld,
  mixedEligibilityWorld,
  multiEligibilityWorld,
  publishEligibility,
  transportEligibilityWorld
} from '../runtime-eligibility/fixture.mjs';
import {
  publishRuntimeBinding
} from '../../packages/runtime-binding/src/index.mjs';

let seq = 0;
export function audit(actor, suffix = 'd01') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:20:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'runtime-binding' }
  };
}

export function directBindingWorld(label = 'direct') {
  const world = directEligibilityWorld(`d01-${label}`);
  const eligibility = publishEligibility(world, `d01-${label}`);
  return { ...world, eligibility };
}

export function limitedBindingWorld(label = 'limited') {
  const world = transportEligibilityWorld(`d01-${label}`, [
    { type: 'BOUNDED_EXTRAPOLATION', code: 'D01_BOUNDED_LIMITATION' }
  ]);
  const eligibility = publishEligibility(world, `d01-${label}`);
  return { ...world, eligibility };
}

export function multiBindingWorld(label = 'multi') {
  const world = multiEligibilityWorld(`d01-${label}`);
  const eligibility = publishEligibility(world, `d01-${label}`);
  return { ...world, eligibility };
}

export function mixedBindingWorld(label = 'mixed') {
  const world = mixedEligibilityWorld(`d01-${label}`);
  const eligibility = publishEligibility(world, `d01-${label}`);
  return { ...world, eligibility };
}

export function informationBindingWorld(label = 'information') {
  const world = directEligibilityWorld(`d01-${label}`, { includeCrop: false });
  const eligibility = publishEligibility(world, `d01-${label}`);
  return { ...world, eligibility };
}

export function noLegalBindingWorld(label = 'no-legal') {
  const world = transportEligibilityWorld(`d01-${label}`, [
    { type: 'CALIBRATION_REQUIRED', code: 'D01_CALIBRATION_REQUIRED' }
  ]);
  const eligibility = publishEligibility(world, `d01-${label}`);
  return { ...world, eligibility };
}

export function legalPath(world) {
  return world.eligibility.semanticPayload.alternativeEvaluations.find((item) =>
    item.disposition === 'LEGAL' || item.disposition === 'LEGAL_WITH_LIMITATIONS');
}

export function publishBinding(world, label = 'base', selectedPathId = legalPath(world)?.pathId) {
  return publishRuntimeBinding({
    ledger: world.env.ledger,
    logicalId: `runtime-binding.d01.${label}`,
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    selectedAlternativePathId: selectedPathId,
    audit: audit(world.env.runtimePrincipal, `publish-${label}`)
  });
}
