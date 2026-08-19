# ADR Real-Paper Benchmark v1

Status: calibration benchmark only. This benchmark does not create scientific authority, publication authority, or GEOX production authority.

## Purpose

Measure whether the ADR extraction -> blind LLM2 source-faithful review path can transport agronomy assertions from real papers without silently expanding causal meaning, context, evidence coverage, or applicability.

The frozen corpus authority is `docs/implementation/real-paper-benchmark/corpus-v1.json`. The first baseline is RP001. `benchmarks/real-paper-v1/expansion-candidates.json` is discovery-only and cannot silently expand the corpus.

## Authority boundary

Benchmark corpus metadata and benchmark labels are reference-only.

A paper may enter ADR authority only through the normal runtime path:

1. exact Source registration;
2. exact SourceArtifact materialization and content hash;
3. applicable runtime RightsDecision(s);
4. proposal-only LLM1 extraction/import;
5. ScientificCompiler validation;
6. independent blind LLM2 source-faithful review;
7. deterministic AUTO ACCEPT / AUTO REJECT / ESCALATE_TO_HUMAN promotion;
8. SourceFaithfulReviewDecision;
9. only accepted candidates may mint Claim + SourceContext.

The benchmark must never synthesize ScientificQualificationDecision, KnowledgeRelease, ApplicabilityAssessment, RuntimeEligibility, or DecisionResult records.

## Calibration phases

### Phase A — safety calibration

For every paper in the frozen corpus:

- review every AUTO ACCEPT against the exact source with an independent reference adjudication;
- adjudicate every ESCALATE_TO_HUMAN;
- sample AUTO REJECT outcomes for false-reject measurement;
- record defect codes without repairing the machine candidate in place.

Reference adjudication must be completed **without seeing the automated LLM2 disposition**. The reference record must declare `blindToAutomatedDisposition=true` and identify the reference adjudicator. An automated promoted `SourceFaithfulReviewDecision` is never allowed to self-label itself as benchmark reference truth.

Primary safety gate:

`FALSE_ACCEPT_COUNT == 0`

A false accept is an automated ACCEPT that the independent reference adjudication rejects as source-unfaithful.

Automation rate is secondary to false-accept control.

### Phase B — coverage calibration

After Phase A has zero false accepts on the frozen corpus, explicitly promote additional papers from the discovery candidate set and repeat the same protocol. Measure:

- auto-resolution rate;
- auto-accept rate;
- auto-reject rate;
- escalation rate;
- compiler-invalid rate;
- false-reject rate on adjudicated AUTO REJECT samples;
- defect-code distribution;
- per-claim-type and per-stress-dimension performance.

### Phase C — qualification research

Out of scope for this benchmark. Source-faithful automation results do not justify automated Scientific Qualification.

## Run modes and exact evidence

Every run declares `runMode`.

`FIXTURE` is for deterministic contract acceptance only. It may omit runtime evidence and is always reported with:

`exactEvidenceGate = FIXTURE_NOT_REAL_EVIDENCE`

`REAL` is the only mode that may count as real-paper benchmark evidence. A REAL run is rejected unless it binds:

- exact repository full name;
- exact 40-character code head SHA;
- `rightsEnforcement = RA02_EXACT_SUBJECT_FAIL_CLOSED`;
- exact Source authority ref for every paper;
- exact SourceArtifact authority ref for every paper;
- exact PDF `contentHash`;
- exact positive `byteLength`;
- exact `RETAIN_FULLTEXT` RightsDecision ref.

A valid REAL run reports:

`exactEvidenceGate = PASS`

This gate is independent from the Phase-A false-accept gate. A run can have exact execution evidence but still fail source-faithful calibration, and vice versa.

`benchmarks/real-paper-v1/real-execution-evidence-template.json` is a non-authoritative template for assembling this exact evidence after the rights-enforced pilot materializes a paper.

## Run record

A REAL benchmark run JSON uses `adr.real-paper-benchmark-run.v1` and has this shape:

