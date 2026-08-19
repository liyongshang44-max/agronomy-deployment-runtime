# Agronomy Deployment Runtime — Conversation Handoff — 2026-08-20

Status: **CONVERSATION HANDOFF ONLY — NOT ARCHITECTURE AUTHORITY**

This handoff supersedes `docs/handoff/ADR-HANDOFF-2026-08-18.md` / Draft PR #55 as the current conversation-resumption document.

PR #55 remains useful historical context for the v0.3 paid-pilot release frontier, but its implementation state is materially stale. This handoff exists so the next conversation can resume without reconstructing the large-PDF ingestion work, first real-paper benchmark, LLM2 blind source-faithful review, Rights Authority correction, RA02 pre-effect enforcement, the product-direction correction back toward “paper → agronomic knowledge → GEOX field context → agronomic advice”, or the current RP001 live LLM1→LLM2 calibration frontier.

If this handoff conflicts with Frozen Architecture v1.0, Final Adjudication, Master Task Line, Version Slicing, merged implementation contracts, live repository facts, exact PR heads, or exact CI evidence, the higher authority wins.

---

## 0. Repository / branch / PR facts at handoff

Repository:

```text
liyongshang44-max/agronomy-deployment-runtime
```

Actual/default `main` at this handoff:

```text
80aafc9f25a184801a221fe2dbf2126fcd05a02f
```

That main includes two important post-v0.3 changes from this conversation:

```text
PR #57
feat(rights): establish fail-closed rights authority foundation
merge: 38e66a60c603b42cc9a72d377abc4a3bbdb75b31

PR #63
ops(actions): enable RP001 live workflow dispatch
merge: 80aafc9f25a184801a221fe2dbf2126fcd05a02f
```

PR #63 is intentionally only a default-branch workflow-dispatch registration stub. It does not merge the benchmark implementation stack into main and does not itself execute a model.

### Current unmerged product/benchmark stack

The authoritative open stack for the work in this conversation is:

```text
main
  ↓
#56  feat/v0.3-pilot-application-source-ingestion
  ↓
#60  feat/automated-source-faithful-review
  ↓
#62  feat/rights-ra02-source-egress-enforcement
  ↓
#61  feat/real-paper-benchmark-v1
```

Exact live PR facts at handoff:

```text
PR #56 — feat(pilot): add large-PDF source ingestion host
state: OPEN / DRAFT
head branch: feat/v0.3-pilot-application-source-ingestion
head: b513a98616273b2979bc6fad575ac9e24e5168b1
base: main
role: large-PDF ingestion, retained SourceArtifact, manual external proposal import,
      restart-durable source-faithful review, prompt-v3 experiment substrate

PR #60 — feat(review): add automated blind source-faithful second review
state: OPEN / DRAFT
head branch: feat/automated-source-faithful-review
head: 023964c6cf5abe15f4ee255dfe15e29ee9b660da
base: #56 branch
role: LLM2 blind source-faithful review + batch/resume + Workbench integration

PR #62 — feat(rights): enforce source/read/model-egress side effects
state: OPEN / DRAFT
head branch: feat/rights-ra02-source-egress-enforcement
head: fd64f9553e7e8ef6990d6b1d184a09c7616420e2
base: #60 branch
role: RA02 exact pre-effect rights enforcement on retention/read/egress/derived retention

PR #61 — feat(benchmark): establish real agronomy paper calibration corpus
state: OPEN / DRAFT
head branch: feat/real-paper-benchmark-v1
head: d45fbc3562a51fcb51d69d282bff7f009dc7cd05
base: #62 branch
role: exact RP001 corpus/materialization + live LLM1→blind-LLM2 benchmark + reference protocol
```

Current exact #61 CI on `d45fbc3562a51fcb51d69d282bff7f009dc7cd05`:

```text
ADR Constitution
run: 32266158355
run number: 1238
result: SUCCESS

ADR Real Paper Benchmark
run: 32266157341
run number: 92
result: SUCCESS
```

### Stale PRs that must not be resumed

