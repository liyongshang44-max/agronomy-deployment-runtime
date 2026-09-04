# GEOX consumer artifact packaging qualification

Status: productization qualification evidence only. This is not architecture authority, publication authority, field actionability authority, human approval authority, dispatch authority, or machine execution authority.

## Problem

The GEOX first-party adapter has a stable repository source entrypoint and bounded adapter modules, but those modules depend on `sdks/typescript/src/index.mjs` through repository-relative imports. A source checkout can execute them, but copying or packing `adapters/geox/src` alone does not create a standalone consumer artifact.

A package manifest placed directly over that source tree would therefore be misleading unless installation outside the monorepo is actually proven.

## Artifact boundary

`adapters/geox/consumer-artifact.manifest.json` declares the package identity, explicit subpath exports, exact source-file set, and the one bundled dependency needed by the adapter.

`adapters/geox/scripts/build-consumer-artifact.mjs` constructs the artifact in a temporary staging directory. It:

1. copies the exact GEOX adapter source modules;
2. rewrites only the known repository-internal SDK import to `./integration-contracts.mjs` inside the staged artifact;
3. copies `sdks/typescript/src/integration-contracts.mjs` byte-for-byte into the artifact;
4. rejects any remaining `../../../sdks/` import;
5. writes a private package manifest and runs `npm pack`.

The repository source files are not rewritten. The bundled generic integration contract is not reimplemented or semantically edited.

## Qualification

The acceptance runner builds the tarball twice in independent temporary directories and requires the SHA-256 hashes to match. It then creates an empty consumer project, installs only the local tarball with npm offline mode enabled, and imports the package by its package name and every declared subpath export.

The isolated consumer executes a real GEOX crop-context translation and verifies that the resulting ADR integration message retains the expected ContextDatum payload and the existing no-authority translation boundary.

The isolated consumer also verifies that target-authority resolver, durable store, correspondence, target-identity token, and DecisionResult sink versions are reachable through their public subpaths.

## Nonclaims

This qualification does not claim:

- public npm publication or registry availability;
- semantic-version compatibility beyond the qualified artifact version;
- browser compatibility;
- GEOX field-validity promotion;
- ADR/GEOX target identity equality;
- field actionability;
- human approval;
- dispatch;
- machine execution.

`private: true` is intentional until a separate release authority explicitly permits publication.
