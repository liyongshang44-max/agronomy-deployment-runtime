# ADR Real-Paper Benchmark v1

Status: calibration benchmark only. This benchmark does not create scientific authority, publication authority, or GEOX production authority.

## Purpose

Measure whether the ADR extraction -> blind LLM2 source-faithful review path can transport agronomy assertions from real papers without silently expanding causal meaning, context, evidence coverage, or applicability.

The benchmark intentionally includes papers that stress crop identity, phenology, water thresholds, nitrogen management, treatment interactions, measurement semantics, remote sensing, model evaluation, and external-validity boundaries.

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

For every paper:

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

After Phase A has zero false accepts on a sufficiently broad corpus, measure whether the system is useful rather than merely conservative:

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

## Run record

A benchmark run JSON must use `adr.real-paper-benchmark-run.v1` and contain:

```json
{
  "runVersion": "adr.real-paper-benchmark-run.v1",
  "benchmarkVersion": "adr.real-paper-benchmark.v1",
  "runId": "...",
  "papers": [
    {
      "paperId": "...",
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

`corpus.json` contains discovery metadata only. It does not grant rights and does not contain publication full text.

Before any PDF bytes are retained or sent to an external model, the runtime Rights Engine remains authoritative. Corpus membership never overrides `UNKNOWN = DENY` or any explicit rights decision.

## Benchmark completion criterion

v1 is not considered calibrated until:

1. all eight corpus papers have exact SourceArtifact hashes recorded in run evidence;
2. all AUTO ACCEPT candidates have blind independent reference adjudication;
3. `falseAcceptCount == 0` across the calibration set;
4. escalation reasons are categorized rather than silently repaired;
5. the report is reproducible from committed run JSON plus exact code head.