The following open Draft PRs are historical/diagnostic only and must not be treated as current frontier:

```text
PR #58 — feat(rights): enforce rights before source and model side effects
head: ccd23a0362e358684ec62040b3fe4e6783a38ed4
status: superseded by the cleaner RA02 implementation in PR #62

PR #59 — debug(ci): isolate RA02 host boundary failure
head: 439500c2e23a10e45bb74e83b34deb2deccf8d17
status: temporary diagnostics only; never merge

PR #55 — docs(handoff): record v0.3 paid-pilot release frontier
head: 42792f241bc04ddc2bad08a3555c61fb73ada996
status: superseded by this handoff
```

The next conversation must read current live PR/head facts before acting. PR bodies may contain stale embedded “current head” prose after later commits; GitHub live refs are higher authority.

---

# 1. Authority order — unchanged

The authority order remains:

```text
Frozen Architecture v1.0
  > Final Architecture / Capability adjudication
  > Capability Map
  > Master Task Line
  > Version Slicing
  > merged implementation contracts / exact repository facts
  > current live PR / exact CI evidence
  > conversation handoff
```

Core governing files remain the same architecture/planning set referenced by the 2026-08-18 handoff.

Permanent rule:

> Do not encode a product or implementation reinterpretation as if it were existing architecture authority. If a missing predecessor authority is discovered, repair/version that predecessor explicitly.

This conversation added one especially important operational rule:

> Do not confuse a stronger governance mechanism with the product North Star. Rights, provenance, audit and replay exist to support the agronomic-knowledge product; they must not displace the paper→knowledge→field-context→advice product path.

---

# 2. Product-direction correction — this is the most important conceptual handoff

During this conversation the work temporarily drifted toward treating ADR primarily as an enterprise Authority/Rights platform.

That was corrected.

The user’s actual product intent is:

```text
papers / agronomy protocols / experiments
        ↓
source-faithful scientific extraction
        ↓
reviewed / qualified agronomic knowledge
        ↓
GEOX provides current field context
crop + phenology + soil + weather + forecast + satellite + management
        ↓
ADR applicability / agronomic reasoning
        ↓
current agricultural advice
+ next action
+ next observation / information request
+ exact scientific evidence
```

The intended relationship is therefore:

```text
ADR
= Scientific Knowledge Compiler
+ Agronomic Knowledge Registry
+ Applicability / Agronomic Reasoning Runtime

GEOX
= field/digital-twin context provider
+ soil/weather/satellite/management/execution state
```

ADR must not become “a generic RAG that reads PDFs at decision time”.

Production reasoning should be based on already-governed knowledge and exact current field context:

```text
KnowledgeRelease
+
FieldContext / ContextManifest
+
DecisionProblem
        ↓
Applicability
        ↓
Recommendation / ASK / WAIT / ABSTAIN as governed downstream authority permits
        ↓
Evidence
```

The near-term product proof should be narrow rather than universal. The recommended first GEOX-facing agronomic scenario is irrigation/crop-water reasoning because GEOX already has strong soil/weather/ET0/rainfall/digital-twin context.

Rights is retained as necessary infrastructure, but **Rights is no longer the product-development mainline**.

---

# 3. What this conversation actually accomplished

This conversation began from the 2026-08-18 handoff, after the v0.3 paid-pilot release work.

The major progression was:

```text
local pilot host brought up
        ↓
large PDF ingestion tested
        ↓
real external LLM extraction attempted
        ↓
network/provider failures separated from ADR failures
        ↓
manual external web-model import exercised
        ↓
first real-paper source-faithful benchmark
        ↓
DeepSeek / KIMI / Model-C comparison
        ↓
prompt-v3 atomic single-locator correction
        ↓
LLM2 automated blind source-faithful second review
        ↓
Rights Authority foundation (RA01)
        ↓
product-direction correction: Rights back to infrastructure
        ↓
RA02 pre-effect source/read/model-egress enforcement
        ↓
real-paper calibration corpus
        ↓
RP001 exact PDF materialization + content pinning
        ↓
blind independent reference protocol
        ↓
live LLM1→LLM2 workflow prepared
        ↓
default-branch workflow-dispatch registration merged
        ↓
CURRENT: first explicit RP001 live model run
```

