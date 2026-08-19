# ADR Real Paper Benchmark v1

This directory defines the calibration benchmark for the agronomic knowledge production path:

```text
exact scientific PDF
→ LLM1 extraction
→ ClaimCandidate + SourceContextCandidate + exact evidence locator
→ blind LLM2 source-faithful falsification
→ deterministic AUTO_ACCEPT / AUTO_REJECT / ESCALATE_TO_HUMAN
→ independent blind reference adjudication
→ safety metrics
```

Benchmark results are evidence about ADR's knowledge-production behavior. They are **not** scientific authority and they do not perform Scientific Qualification.

## Frozen corpus authority

The frozen corpus authority remains:

`docs/implementation/real-paper-benchmark/corpus-v1.json`

RP001 is the first baseline:

`Seedling-Stage Deficit Irrigation with Nitrogen Application in Three-Year Field Study Provides Guidance for Improving Maize Yield, Water and Nitrogen Use Efficiencies`

DOI: `10.3390/plants11213007`

PMCID: `PMC9656380`

The eight entries in `expansion-candidates.json` are discovery candidates only. They are not silently promoted into the corpus.

## RP001 exact materialization

RP001 has been successfully acquired from the current PMC open-access distribution surface and materialized through the RA02 rights-enforced pilot path without invoking any LLM.

The exact retained PDF bytes are stable across repeated materialization runs:

```text
contentHash = sha256:0e17a738d09b6d6638b103ce6a7b979cb9c7b2d9011e449ccdbc5d585dea6cab
byteLength  = 6045990
```

Each materialization run publishes a new exact operational/rights authority world bound to its own code head and timestamps; therefore SourceArtifact semantic refs and RightsDecision refs may differ between runs even though the retained content hash is identical.

The materialization workflow explicitly verifies:

- exact product code head;
- current PMC OA acquisition trace;
- valid PDF bytes;
- pre-retention Source authority;
- `RETAIN_FULLTEXT` RightsDecision before retained storage;
- exact SourceArtifact content hash and byte length;
- durable checkpoint recovery;
- zero LLM invocation / zero external model egress.

Materialization artifacts contain the durable checkpoint, content-addressed retained PDF, acquisition trace and `rp001-materialization-evidence.json`. They are workflow evidence, not corpus authority.

## Live LLM1 → LLM2 run

`.github/workflows/rp001-live-benchmark.yml` is `workflow_dispatch` only. A push cannot trigger paid/external model execution.

A live run requires all of the following:

- explicit `external_processing_authorized=true` workflow input;
- configured `OPENAI_API_KEY` repository secret;
- explicit LLM1 extraction model;
- explicit, different LLM2 review model;
- exact RA02 SourceArtifact rights for `READ_FOR_EXTRACTION`, `MODEL_EGRESS`, and `RETAIN_DERIVED`;
- the previously materialized exact RP001 authority world.

The runner drives the real pilot HTTP surface rather than calling the provider SDK directly.

## Blind independent reference packet

The live runner freezes `rp001-reference-packet.json` **after LLM1 materialization and before LLM2 begins**.

The packet contains exact candidate/context/evidence data but excludes:

- LLM2 automated dispositions;
- human source-faithful review results;
- LLM1 extraction confidence;
- LLM1 provider/model identity.

It carries:

```text
blindToAutomatedDisposition = true
frozenBeforeAutomatedReview = true
containsAutomatedDisposition = false
containsExtractionConfidence = false
containsLlm1ProviderModelIdentity = false
```

The live workflow uploads this packet as a separate reference-only artifact so independent adjudication does not need the automated-result artifact.

## Phase-A safety gate

All AUTO_ACCEPT candidates require blind independent reference adjudication. Escalations are adjudicated and AUTO_REJECT candidates are sampled for false-reject measurement.

Primary gate:

```text
FALSE_ACCEPT_COUNT == 0
```

Automation rate is secondary.

A pre-reference live run is expected to report `INCOMPLETE_REFERENCE_COVERAGE` whenever AUTO_ACCEPT exists and reference adjudication has not yet been attached. It must not be reported as Phase-A PASS merely because the automated pipeline completed.

## Current frontier

1. keep the benchmark branch on the exact green RA02 execution baseline;
2. pass zero-cost live-runner dry-run, exact materialization, and full ADR regression on one exact head;
3. explicitly dispatch the first RP001 live LLM1 → blind LLM2 run only when provider credentials/models are configured and external processing is confirmed;
4. distribute only the blind reference packet to the independent reference adjudicator;
5. attach reference annotations without mutating AuthorityLedger review results;
6. compute the first real Phase-A false-accept / false-reject / escalation / automation metrics.

No live LLM1/LLM2 result or independent reference result is claimed until the corresponding exact workflow evidence exists.
