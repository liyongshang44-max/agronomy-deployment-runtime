# Real KBS T1/R1 ↔ GEOX target correspondence provenance

Status: **acceptance evidence only — not architecture authority**

This suite qualifies one additional real cross-namespace target correspondence without creating an ADR field, copying GEOX identity into ADR, republishing KBS geometry, or granting action/approval/execution authority.

## Provider-side evidence

The ADR side is rebuilt independently from public KBS material.

1. KBS Main Cropping System Experiment:
   - locator: `https://lter.kbs.msu.edu/research/long-term-experiments/main-cropping-system-experiment/`
   - experiment: Main Cropping System Experiment (MCSE)
   - treatment: `T1`
   - treatment label used by this acceptance world: `Conventional`
   - replicate structure: six replicate blocks
2. KBS AgLog observation `6931`:
   - locator: `https://aglog.kbs.msu.edu/observations/6931`
   - observation type: Planting
   - date: `2026-05-11`
   - area: `T1`
   - scope: all T1 replications
   - crop: corn
   - variety/hybrid: Pioneer `P0306Q`
   - the source reports a calendar date; this suite does not claim a more precise planting timestamp
3. KBS004:
   - locator: `https://lter.kbs.msu.edu/datasets/7`
   - used only for treatment/replicate identity structure
   - no provider plot geometry is copied into ADR

The retained provider-response bytes are content addressed by:

`sha256:b79542a4a5f19f91d7d98c6404bf841cd5660b28672e9fb66bd4b9e6905c1fcd`

ADR therefore resolves the provider target as:

`MCSE / T1 / R1 / corn / P0306Q / AgLog 6931`

It does **not** create or infer a GEOX field/zone identifier.

## Consumer-side authority

The GEOX evidence is independently pinned to:

`liyongshang44-max/GEOX @ 5050f1c08d2528048c56d56add4cbb068b956925`

Exact final V1 formal authority files:

- `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json`
  - blob `eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8`
- `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json`
  - blob `dedc8db6e2e3c902066ed94b0d3322a69775b7b6`
- `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json`
  - blob `b5de9d29189cb654444b3f57d00df290eefe16d3`

These authorities independently bind:

- site `KBS_MCSE_T1R1`
- field `field_kbs_mcse_t1r1`
- season `season_2026_corn`
- zone `zone_kbs_mcse_t1r1_formal_v1`
- crop `corn`
- planting observation `6931`
- planting local date `2026-05-11`
- provider `KBS_AGLOG`

The V1 geometry boundary is intentionally different from the later T3/R1 and T4/R1 successor worlds. T1/R1 references restricted KBS provider geometry and does not republish it. The acceptance export therefore classifies geometry as:

`PROVIDER_GEOMETRY_REFERENCED_RESTRICTED_NOT_REPUBLISHED`

It does not claim a derived crop-only polygon, raw geometry publication rights, provider/GEOX geometry equality, or field validity.

## Correspondence rule

The qualified relation is only:

`CORRESPONDS_TO_SAME_KBS_MCSE_T1_R1_TARGET`

It means both independently governed sides resolve to the same provider target components. It does not mean ADR and GEOX identities are equal.

The following remain false / NONE:

- ADR↔GEOX identity equality
- geometry equality
- zone correspondence/equality
- field actionability
- dispatch authority
- human approval authority
- machine execution authority

## Resolver boundary

T1/R1 is qualified from an exact pinned consumer authority export only:

`PINNED_CONSUMER_AUTHORITY_EXPORT_QUALIFICATION_ONLY`

This suite does not silently generalize the T4/R1 replayable online resolver.

## Architectural classification

This is a productization/consumer-boundary acceptance extension. No ADR core contract or generic SDK wire contract is changed, and no new architecture decision is required by this proof.