Do not restart from “how do we upload PDFs?” or “should review be manual?”. Those questions were answered by implementation in this conversation.

---

# 4. Local pilot host / large-PDF ingestion — operational findings

The user cloned the repository locally and successfully brought up the pilot host.

Representative runtime startup showed:

```text
ADR pilot API listening on http://127.0.0.1:8787
Max source upload bytes: 1073741824
Source-faithful review: ENABLED
Authority persistence: LOCAL_CHECKPOINT_RESTART_DURABLE_V1
```

Large PDF ingestion and restart recovery were exercised against a real PDF.

Important distinctions established:

```text
LOCAL_CHECKPOINT_RESTART_DURABLE_V1
!= operator token
```

It is the persistence/recovery mode.

The operator bearer token is separately generated and supplied through `ADR_OPERATOR_TOKEN`.

The real extraction path initially hit provider/network errors such as:

```text
OPENAI_NETWORK_FAILURE
FILES_UPLOAD
UND_ERR_CONNECT_TIMEOUT
```

These were correctly separated from compiler/source-faithful failures.

The conversation also established that “no OpenAI quota” and “network timeout” are different failure classes and must not be inferred from one another.

When the direct provider route was unreliable, manual external model proposal import was used so the scientific extraction/review pipeline itself could still be tested without pretending the external web model was an ADR-controlled provider execution.

---

# 5. First real-paper benchmark — `2211.16938v1.pdf`

The first live calibration paper used through the pilot was:

```text
2211.16938v1.pdf
Evaluating Digital Agriculture Recommendations with Causal Inference
```

This paper was useful because it contains:

```text
operational sowing rules
field observational data
causal-effect estimates
propensity-score diagnostics
refutation tests
external-validity limits
measurement/proxy claims
```

It exposed exactly the provenance/context failures ADR is intended to catch.

## DeepSeek web run #1 — frozen historical result

```text
raw candidates: 6
compiler REVIEWABLE: 5
compiler INVALID: 1
source-faithful ACCEPT: 1
source-faithful REJECT: 4
```

Accepted:

```text
causal-graph-assumption-constant-management
MODEL_ASSUMPTION
```

Key reject classes included:

```text
material causal-context omission
refutation overstatement / outcome collapse
paired management-context evidence binding incomplete
temporal semantic expansion
incomplete claim-level evidence coverage
```

## KIMI web run #1

```text
raw output captured
status: SKIPPED_NOT_ADJUDICATED
```

Do not include it in adjudicated benchmark denominators.

## Model C web run #1 — frozen historical result

```text
raw candidates: 8
compiler REVIEWABLE: 8
compiler INVALID: 0
source-faithful ACCEPT: 0
source-faithful REJECT: 8
authority minted: none
```

This must **not** be interpreted as “Model C understood nothing”.

Its dominant failure mode was:

```text
substantively strong compound assertion
+
one too-narrow claim-level evidenceText
=
REJECT_SOURCE_FAITHFUL
```

Examples included dataset count + yield range, model metrics + trimming result, treatment/control paired definitions, multiple refutation outcomes, causal estimate + relative interpretation, and external-validity explanation.

The key lesson was:

> Model quality and provenance granularity are separate axes.

---

# 6. Prompt-v3 correction — atomic single-locator experiment

Before changing the frozen Claim schema, the conversation deliberately tested whether better extraction discipline could eliminate many evidence-binding failures.

Frozen contract:

```text
promptVersion: adr-paper-extraction-prompt-v3
profile: ADR_ATOMIC_SINGLE_LOCATOR_V3
```

Core rules:

```text
one Claim = one independently reviewable assertion
one claim-level evidenceText must cover every material proposition in that assertion
SourceContext locators may not repair incomplete claim-level evidence
if support is disjoint, split the claim when semantically valid; otherwise abstain
never drop timing/window/comparator/unit/design qualifiers
paired definitions cannot cite only one branch
causal wording cannot omit material source qualifiers if omission strengthens the claim
```

