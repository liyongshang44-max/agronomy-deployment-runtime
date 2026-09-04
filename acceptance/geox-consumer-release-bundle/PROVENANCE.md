# GEOX consumer release bundle qualification

Status: productization qualification evidence only. This is not architecture authority, domain authority, publication authority, commercial validation, human approval authority, dispatch authority, or machine execution authority.

## Qualified boundary

The underlying GEOX consumer artifact is already proven installable outside the monorepo. This milestone adds a delivery-provenance envelope around that exact artifact without changing its runtime semantics.

A qualified bundle contains exactly:

1. the deterministic `@adr/geox-adapter` npm tarball produced by the existing consumer-artifact builder;
2. `RELEASE-PROVENANCE.json`;
3. `SHA256SUMS` covering the tarball and provenance manifest.

`RELEASE-PROVENANCE.json` binds the bundle to:

- exact Git source repository;
- exact 40-hex source commit;
- exact consumer-artifact and release-bundle manifest hashes;
- package name and version;
- package tarball SHA-256 and package metadata;
- exact adapter source hashes and bundled integration-contract dependency hash;
- consumer-artifact and release-bundle builder versions;
- the frozen authority ceiling and explicit publication non-actions.

No wall-clock build timestamp is emitted. Two builds from the same exact source commit must produce identical package tarball, provenance bytes, checksum manifest and verification evidence hash.

For pull-request qualification, GitHub checks out a synthetic merge commit. That merge ref is deliberately excluded from release provenance. The workflow passes `github.event.pull_request.head.sha` as `ADR_RELEASE_SOURCE_COMMIT`; push qualification uses `github.sha`. Therefore the recorded source commit is always the actual candidate source head being qualified, not GitHub's temporary PR merge object.

## Verification

The verifier rejects:

- any tarball or provenance checksum mismatch;
- source-commit drift;
- source-manifest hash drift;
- package name/version/private-boundary drift;
- packed package metadata that differs from the frozen release metadata;
- authority-ceiling promotion;
- publication-boundary drift;
- extra or missing bundle files.

The acceptance also installs the tarball directly from the qualified bundle into an empty npm-offline consumer project and imports the first-party GEOX adapter by package name.

## Distribution boundary

The qualification workflow may upload the verified directory as a short-lived GitHub Actions artifact for inspection. That is CI evidence transport only.

This milestone does not:

- create a GitHub Release;
- create a Git tag;
- publish to npm or any other registry;
- authorize later publication;
- change semantic-version compatibility claims;
- establish commercial validation;
- create GEOX field identity or actionability;
- create human approval, dispatch, or machine execution authority.

The release status remains `QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED` and commercial validation remains `NOT_ESTABLISHED`.
