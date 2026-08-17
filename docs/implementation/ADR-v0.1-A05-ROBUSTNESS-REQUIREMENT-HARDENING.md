# ADR v0.1 — A05 RuntimeProfile robustness requirement hardening

Status: implementation hardening for frozen D05 authority seam.

## Problem

MTL-A05 intentionally implemented a minimal `adr.runtime-profile.v1`. Final Architecture v1.0 later requires a positive `DecisionRobustness = ROBUST` claim to prove that the exact `RuntimeAlternativeSet` completeness/coverage satisfies the active RuntimeProfile/Policy robustness requirement.

The minimal v1 profile has no such requirement. D05 therefore cannot lawfully invent a default coverage threshold.

## Contract extension

Historical `adr.runtime-profile.v1` is unchanged and remains replayable.

This hardening adds `adr.runtime-profile.v2` with one additional mandatory authority field:

```text
robustnessRequirement:
  comparisonMode: EXACT_MATERIAL_ACTION_SIGNATURE
  sufficientCompletenessClasses:
    - EXHAUSTIVE_ENUMERATION
    - BOUNDED_ENVELOPE        # only if separately available from governed D04 authority
    - GOVERNED_COVERAGE       # only if separately available from governed D04 authority
```

The list is profile authority. `INCOMPLETE` is permanently ineligible as sufficient coverage.

The existing exported `RUNTIME_PROFILE_CONTRACT_VERSION` remains `adr.runtime-profile.v1` so the large body of already-frozen minimal fixtures and historical authority do not silently change meaning. D05-capable callers explicitly select `RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION = adr.runtime-profile.v2`.

## Nonclaims

This extension does not itself:

- make a RuntimeAlternativeSet complete;
- implement bounded-envelope or governed-sampling authority;
- produce DecisionRobustness;
- choose or execute an action;
- convert confidence/probability into coverage authority.

It only freezes the active profile requirement against which D05 may evaluate exact D04 coverage.

## D05 consequence

A v1 RuntimeProfile has no governed robustness requirement. D05 may evaluate evidence for diagnostics but cannot return positive `ROBUST` from v1 authority.

A v2 RuntimeProfile may support `ROBUST` only when:

1. its comparison mode is the frozen exact material-action-signature method; and
2. the exact RuntimeAlternativeSet completeness class is explicitly listed as sufficient by that profile; and
3. all remaining D05 action-evidence/equivalence requirements pass.