A critical benchmark-integrity incident occurred during development:

- an early prompt draft accidentally used examples derived from the benchmark paper;
- it was rejected before use;
- the final prompt uses unrelated synthetic examples;
- acceptance fails if paper-specific signatures leak into the canonical prompt.

Permanent lesson:

> Never “improve” a benchmark prompt using examples from the paper being benchmarked.

The conversation intentionally did **not** add multi-locator Claim evidence authority merely to make Model C pass. Multi-locator evidence remains a future governed design question only if clean atomic prompting still cannot represent important scientific assertions.

---

# 7. LLM2 automated source-faithful second review — PR #60

The user correctly identified that the existing “human review” workflow was functionally:

```text
LLM1 extracts
→ user screenshots candidate
→ second LLM re-reads source and judges it
→ user clicks ACCEPT/REJECT
```

The useful human contribution was mostly transport/clicking, not the second semantic pass.

That was formalized in PR #60.

Current intended flow:

```text
exact PDF
+
ClaimCandidate
+
SourceContextCandidate
        ↓
LLM2 blind falsification
        ↓
AutomatedSourceFaithfulReviewProposal
(PROPOSAL_ONLY)
        ↓
deterministic promotion
        ├─ AUTO ACCEPT
        ├─ AUTO REJECT
        └─ ESCALATE_TO_HUMAN
```

LLM2 is not asked to re-extract or repair a candidate. Its task is adversarial/falsification-oriented.

Frozen review dimensions include:

```text
ASSERTION_SUPPORT
CONTEXT_COMPLETENESS
EVIDENCE_COVERAGE
CAUSALITY_FIDELITY
TEMPORAL_FIDELITY
POPULATION_FIDELITY
GEOGRAPHY_FIDELITY
MANAGEMENT_FIDELITY
MEASUREMENT_FIDELITY
CLAIM_ATOMICITY
UNSUPPORTED_INFERENCE
```

Important authority boundary:

```text
AUTO ACCEPT
→ may create source-faithful Claim + SourceContext through the existing governed review path

AUTO ACCEPT
!= Scientific Qualification
```

Acceptance explicitly proves:

```text
AUTO ACCEPT
→ ScientificQualificationDecision count remains 0
```

Human review remains for escalation/ambiguity.

This is the intended scalable pattern:

```text
clear pass   → automatic source-faithful accept
clear fail   → automatic source-faithful reject
ambiguous    → human review
```

Do not call LLM2 review “human review” in authority records.

---

# 8. LLM2 blindness / correlated-error lessons

The LLM2 review path was hardened specifically against correlated-review side channels.

The provider-facing LLM2 packet hides:

```text
LLM1 provider/model identity
LLM1 confidence
LLM1 rationale
SourceContext dimension confidence
Authority logical IDs
source/original filename
```

Provider-facing PDF filename is neutralized.

The reviewer still receives the exact PDF plus the candidate assertion/context/evidence required to falsify it.

Model independence semantics are intentionally nuanced:

```text
RUNTIME_RECORDED_PROVIDER_MODEL
= model identity recorded directly by ADR runtime

OPERATOR_DECLARED_NOT_VERIFIED
= manual web-model provider/model label supplied by operator
  useful for obvious same-model independence checks
  but never promoted to verified provider identity

UNKNOWN / placeholder identity
= force ESCALATE
```

Therefore a manual import such as a clearly declared DeepSeek model may be reviewed by a distinctly identified LLM2 without forcing everything to human review, while an `UNKNOWN_MODEL` import escalates.

Same identified model also escalates.

Permanent lesson:

> “two passes” is not enough if both passes are effectively the same model with shared clues. Blindness and model-identity separation are part of review quality.

---

# 9. Rights Authority — useful correction, but not the product North Star

This conversation introduced Rights Authority because real PDF retention/model egress exposed a genuine commercial/security gap.

The correct Authority DAG framing is:

