# GEOX independent consumer usability qualification

Status: productization qualification evidence only. This milestone does not modify ADR architecture, semantic runtime, GEOX target identity, publication authority, commercial validation, human approval authority, dispatch authority, or machine execution authority.

## Question under test

Can a consumer that does not understand or import the ADR monorepo obtain a qualified GEOX consumer bundle, verify its portable integrity/provenance binding, install the adapter offline, receive a governed ADR DecisionResult wire message, and reproduce the expected GEOX projection without authority promotion?

## Producer side

The qualification producer is allowed to use ADR repository internals because its job is to create trusted test inputs. It:

1. executes the frozen real KBS soybean planting D06 world and captures the actual governed DecisionResult;
2. creates the standard `adr.result-sink-event.v1` wire message;
3. builds the exact-head GEOX consumer release bundle through the already-qualified release-bundle builder;
4. verifies that bundle through the exact-source release-bundle verifier;
5. emits a minimal out-of-band qualification receipt containing the exact source commit, package identity, tarball/provenance/evidence hashes, expected DecisionResult authority ref/action, and consumer routing scope.

The producer then copies only the portable inputs into a fresh temporary consumer directory.

## Consumer side

Before npm installation, the clean consumer directory contains exactly five top-level inputs:

- `bundle/` — the three-file qualified bundle (`.tgz`, `RELEASE-PROVENANCE.json`, `SHA256SUMS`);
- `qualification-receipt.json`;
- `governed-decision-result-event.json`;
- `consumer.mjs`;
- `package.json`.

The portable `consumer.mjs` is statically prohibited from referencing ADR monorepo relative paths, `packages/**`, `sdks/**`, `docs/**`, `acceptance/**`, DEC identifiers, network APIs, GitHub URLs, or producer-side real-world runners. Its only imports are Node standard-library modules and the public `@adr/geox-adapter/decision-result-sink` package subpath.

The consumer independently:

1. checks the exact three-file bundle set;
2. verifies `SHA256SUMS` over the tarball and provenance bytes;
3. verifies canonical provenance bytes;
4. binds provenance source commit/package identity/tarball hash to the trusted qualification receipt;
5. reproduces the release-bundle evidence hash from local bytes;
6. verifies the frozen non-publication and non-authority ceiling;
7. installs the tarball with `npm --offline` into the clean project;
8. consumes the governed DecisionResult through the public package export;
9. reproduces the expected display-only GEOX projection;
10. proves fail-closed rejection of attempted human-approval promotion, field-binding promotion, and hidden `field_id` injection.

The consumer runtime receives `NODE_PATH=''`, `GITHUB_TOKEN=''` and no ADR-specific environment variable. It performs no network read.

## Trust boundary

This consumer-level verification does not attempt to recompile ADR source or independently recompute repository source-file hashes: that is the producer-side exact-source verifier responsibility already qualified by the Release Bundle milestone. The independent consumer instead verifies that the bundle bytes and canonical provenance it received match an out-of-band trusted qualification receipt for a specific authoritative source commit.

Therefore:

`consumer bundle verification != source-code qualification`

and:

`consumer usability != publication authority != commercial validation`.

## Authority boundary

Expected consumer projection remains:

- `consumer_disposition = DISPLAY_ONLY_ADVISORY_CANDIDATE`;
- `target_binding.status = UNRESOLVED`;
- `field_actionable = false`;
- `dispatch_authorized = false`;
- human approval authority = none;
- machine execution authority = none;
- authority claim = `NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY`.

No ExecutionReceipt or Outcome is created.