```json
{
  "runVersion": "adr.real-paper-benchmark-run.v1",
  "benchmarkVersion": "adr.real-paper-benchmark.v1",
  "runMode": "REAL",
  "runId": "...",
  "execution": {
    "repositoryFullName": "liyongshang44-max/agronomy-deployment-runtime",
    "codeHeadSha": "<exact 40-char SHA>",
    "rightsEnforcement": "RA02_EXACT_SUBJECT_FAIL_CLOSED"
  },
  "papers": [
    {
      "paperId": "RP001",
      "evidence": {
        "sourceRef": { "kind": "Source", "logicalId": "...", "version": "...", "semanticHash": "sha256:..." },
        "sourceArtifactRef": { "kind": "SourceArtifact", "logicalId": "...", "version": "...", "semanticHash": "sha256:..." },
        "contentHash": "sha256:...",
        "byteLength": 123456,
        "retentionRightsDecisionRef": { "kind": "RightsDecision", "logicalId": "...", "version": "...", "semanticHash": "sha256:..." }
      },
      "candidates": [
        {
          "candidateKey": "...",
          "claimType": "PARAMETER",
          "compilerStatus": "REVIEWABLE",
          "automatedStatus": "AUTO_ACCEPTED",
          "referenceDisposition": "ACCEPT_SOURCE_FAITHFUL",
          "defectCodes": []
        }
      ]
    }
  ]
}
```

Allowed `compilerStatus`:

- `REVIEWABLE`
- `INVALID`

Allowed `automatedStatus` for REVIEWABLE candidates:

- `AUTO_ACCEPTED`
- `AUTO_REJECTED`
- `ESCALATED_TO_HUMAN`
- `ESCALATED_PENDING_HUMAN`
- `SKIPPED_ALREADY_REVIEWED`

Allowed `referenceDisposition`:

- `ACCEPT_SOURCE_FAITHFUL`
- `REJECT_SOURCE_FAITHFUL`
- `null` when not independently adjudicated yet.

`defectCodes` are benchmark/reference labels only. They must not rewrite or mutate the original ClaimCandidate.

Reference annotations use `adr.real-paper-reference-annotation.v1` and remain outside AuthorityLedger. The benchmark exporter refuses annotations that are not explicitly blind to the automated disposition.

## Recovery exporter

`scripts/real-paper-benchmark/from-recovery.mjs` exports the selected compilation without re-importing or rewriting it.

Without a real-execution evidence sidecar, it emits a `FIXTURE` run. With an exact evidence sidecar it emits `REAL`; the summarizer then validates code head, RA02 marker, Source/SourceArtifact refs, PDF hash/length, and retention RightsDecision before accepting the run shape.

The exporter never derives benchmark reference truth from ADR's automated or human SourceFaithfulReviewDecision. Reference labels must still arrive through the separate blind annotation file.

## Metrics

The deterministic summarizer reports:

- rawCandidateCount;
- reviewableCount;
- invalidCount;
- autoAcceptedCount;
- autoRejectedCount;
- escalatedCount;
- skippedCount;
- autoResolutionRate = (AUTO_ACCEPTED + AUTO_REJECTED) / REVIEWABLE;
- escalationRate = escalated / REVIEWABLE;
- referenceAdjudicatedCount;
- automatedAgreementCount;
- falseAcceptCount;
- falseRejectCount;
- falseAcceptRate = falseAccept / reference-adjudicated AUTO ACCEPT;
- falseRejectRate = falseReject / reference-adjudicated AUTO REJECT.

An ESCALATE is not scored as an automated error. It is a safe abstention that requires reference adjudication.

## Corpus handling

`docs/implementation/real-paper-benchmark/corpus-v1.json` is the only frozen v1 corpus authority. `benchmarks/real-paper-v1/expansion-candidates.json` is discovery-only.

Neither file grants operational rights or contains publication full text. Before any PDF bytes are retained or sent to an external model, the runtime Rights Engine remains authoritative. Corpus membership never overrides `UNKNOWN = DENY` or any explicit rights decision.

## Benchmark completion criterion

The current frozen corpus is not calibrated until:

1. every paper in the corpus authority is represented by a REAL run with `exactEvidenceGate = PASS`;
2. every REAL run binds exact RA02 code head and exact SourceArtifact content hash/byteLength;
3. all AUTO ACCEPT candidates have blind independent reference adjudication;
4. `falseAcceptCount == 0` across the frozen corpus;
5. escalation reasons are categorized rather than silently repaired;
6. the report is reproducible from committed run JSON plus exact authority refs and code head.

Expansion from RP001 to additional papers is a separate explicit corpus-authority change, not an implicit side effect of discovering candidate papers.