```text
Source / SourceArtifact
      ├──────── Rights Authority ────────┐
      │                                  │
      ↓                                  │
ClaimCandidate → review → qualified knowledge
                           ↓
                       applicability
                           ↓
                    KnowledgeRelease
                           ↓
                    runtime / decision
```

The arrow means:

> Without exact predecessor authority, the downstream operation is not eligible to occur.

But the conversation later corrected an over-expansion tendency:

> Rights is infrastructure supporting the agronomic-knowledge product. Do not continue building Rights/enterprise governance merely because it is architecturally interesting.

## RA01 — PR #57 — merged

Merged authority foundation includes:

```text
RightsPolicy
RightsGrant
RightsDecision
RightsRevocation
```

Key semantics:

```text
UNKNOWN / no grant = DENY
execution-facing RightsDecision = ALLOW | DENY
Source rights do not silently inherit to SourceArtifact
point-in-time decisions
expiry/revocation replay semantics
mandatory obligations preserved
closed semantic shapes
```

Rights and platform Authorization remain different questions:

```text
Authorization:
may this principal perform this platform operation?

Rights:
may these exact source bytes be used for this operation/purpose/jurisdiction/time?
```

## RA02 — PR #62 — current frozen stacked implementation

RA02 corrected a critical execution-order bug discovered in #56:

Old order:

```text
create upload
→ bytes enter CAS
→ finalize
→ only then Source exists
```

That cannot enforce `RETAIN_FULLTEXT` against an exact Source because the subject does not yet exist.

Corrected order:

```text
create session
→ pre-register exact logical Source
→ exact Source RETAIN_FULLTEXT RightsDecision
→ only then retain PDF bytes
→ materialize exact SourceArtifact
```

SourceArtifact rights are provisioned separately.

Dangerous operations now include:

```text
RETAIN_FULLTEXT
READ_FOR_EXTRACTION
MODEL_EGRESS
RETAIN_DERIVED
```

The actual side effect occurs only after exact ALLOW.

`externalProcessingAuthorized=true` remains operator consent/intent only. It is not permission authority.

RA02 exact frozen head:

```text
fd64f9553e7e8ef6990d6b1d184a09c7616420e2
```

Its dedicated and full-root CI were frozen green before #61 was based on it.

Do not reopen broader Rights roadmap items now. Qualification-rights binding, release-rights gates, self-service rights administration and DecisionEvidenceBundle are not the current product frontier.

---

# 10. Real-paper calibration corpus — PR #61

After LLM2 automation existed, the frontier shifted from building review machinery to measuring whether it is actually safe on real agronomy papers.

Frozen corpus authority:

```text
docs/implementation/real-paper-benchmark/corpus-v1.json
```

Current frozen baseline contains one paper:

```text
RP001
Seedling-Stage Deficit Irrigation with Nitrogen Application in Three-Year Field Study Provides Guidance for Improving Maize Yield, Water and Nitrogen Use Efficiencies
```

RP001 was selected because it is much closer to the intended GEOX agronomy use case than the earlier digital-sowing benchmark paper.

It contains real field agronomy around:

```text
maize
deficit irrigation
nitrogen application
multi-year field evidence
water-use efficiency
nitrogen-use efficiency
yield response
```

The expansion-candidate list contains additional discovery papers, but they are **not** silently part of the frozen corpus. Corpus promotion must be explicit.

---

# 11. RP001 exact PDF identity — already materialized, no LLM claimed

RP001 has been materialized repeatedly through the rights-enforced production path.

Frozen publisher PDF content identity:

```text
PMCID: PMC9656380
license/source metadata: CC_BY_4_0

contentHash:
sha256:0e17a738d09b6d6638b103ce6a7b979cb9c7b2d9011e449ccdbc5d585dea6cab

byteLength:
6045990
```

This hash/length are now pinned in the frozen corpus.

Acquisition/materialization fails closed before Rights retention if future PMC/publisher acquisition returns different bytes.

Materialization path:

