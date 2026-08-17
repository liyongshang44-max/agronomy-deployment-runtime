import {
  mixedBindingWorld,
  multiBindingWorld,
  noLegalBindingWorld,
  publishBinding
} from '../runtime-binding/fixture.mjs';
import {
  publishRuntimeAlternativeSet
} from '../../packages/runtime-alternative-set/src/index.mjs';

let seq = 0;
export function audit(actor, suffix = 'd04') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:25:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'runtime-alternative-set' }
  };
}

export function multiAlternativeWorld(label = 'multi') {
  return multiBindingWorld(`d04-${label}`);
}

export function mixedAlternativeWorld(label = 'mixed') {
  return mixedBindingWorld(`d04-${label}`);
}

export function emptyLegalAlternativeWorld(label = 'empty-legal') {
  return noLegalBindingWorld(`d04-${label}`);
}

export function legalAlternatives(world) {
  return world.eligibility.semanticPayload.alternativeEvaluations.filter((item) =>
    item.disposition === 'LEGAL' || item.disposition === 'LEGAL_WITH_LIMITATIONS');
}

export function publishBindingsForPaths(world, paths, label = 'bindings') {
  return paths.map((path, index) => publishBinding(
    world,
    `${label}.${index + 1}`,
    path.pathId
  ));
}

export function publishAllLegalBindings(world, label = 'all-legal') {
  return publishBindingsForPaths(world, legalAlternatives(world), label);
}

export function publishAlternativeSet(world, bindings, label = 'set') {
  return publishRuntimeAlternativeSet({
    ledger: world.env.ledger,
    logicalId: `runtime-alternative-set.d04.${label}`,
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    includedRuntimeBindingRefs: bindings.map((binding) => binding.ref),
    audit: audit(world.env.runtimePrincipal, `publish-${label}`)
  });
}
