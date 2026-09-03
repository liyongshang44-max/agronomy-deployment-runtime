# DEC-0033 Sustainable Corn Governed ContextManifest Gold — Provenance

Status: MACHINE ACCEPTANCE EVIDENCE

This Gold is cumulative and reuses the exact retained Sustainable Corn evidence world
already qualified through DEC-0031.

The imported DEC-0031 cumulative Gold constructs, in the same Node.js process and the
same AuthorityLedger, the exact retained/source-faithful chain for:

- provider: `github.com/isudatateam/datateam`
- site: `SERF`
- operation: `plant_corn`
- source date: `2011-05-03`
- target semantic: `crop.planting_date`
- source precision: DAY
- spatial support: FARM
- source-backed target identity: `target_src_<sha256>`
- ContextDatum availableAt: `2026-08-30T13:00:00.000Z`

Primary exact retained row evidence:

```text
sourceRef =
blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33

contentHash =
sha256:d27e8539ed45115419093d563cf44f0f364568efb4633781ea8120aaa2bb819f
```

DEC-0033 then appends, in that same AuthorityLedger:

```text
exact DEC-0031 ContextDatum
        +
exact DEC-0027 FARM target projection
        ↓
exact DEC-0032 DecisionProblem
        +
explicit evidenceCutoff
        ↓
standard A04 ContextManifest
```

The exact convergence gate is:

```text
DEC-0031 assembly.predecessorRefs.spatialSupportClassificationCompilationRef
==
DEC-0032 -> DEC-0027
  parentContextSpatialSupportClassificationCompilationRef
```

Equality is exact AuthorityRef equality, not semantic equality.

The Gold evidence cutoff is explicitly supplied by the manifest publisher:

```text
2026-08-30T14:00:00.000Z
```

It is not derived from the planting date, effective interval, availableAt,
DecisionProblem logicalTime/deadline, host clock, or provider latest timestamp.

The deterministic DecisionProblem fixture has:

```text
logicalTime = 2026-08-16T01:00:00Z
decisionAuthorityMode = RUNTIME_ONLY
```

Because the real-source ContextDatum was not available until
`2026-08-30T13:00:00Z`, this Gold is deliberately classified:

```text
RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD
```

It is not evidence of a contemporaneous historical SERF decision, no-lookahead
runtime, operator decision, recommendation, approval, dispatch, execution, or
outcome.

DEC-0033 creates no new convergence compilation and no bridge-specific publication
marker. A directly published standard A04 ContextManifest using the same exact
DEC-0031 ContextDatum and DEC-0032 DecisionProblem refs must validate through the
same specialized DEC-0033 validator.

Positive acceptance therefore proves:

- exact DEC-0031 specialized ContextDatum replay;
- exact DEC-0032 specialized DecisionProblem replay;
- exact shared DEC-0023 FARM lineage;
- exact source-backed farmId convergence;
- exact organization/tenant convergence;
- explicit publisher-owned evidenceCutoff;
- one datum / zero receipt first-world membership;
- standard A04 `EXACT` replay semantics;
- no hidden Agronomic compilation refs in the A04 publication input set.

Negative acceptance covers:

- generic visible-equivalent A02 without DEC-0031 proof;
- generic visible-equivalent A01 without DEC-0032 proof;
- semantically equal but different DEC-0023 AuthorityRef;
- organization mismatch;
- tenant mismatch;
- missing explicit evidenceCutoff;
- caller-supplied second datum;
- caller-supplied receipt;
- caller-supplied targetRef;
- datum available after cutoff;
- manifest publication before cutoff;
- wrong logical-id context.write authorization.

No A03 reference/receipt, RuntimeProfile, Deployment, Retrieval, Applicability,
RuntimePlan, RuntimeEligibility, RuntimeBinding, Policy execution, DecisionResult,
ExecutionReceipt, or Outcome is created by this Gold.
