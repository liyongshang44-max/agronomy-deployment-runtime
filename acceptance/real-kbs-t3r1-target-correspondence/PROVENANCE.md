# KBS MCSE T3/R1 Cross-Namespace Target Correspondence — Provenance

Status: acceptance / productization qualification only. Not architecture authority.

## Purpose

Prove a second independently governed cross-namespace target correspondence without deriving ADR identity from GEOX or GEOX identity from ADR.

This qualification uses KBS MCSE T3/R1 as a deliberately distinct real target from the already-qualified T4/R1 case. It tests whether the existing GEOX correspondence seam can admit more than one exact real provider target while preserving the same authority ceiling.

## Independent KBS evidence used by ADR

ADR-side target context is reconstructed only from official KBS material:

1. KBS LTER Main Cropping System Experiment page
   - https://lter.kbs.msu.edu/research/long-term-experiments/main-cropping-system-experiment/
   - establishes the MCSE, T3 Reduced Input treatment, one-hectare plots, and six replicate blocks.

2. KBS AgLog observation 6966
   - https://aglog.kbs.msu.edu/observations/6966
   - records the 2026-05-20 Main Site LTER T3 planting event;
   - the reported replication order includes replicate 1;
   - crop is corn;
   - hybrid is Pioneer P0306Q.

3. KBS Agronomic Practices of the Main Cropping System Experiment dataset
   - https://lter.kbs.msu.edu/datasets/7
   - independently states the six R1-R6 replicate blocks and T3 Reduced Input treatment;
   - records the center prairie strip in each T3 replicate since 2019.

The retained adapter snapshot is content addressed as:

`sha256:e21b6d9412cfe62600bb92a93a9359a9c08f7595451f62a4a505af43d27a58c5`

ADR publishes exact-replay ContextDatum / ContextManifest authority for the source-supported provider target components. It does not create `farmId`, `fieldId`, `zoneId`, or geometry authority.

## GEOX consumer authority export

The retained consumer export pins GEOX authoritative main:

`5050f1c08d2528048c56d56add4cbb068b956925`

and exact Git blobs for:

- `GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V2.json`;
- Amendment-17 T3R1 Formal Successor Scope Authority;
- T3R1 Crop-Only Geometry Authority V1;
- `GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V2.json`.

Those independently governed GEOX authorities converge on:

- site `KBS_MCSE_T3R1`;
- provider treatment `T3` / Reduced Input;
- replicate `R1`;
- field `field_kbs_mcse_t3r1`;
- season `season_2026_corn`;
- zone `zone_kbs_mcse_t3r1_crop_formal_v1`;
- crop `corn`;
- hybrid `P0306Q`;
- KBS AgLog planting observation `6966`.

GEOX explicitly retains `field_validity_proven = false` and `production_site_claimed = false`.

This T3/R1 consumer export remains:

`PINNED_CONSUMER_AUTHORITY_EXPORT_QUALIFICATION_ONLY`

The existing online/exact replayable resolver remains qualified for T4/R1. This PR does not silently generalize that resolver to T3/R1. Replayability is a separate evidence-acquisition quality and does not affect whether the cross-namespace correspondence itself is qualified.

## Correspondence rule

The qualified relation candidate is:

`CORRESPONDS_TO_SAME_KBS_MCSE_T3_R1_TARGET`

The exact match basis is:

- official KBS MCSE experiment locator;
- treatment T3;
- replicate R1;
- crop corn;
- planting observation 6966;
- hybrid P0306Q.

The relation is correspondence, not identity equality.

## Geometry boundary

KBS T3 plots contain a center prairie strip. GEOX's T3 crop-only geometry authority deliberately uses a conservative crop-only subzone and excludes the prairie strip.

Therefore this qualification does not claim:

- GEOX zone geometry equals KBS provider plot geometry;
- whole T3/R1 plot is crop-only;
- ADR has geometry authority;
- raw KBS geometry may be republished;
- geometry alone proves correspondence.

## Adapter reuse boundary

`adapters/geox/src/target-correspondence.mjs` retains the original T4/R1 public constants and behavior while adding one explicit T3/R1 correspondence profile.

The profiles are exact, closed-world adapter qualification profiles. They are not a new ADR generic core abstraction and do not authorize arbitrary treatment/field matching.

The existing replayable T4/R1 resolver contract remains unchanged.

## Mutation controls

The qualification must fail closed for at least:

- wrong relation / attempted identity equality;
- missing ADR ContextDatum authority;
- treatment mismatch;
- replicate mismatch;
- crop mismatch;
- hybrid mismatch;
- planting observation mismatch;
- use of the T4 authority source set for T3;
- GEOX field identity drift;
- field-validity promotion;
- production-site promotion;
- provider/GEOX geometry equality promotion;
- field actionability promotion;
- dispatch promotion;
- invalid exact GEOX main pin.

## Authority ceiling

A successful T3/R1 correspondence still has:

- `identity_equality_claimed = false`;
- `geometry_equality_claimed = false`;
- `zone_correspondence_claimed = false`;
- `field_actionable = false`;
- `dispatch_authorized = false`;
- `human_approval_authority = NONE`;
- `machine_execution_authority = NONE`.

## Architectural nonclaims

This acceptance does not require or authorize:

- DEC-0034;
- a new ADR core package;
- a new generic SDK contract;
- ADR `farmId` / `fieldId` / `zoneId` creation;
- online T3/R1 consumer-authority replay;
- production correspondence authority;
- field actionability;
- recommendation or DecisionResult authority;
- human approval;
- dispatch;
- physical execution.
