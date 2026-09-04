# KBS MCSE T4/R1 Cross-Namespace Target Correspondence — Provenance

Status: acceptance / productization qualification only. Not architecture authority.

## Purpose

Prove that ADR and GEOX can independently resolve to the same real KBS MCSE T4/R1 provider target without equating their namespace-local identifiers or promoting correspondence into action, approval, or execution authority.

## Independent KBS evidence used by ADR

1. KBS LTER Main Cropping System Experiment page
   - https://lter.kbs.msu.edu/research/long-term-experiments/main-cropping-system-experiment/
   - establishes MCSE, T4 Biologically Based management, six replicate blocks, one plot per treatment per block, and the 2019 T3/T4 prairie-strip change.

2. KBS AgLog observation 6974
   - https://aglog.kbs.msu.edu/observations/6974
   - 2026-05-27 planting event for T4 all replications; the reported order includes replicate 1; crop is corn; variety is Blue River Organic Corn Seed 43-96P.

3. KBS LTER MCSE Plot polygons datatable 829 / KBS039-006.40
   - https://lter.kbs.msu.edu/datatables/829
   - provider schema explicitly carries treatment, replicate, subplot and geometry; the public excerpt includes T4 / R1 / strip.
   - raw provider geometry is not copied into this repository.

4. KBS 2026 MCSE plot map
   - https://lter.kbs.msu.edu/maps/images/current-kbs-lter-mcse-plot-map.pdf
   - explicitly labels T4 r1 Corn, defines r as replicate number, and depicts the prairie-strip subplot for T3/T4.

The retained adapter snapshot is content addressed as:

`sha256:885d882859f464287c606f351bcff06c5fa56b8a509a5372d74124e159286da7`

ADR publishes exact-replay ContextDatum / ContextManifest authority for provider target components. It does not create `farmId`, `fieldId`, `zoneId`, or geometry authority.

## GEOX consumer authority export

The retained consumer export pins GEOX repository main:

`d67a2b3cce037c1eaad4d7d051d1f6a11eb09fc3`

and exact Git blobs for:

- T4R1 Formal Site Authority V3;
- Amendment-20 T4R1 Formal Successor Scope Authority;
- T4R1 Crop-Only Geometry Authority V1;
- External Formal Runtime Config V1.

The GEOX namespace-local target is:

- field: `field_kbs_mcse_t4r1`;
- season: `season_2026_corn`;
- zone: `zone_kbs_mcse_t4r1_crop_formal_v1`.

The export is `PINNED_CONSUMER_AUTHORITY_EXPORT_QUALIFICATION_ONLY`. It is not an online GEOX authority resolver and is not promoted into ADR core authority.

## Correspondence rule

The qualified relation candidate is:

`CORRESPONDS_TO_SAME_KBS_MCSE_T4_R1_TARGET`

The match basis is the exact provider tuple:

- official KBS MCSE experiment locator;
- treatment T4;
- replicate R1;
- crop corn;
- planting observation 6974;
- hybrid 43-96P.

The relation is correspondence, not identity equality.

## Geometry boundary

KBS T4 plots contain a central prairie strip. GEOX deliberately derives a conservative crop-only zone inside the provider T4/R1 main plot and excludes the prairie strip.

Therefore this qualification does not claim:

- GEOX zone geometry equals KBS provider plot geometry;
- whole T4/R1 plot is crop-only;
- ADR has geometry authority;
- raw KBS geometry may be republished.

Geometry supports target adjudication but is not itself cross-namespace correspondence authority.

## Authority ceiling

A successful correspondence result still has:

- `identity_equality_claimed = false`;
- `geometry_equality_claimed = false`;
- `zone_correspondence_claimed = false`;
- `field_actionable = false`;
- `dispatch_authorized = false`;
- `human_approval_authority = NONE`;
- `machine_execution_authority = NONE`.

GEOX's own `field_validity_proven = false` and `production_site_claimed = false` limitations are preserved.

## Architectural nonclaims

This acceptance does not require or authorize:

- a new DEC;
- ADR core package changes;
- generic SDK contract changes;
- ADR `farmId` / `fieldId` / `zoneId` creation;
- production correspondence authority;
- recommendation or DecisionResult authority;
- human approval;
- dispatch or physical execution.
