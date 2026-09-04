# Real KBS T4/R1 live GEOX authority resolution provenance

Status: productization qualification evidence only. This file is not architecture authority and does not grant field actionability, approval, dispatch, or machine execution authority.

## Purpose

This acceptance world upgrades the consumer-side GEOX target evidence path from a retained qualification export to a live, exact-ref, replayable authority resolution.

The resolver reads `liyongshang44-max/GEOX` through an injected repository transport. The public GitHub transport resolves the requested ref to one exact commit and then reads the following exact authority files at that commit:

1. `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V3.json`
2. `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-20-T4R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md`
3. `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CROP-ONLY-GEOMETRY-AUTHORITY-V1.json`
4. `apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts`

For each source, the resolver verifies the Git blob SHA against the returned bytes, computes SHA-256 over those exact bytes, and retains those bytes in `GeoxTargetAuthoritySnapshotStore`.

## Independent source compilation

The authority export is not copied from a hand-authored ADR fixture. It is compiled from the exact resolved GEOX source bytes only after cross-source consistency checks establish all of the following:

- provider site: `KBS_LTER_MAIN_CROPPING_SYSTEM_EXPERIMENT`
- provider treatment: `T4`
- replicate: `R1`
- crop: `corn`
- hybrid: `43-96P`
- KBS AgLog planting observation: `6974`
- GEOX field: `field_kbs_mcse_t4r1`
- GEOX season: `season_2026_corn`
- GEOX zone: `zone_kbs_mcse_t4r1_crop_formal_v1`
- authority scope: `EXTERNAL_PUBLIC_RESEARCH_SCOPE`
- `field_validity_proven = false`
- `production_site_claimed = false`
- whole T4/R1 plot is not treated as crop-only
- central prairie strip remains excluded
- raw provider geometry is not republished
- provider plot geometry is not asserted equal to the GEOX crop-only zone

The experiment locator is taken from the GEOX geometry authority's KBS MCSE provider source. The planting observation is independently required by Amendment-20. The runtime scope is independently required by `external_formal_runtime_config_v1.ts`.

## Resolution receipt

The online resolution produces `adr.geox-target-authority-resolution-receipt.v1` with:

- requested repository ref;
- resolved exact commit SHA;
- each exact authority path;
- each Git blob SHA;
- each SHA-256 content hash;
- a deterministic snapshot-manifest hash;
- a deterministic authority-export hash;
- `replay_class = EXACT`.

The receipt itself explicitly carries no field actionability, dispatch, human approval, or machine execution authority.

## Exact replay

Replay does not read GEOX or GitHub again. It requires the retained source bytes referenced by each content hash in the receipt, recomputes both SHA-256 and Git blob SHA, recompiles the authority export, and requires the recompiled export hash to equal the online receipt's authority-export hash.

A missing or mutated retained source therefore fails closed.

## Correspondence integration

`consumeAdrTargetCorrespondenceForGeox()` continues to accept the historical retained qualification export from PR #178 as:

`PINNED_CONSUMER_AUTHORITY_EXPORT_QUALIFICATION_ONLY`

A resolver-produced `adr.geox-target-authority-export.v1` is not accepted without its exact replay receipt. When the receipt and export are fully bound, the consumer classification becomes:

`REPLAYABLE_CONSUMER_AUTHORITY_RESOLUTION`

This classification upgrade changes evidence acquisition and replay quality only. It does not increase decision or execution authority.

## Nonclaims

This qualification does not claim:

- ADR namespace identity equals GEOX field identity;
- provider plot geometry equals GEOX zone geometry;
- GEOX field validity is proven;
- GEOX is a production site;
- correspondence is field-actionable;
- correspondence is an approval;
- correspondence authorizes dispatch;
- correspondence authorizes machine execution;
- the GitHub public transport is the only production transport;
- ADR core packages require modification;
- a new architecture decision is required.

The repository transport is intentionally injectable so a deployment may use GitHub, a pinned internal mirror, or another controlled read-only repository gateway without changing the authority semantics.