```text
official PMC OA acquisition
→ exact Source
→ RETAIN_FULLTEXT RightsDecision
→ retained content-addressed storage
→ SourceArtifact
→ durable checkpoint / benchmark evidence artifact
```

Important distinction:

```text
same PDF bytes
→ same contentHash / byteLength

new materialization execution world
→ SourceArtifact/rights publication refs may differ because run metadata differs
```

The materialization workflow configures no LLM provider and explicitly asserts that no LLM execution occurred.

Do not claim that RP001 has already completed LLM1/LLM2 merely because materialization is green.

---

# 12. Blind independent reference protocol

The benchmark does not use ADR’s own LLM2 disposition as its reference truth.

Otherwise the benchmark would be self-validating.

Correct order:

```text
LLM1 extraction completes
        ↓
freeze rp001-reference-packet
        ↓
independent reference adjudication
        ↓
freeze reference annotation
        ↓
only then inspect LLM2 automated result
        ↓
join reference labels to automated outcomes
        ↓
compute Phase-A metrics
```

The reference packet is frozen **before LLM2 begins** and excludes:

```text
LLM2 disposition
existing automated/human review state
extraction confidence
LLM1 provider/model identity
```

Reference workflow is two-stage:

```text
reference packet
→ worksheet with empty verdicts
→ blind adjudication
→ finalized reference annotation
```

The finalizer fails closed if:

```text
reference reviewer indicates automated result was viewed
reference packet contains prohibited automated-review side channels
REFERENCE_REJECT lacks defect codes
```

Only after reference annotation is frozen may the automated-result artifact be opened.

---

# 13. Phase-A benchmark success criteria

Primary safety gate:

```text
FALSE_ACCEPT_COUNT == 0
```

Automation rate is secondary.

The benchmark reports:

```text
raw/reviewable/invalid counts
AUTO ACCEPT
AUTO REJECT
ESCALATE
SKIP
auto-resolution rate
escalation rate
independent reference coverage
false-accept count/rate
false-reject count/rate
per-paper distributions
claim-type distributions
defect-code distributions
phaseASafetyGate
```

Possible Phase-A outcomes:

```text
PASS
INCOMPLETE_REFERENCE_COVERAGE
FAIL
```

Benchmark metrics carry an explicit non-authority boundary:

```text
BENCHMARK_METRICS_ARE_NOT_SCIENTIFIC_AUTHORITY
```

Do not optimize for high automatic acceptance at the cost of source-faithful precision. Safe abstention/escalation is preferable to false acceptance.

---

# 14. Current live workflow — exact frontier when this conversation ends

The code-side preparation for the first real RP001 LLM1→blind-LLM2 run is complete.

The workflow is:

```text
ADR RP001 Live LLM1-LLM2 Benchmark
.github/workflows/rp001-live-benchmark.yml
```

The default branch now contains the safe dispatch registration stub via PR #63, so GitHub can legally receive `workflow_dispatch`.

The actual production workflow definition exists on:

```text
feat/real-paper-benchmark-v1
```

It is **workflow_dispatch only**.

Pushes must never send RP001 PDF bytes to an external model or spend provider credits.

Required dispatch inputs:

```text
external_processing_authorized = true
extraction_model = explicit model string
review_model = explicit different model string
rights_jurisdiction = explicit string (default UNSPECIFIED)
```

Repository secret required:

```text
OPENAI_API_KEY
```

The workflow itself fails if LLM1 and LLM2 declared model strings are identical.

Do not freeze model names into this handoff as authority. Model availability is execution-time provider state and must be checked when dispatching.

Current GitHub connector limitation in this development environment:

```text
can inspect workflows / runs / jobs / artifacts
can rerun existing jobs in some contexts
cannot create a new workflow_dispatch event
```

Therefore the **single current external action** is:

1. open GitHub Actions;
2. choose `ADR RP001 Live LLM1-LLM2 Benchmark`;
3. choose branch `feat/real-paper-benchmark-v1`;
4. explicitly authorize external processing;
5. provide two distinct currently supported model strings;
6. run workflow.

Direct Actions workflow URL:

