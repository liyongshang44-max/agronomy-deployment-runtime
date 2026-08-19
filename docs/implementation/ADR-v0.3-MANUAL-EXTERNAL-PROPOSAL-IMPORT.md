# ADR v0.3 — Manual External Proposal Import

Status: PILOT OPERATOR WORKFLOW — NON-AUTHORITY TRANSPORT

## Purpose

This workflow imports structured claim proposals produced outside ADR (for example by a web-hosted LLM) without granting that output scientific authority.

The transport is explicitly:

```text
exact SourceArtifact
→ external model used by operator
→ JSON copied by operator
→ ADR manual import preflight
→ only compiler-valid candidates
→ ScientificCompiler
→ ClaimCandidate + SourceContextCandidate
→ human source-faithful review
```

The external model output is never silently repaired, retyped, or promoted to Claim authority.

## Endpoint

```text
POST /operator/source-uploads/{uploadId}/import-proposal
Authorization: Bearer <ADR_OPERATOR_TOKEN>
Content-Type: application/json
```

Request:

```json
{
  "providerLabel": "DEEPSEEK_WEB",
  "modelLabel": "deepseek-v4-pro",
  "proposal": {
    "claims": []
  }
}
```

`providerLabel` and `modelLabel` are operator-declared metadata. ADR records model identity authority as `OPERATOR_DECLARED_NOT_VERIFIED`.

## Preflight semantics

Each raw claim is dry-run through the real `ScientificCompiler` in a cloned `AuthorityLedger`.

A candidate classified `INVALID` does not enter the real authority ledger. ADR does not coerce unsupported claim types or repair malformed source context.

Duplicate claim keys are classified invalid before materialization.

If at least one candidate is reviewable, only reviewable candidates are materialized into a `ScientificCompilationResult` with output authority `PROPOSAL_ONLY`.

The import metadata records a canonical hash of the entire external proposal plus original and invalid candidate counts.

## First real-paper benchmark expectation

For the first DeepSeek output generated from `2211.16938v1.pdf`, the current architecture predicts:

```text
total candidates      = 6
reviewable by schema  = 5
invalid by schema     = 1
```

The invalid candidate is expected to be the NDVI proxy candidate because it declares:

```text
claimType = MEASUREMENT
```

`MEASUREMENT` is not an allowed ADR `ClaimCandidate` type in the current frozen compiler taxonomy. The importer must report `INVALID_CLAIM_CANDIDATE_TYPE`; it must not silently map that candidate to another type.

Schema-valid candidates can still be scientifically or source-faithfully wrong. Preflight does not replace human review. For example, a semantically overstated refutation claim may pass compiler schema and still require `REJECT_SOURCE_FAITHFUL` during review.

## Authority nonclaims

Manual import does not establish:

- source-faithful Claim authority;
- scientific qualification;
- applicability authority;
- deployment/runtime authority;
- model identity verification;
- external-provider provenance beyond operator-declared metadata and imported payload hash.