```text
https://github.com/liyongshang44-max/agronomy-deployment-runtime/actions/workflows/rp001-live-benchmark.yml
```

No successful live external LLM run is claimed by this handoff unless live GitHub evidence newer than this document proves otherwise.

---

# 15. Exact post-dispatch sequence — do not break benchmark blindness

After the first live workflow completes, the next conversation must **not immediately open the automated-result artifact**.

Required order:

```text
1. verify exact run SHA / workflow result
2. retrieve exact RP001 materialization evidence
3. retrieve ONLY rp001-reference-packet-<sha>
4. do not open rp001-live-llm1-llm2-<sha>
5. complete blind reference worksheet against exact PDF
6. freeze/finalize reference annotation
7. only then retrieve automated-result artifact
8. apply reference annotation deterministically
9. compute first real Phase-A metrics
10. inspect false accepts before celebrating automation rate
```

If any AUTO ACCEPT is independently REFERENCE_REJECT:

```text
falseAcceptCount > 0
→ Phase-A FAIL
```

Do not reinterpret a false accept as “close enough”.

---

# 16. Scientific Qualification remains separate

A major conceptual boundary from this conversation must survive the handoff:

```text
source-faithful review asks:
“Does the source actually support this Claim + SourceContext?”

scientific qualification asks:
“Is this evidence scientifically good enough for a declared use?”
```

LLM2 automates only the first question.

Even if source-faithful AUTO ACCEPT is excellent, it does not automatically decide:

```text
study design quality
causal identification quality
external validity sufficiency
conflicting literature
scientific-use entitlement
production-use suitability
```

Those remain downstream Scientific Qualification concerns.

Do not create a three-model “committee” or automated scientific-qualification system before source-faithful calibration data justifies it.

---

# 17. GEOX integration — where this should go after paper calibration

Once the paper→knowledge path is calibrated, the intended product path returns to GEOX.

GEOX should supply a governed target field context such as:

```text
crop
cultivar/hybrid where known
phenological stage
soil properties
root-zone / measured soil-water state
weather observations
weather forecast
rainfall history
ET0 / water-demand context
satellite/remote-sensing observations
management / irrigation history
```

ADR should then ask:

```text
which qualified knowledge is relevant?
which source conditions match?
which are missing?
which conflict?
which require calibration or bounded extrapolation?
what additional field observation is required?
```

The system should be capable of returning:

```text
recommendation / governed downstream decision output
OR
ASK for missing context
OR
ABSTAIN / NO LEGAL RUNTIME when evidence is not transportable
```

A useful first real GEOX-facing demonstration should be narrow:

```text
current crop-water / irrigation question
+
real field context
+
qualified literature-derived knowledge
→
current advice + next observation/action + exact evidence chain
```

Do not start with “general agronomic chatbot”.

---

# 18. Local operator evidence from the end of this conversation

The user reported a full local root test using Volta Node:

```text
volta which node
→ .../Volta/tools/image/node/24.19.0/node.exe

npm test
→ full root suite shown passing through Constitution, Authority, Authorization,
   Source, ingestion/extraction, source-faithful, qualification, derived knowledge,
   release, context, applicability, runtime, decision, operations, public API,
   reference integration, v0.3 pilot release and GEOX adapter acceptance.
```

Treat this as useful local operator evidence, **not repository release authority**, because the pasted terminal log did not record `git rev-parse HEAD` immediately beside that test run.

The next conversation should not infer an exact tested commit from the local log alone.

---

# 19. Important pitfalls discovered in this conversation

## 19.1 Do not let Rights become the project

Rights work was valuable because it found real retention/egress authority gaps.

But the product is still:

```text
paper → agronomic knowledge → field context → agronomic reasoning/advice
```

not:

```text
build an ever-larger rights/governance platform before agronomic value is proven
```

## 19.2 Do not equate “schema valid” with “source faithful”

A compiler-valid candidate may still omit timing, management, population, geography, measurement or causal qualifiers.

## 19.3 Do not let SourceContext evidence repair an incomplete Claim locator

Claim-level evidence must support the whole material assertion under the current single-locator contract.

## 19.4 Do not silently rewrite an LLM candidate during review

Reviewer fixes would erase the distinction between extraction quality and review quality.

## 19.5 Do not use model confidence as review evidence

LLM2 is deliberately blind to LLM1 confidence/rationale.

## 19.6 Do not trust same-model double pass as independence

Same identified model escalates.

## 19.7 Manual web-model identity is not provider-verified identity

`OPERATOR_DECLARED_NOT_VERIFIED` must remain visible.

## 19.8 Do not perform retention before exact Source authority exists

This was the core RA02 ordering bug.

## 19.9 Do not treat external-processing confirmation as Rights ALLOW

Consent/intent and Rights Authority are different.

## 19.10 Do not allow benchmark prompt leakage

Paper-specific examples in a benchmark prompt invalidate the experiment.

## 19.11 Do not open the LLM2 automated artifact before freezing independent reference labels

That would anchor the reference benchmark.

## 19.12 Do not treat benchmark metrics as scientific authority

Benchmark quality metrics evaluate ADR behavior; they do not qualify agronomic knowledge.

## 19.13 Do not resume PR #58 or PR #59

#62 is the current RA02 path. #59 was temporary diagnostics only.

## 19.14 Do not assume a PR body’s embedded head is live authority

Always read current GitHub head SHA and current workflow evidence.

---

# 20. Recommended next-conversation execution plan

Do **not** start new architecture work.

The next conversation should execute this exact sequence:

```text
A. read this handoff
B. verify current main and #56/#60/#62/#61 live heads
C. verify #61 exact CI is still green or identify newer authority
D. inspect whether a new RP001 live workflow run already exists
```

If no live run exists:

```text
E. have operator trigger ADR RP001 Live LLM1-LLM2 Benchmark
   on feat/real-paper-benchmark-v1
   with explicit external-processing authorization
   and two different currently supported model strings
```

After completion:

```text
F. inspect run status and exact SHA
G. retrieve materialization + blind reference packet only
H. perform/freeze independent blind reference adjudication
I. only then retrieve automated result
J. calculate Phase-A metrics
K. inspect every false accept
```

Decision after first real RP001 result:

```text
if falseAcceptCount > 0:
    do not expand corpus yet
    classify failure mode
    fix extraction/review contract as narrowly as possible
    rerun exact RP001 calibration

if falseAcceptCount == 0 but reference coverage incomplete:
    finish reference coverage
    do not claim PASS

if falseAcceptCount == 0 and reference coverage complete:
    record Phase-A PASS for RP001 only
    then consider promoting one or more expansion candidates into the frozen corpus
```

Only after multi-paper calibration should the development frontier move toward:

```text
reviewed/qualified Agronomic Knowledge Base
→ GEOX FieldContext integration
→ first narrow irrigation/crop-water agronomic reasoning proof
```

---

# 21. Explicit nonclaims at handoff

This handoff does **not** claim:

```text
PMF
commercial success
yield improvement
agronomic effectiveness
scientific validity of every accepted Claim
automated Scientific Qualification
safe generalization across crops/regions/management systems
that RP001 live LLM1→LLM2 has already completed
that #56/#60/#62/#61 are merged to main
that local npm test output identifies an exact git head
```

The strongest correct current statement is:

> ADR now has a rights-enforced, restart-durable, large-PDF scientific extraction substrate; a governed blind LLM2 source-faithful second-review path; and a reproducible RP001 calibration benchmark whose exact PDF bytes, reference blindness and false-accept safety gate are pinned. The immediate frontier is the first explicit live RP001 LLM1→LLM2 execution and blind independent adjudication, after which development should return toward building the agronomic knowledge base that GEOX can apply to exact field context.

---

# 22. One-line resume instruction

If the next conversation needs one command-level mental model, use:

```text
Do not build more governance first.
Verify #61 → run RP001 live LLM1→blind-LLM2 → freeze independent reference → measure false accepts → then expand real agronomy knowledge and connect it to GEOX field context.
```
