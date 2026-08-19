# Agronomy Deployment Runtime — Conversation Handoff — 2026-08-20

Status: **CONVERSATION HANDOFF ONLY — NOT ARCHITECTURE AUTHORITY**

This handoff supersedes the implementation/frontier state recorded in `docs/handoff/ADR-HANDOFF-2026-08-18.md` / Draft PR #55. PR #55 is now closed and remains historical context for the v0.3 release frontier only.

This document exists so the next conversation can resume without reconstructing:

- why ADR exists and how it relates to GEOX;
- the distinction between the already-closed v0.3 paid-pilot software slice and the still-unfinished original product goal;
- the large-PDF ingestion / manual external-model / restart-durable pilot application;
- the first live real-paper benchmark and the evidence-granularity problem it exposed;
- the `ADR_ATOMIC_SINGLE_LOCATOR_V3` extraction correction;
- the automated blind LLM2 source-faithful review path;
- the Rights Authority detour, the product-direction correction, RA01 and the minimum RA02 enforcement needed before external model runs;
- the frozen RP001 real-paper corpus, exact PDF bytes and materialization evidence;
- the blind independent reference-adjudication protocol;
- the current `workflow_dispatch` frontier for the first real RP001 `LLM1 -> blind LLM2` run;
- the exact next path back to the actual product goal: scientific/agronomic knowledge -> GEOX field context -> applicability -> recommendation / next observation.

If this handoff conflicts with Frozen Architecture v1.0, Final Adjudication, merged authority contracts, live repository facts, exact PR heads or exact CI evidence, the higher authority wins.

---

## 0. Repository / branch / PR facts at handoff

Repository:

```text
liyongshang44-max/agronomy-deployment-runtime
```

Current/default `main`:

```text
80aafc9f25a184801a221fe2dbf2126fcd05a02f
```

That commit is the merge of:

```text
PR #63 — ops(actions): enable RP001 live workflow dispatch
```

PR #63 exact feature head:

```text
4244036d2370b3285625d0fede75618eab8c5d67
```

PR #63 exact pre-merge Constitution:

```text
ADR Constitution
run: 32267258414
run number: 1243
result: SUCCESS
```

PR #63 intentionally adds only the **default-branch workflow-dispatch registration stub**. The stub is fail-closed and is not the production benchmark workflow. It exists because GitHub manual `workflow_dispatch` registration requires a workflow file on the default branch.

The previous important merged main state is:

```text
38e66a60c603b42cc9a72d377abc4a3bbdb75b31
```

which is the merge of:

```text
PR #57 — feat(rights): establish fail-closed rights authority foundation
```

The v0.3 paid-pilot release acceptance itself was merged earlier as:

```text
PR #54 — test(v0.3): close paid-pilot integrated release acceptance
merge: bf1e7f1676da7e196b2988bc4f3876be652902df
```

Therefore the repository has two different things that must not be confused:

```text
main
=
v0.3 release acceptance
+ RA01 Rights Authority foundation
+ RP001 workflow-dispatch registration stub

versus

current real-paper application/benchmark stack
=
#56 -> #60 -> #62 -> #61
```

The current application/benchmark stack is:

```text
#56
feat/v0.3-pilot-application-source-ingestion
head:
b513a98616273b2979bc6fad575ac9e24e5168b1

#60
feat/automated-source-faithful-review
head:
023964c6cf5abe15f4ee255dfe15e29ee9b660da

#62
feat/rights-ra02-source-egress-enforcement
head:
fd64f9553e7e8ef6990d6b1d184a09c7616420e2

#61
feat/real-paper-benchmark-v1
head:
d45fbc3562a51fcb51d69d282bff7f009dc7cd05
```

The stack relationship is:

```text
38e66a60...  (RA01 merged main at the time)
       |
       +--> #56 b513a986...
              |
              +--> #60 023964c6...
                     |
                     +--> #62 fd64f955...
                            |
                            +--> #61 d45fbc35...
```

Separately, current main advanced from `38e66a60...` to `80aafc9f...` by merging #63.

So current `main @ 80aafc9f...` is **not** the direct parent of #61. This is intentional at the current frontier. The default-branch stub registers manual dispatch; the real workflow definition remains on `feat/real-paper-benchmark-v1`.

Do not "update branch" mechanically in a way that overwrites the full #61 workflow with the fail-closed main stub. When the stack is eventually merged, `.github/workflows/rp001-live-benchmark.yml` must be resolved deliberately: the branch implementation replaces the registration-only stub.

Current exact CI evidence for the stack:

```text
#56 head b513a986...
ADR Constitution
run: 32126373346
run number: 986
result: SUCCESS

#60 head 023964c6...
ADR Constitution
run: 32215435605
run number: 1098
result: SUCCESS

#62 head fd64f955...
ADR Rights RA02
run: 32218286184
result: SUCCESS

ADR Constitution
run: 32218286197
run number: 1170
result: SUCCESS

#61 head d45fbc35...
ADR Constitution
run: 32266158355
run number: 1238
result: SUCCESS

ADR Real Paper Benchmark
run: 32266157341
run number: 92
result: SUCCESS
```

Current PR states:

```text
#56 OPEN / DRAFT / mergeable
#60 OPEN / DRAFT / mergeable
#62 OPEN / DRAFT / mergeable
#61 OPEN / DRAFT / mergeable
#63 MERGED
```

Historical/superseded PRs that must not become the next frontier:

```text
#55 old 2026-08-18 handoff — CLOSED / NOT MERGED
#58 first RA02 implementation branch — CLOSED / SUPERSEDED
#59 RA02 debug-only CI split — CLOSED / DO NOT MERGE
```

The current live product-engineering frontier is **not another architecture slice**.

It is:

```text
FIRST REAL RP001 MODEL CALIBRATION RUN

exact retained RP001 PDF
        ↓
rights-enforced LLM1 extraction
        ↓
freeze blind reference packet
        ↓
blind LLM2 source-faithful review
        ↓
independent reference adjudication
        ↓
open automated result
        ↓
Phase-A safety metrics
```

No real external LLM1->LLM2 RP001 run is claimed complete at this handoff.

---

# 1. Authority order — preserve the existing hierarchy

The authority order remains:

```text
Frozen Architecture v1.0
  > Final Architecture / Capability adjudication
  > Capability Map / Master Task Line / Version Slicing
  > merged implementation contracts / exact repository facts
  > current exact PR / exact CI evidence
  > conversation handoff
```

Important governing documents still include:

```text
docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md
docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md
docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md
docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md
docs/architecture/ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md

docs/planning/ADR-CAPABILITY-MAP-01.md
docs/planning/ADR-CAPABILITY-MAP-01-FINAL-ADJUDICATION.md
docs/planning/ADR-MASTER-TASK-LINE-01.md
docs/planning/ADR-MASTER-TASK-LINE-01-REVIEW-ADJUDICATION.md
docs/planning/ADR-VERSION-SLICING-01.md
```

Rights-specific merged decision:

```text
docs/decisions/DEC-0002-RIGHTS-AUTHORITY-AND-END-TO-END-AUTHORITY-GRAPH.md
```

Permanent working rule:

> If a downstream task reveals a missing predecessor authority, repair/version the predecessor separately. Do not hardcode a pseudo-authority into the downstream task.

But an equally important correction from this conversation is:

> A useful predecessor authority does not automatically become the product roadmap. Infrastructure must remain subordinate to the product goal.

This matters because the conversation temporarily drifted from "paper -> agronomic knowledge -> GEOX contextual advice" into increasingly deep Rights/Authority work. RA01/RA02 were useful, but continuing RA03/RA04/... now would be the wrong priority.

---

# 2. Product-direction correction — the North Star is agronomic knowledge for GEOX

The user restated the intended product clearly during this conversation:

```text
ADR extracts agronomic knowledge from papers
        ↓
forms the agronomic knowledge base used by GEOX
        ↓
GEOX supplies:
  crop
  cultivar / biological identity where available
  phenology / growth stage
  soil state
  weather-station data
  forecast
  satellite observations
  management history
        ↓
ADR determines what knowledge is applicable now
        ↓
current agronomic advice
+ next action
+ next observation / information request
+ evidence
```

That is the product North Star.

A more precise current framing is:

```text
Evidence-grounded Agronomic Reasoning Runtime
```

not:

```text
generic enterprise rights/governance platform
```

The intended product architecture is therefore:

```text
Scientific / agronomic sources
        ↓
Source / SourceArtifact
        ↓
LLM1 ClaimCandidate + SourceContextCandidate
        ↓
source-faithful review
        ↓
scientific qualification
        ↓
Qualified agronomic knowledge
        ↓
KnowledgeRelease

GEOX / other field-context provider
        ↓
Field / Target Context
crop + phenology + soil + weather + satellite + management
        ↓

KnowledgeRelease + TargetContext + DecisionProblem
        ↓
Applicability
        ↓
Agronomic reasoning
        ↓
Recommendation / ASK / ABSTAIN
        ↓
Why / evidence / next observation
```

Current ADR already owns much of the authority substrate needed for the middle and downstream parts. The missing product proof is not more authority vocabulary. The missing proof is:

```text
Can we reliably create useful agronomic knowledge from real papers,
then apply it to exact field context without overgeneralizing?
```

That is why the current real-paper calibration benchmark is now the correct frontier.

Important product-status correction:

```text
v0.3 paid-pilot software candidate = achieved in repository history

but

original product MVP:
paper -> agronomic knowledge base
-> GEOX context
-> current recommendation / next instruction
= NOT YET COMPLETE
```

Do not tell the next conversation that the user's original ADR product MVP is done merely because #54's software release acceptance closed.

---

# 3. Standalone relationship to GEOX — unchanged

ADR remains intentionally standalone:

```text
independent repository
independent authority model
independent scientific knowledge model
independent API / SDK
independent release cycle
```

GEOX remains:

```text
first-party adapter / context provider
reference consumer
possible source of field state
possible source of model/runtime/outcome data
field-validation substrate
```

GEOX is not:

```text
ADR host
ADR schema authority
ADR scientific authority
ADR IAM authority
required ADR core dependency
```

Dependency direction remains:

```text
ADR public contracts / SDK / APIs
                ▲
                │
              GEOX
```

Never:

```text
ADR core
  ↓
GEOX private database / internals / GEOX-specific ontology
```

The eventual product integration should therefore look like:

```text
GEOX FieldContextManifest
        ↓
ADR applicability / agronomic reasoning
```

rather than ADR directly reading GEOX internal tables and becoming coupled to the GEOX database.

---

# 4. What this conversation actually accomplished

The previous handoff stopped at the final merge frontier for PR #54.

This conversation moved the project through the following distinct phases:

```text
PR #54 final release acceptance
        ↓
v0.3 software paid-pilot candidate merged
        ↓
real pilot application / large-PDF ingestion (#56)
        ↓
manual real-paper benchmark
DeepSeek / KIMI / Model C
        ↓
atomic single-locator extraction correction
        ↓
blind automated LLM2 source-faithful review (#60)
        ↓
Rights Authority foundation (#57 merged)
        ↓
minimum pre-effect Rights enforcement needed for real model execution (#62)
        ↓
real-paper calibration corpus and RP001 exact materialization (#61)
        ↓
blind independent reference protocol
        ↓
default-branch manual-dispatch registration (#63)
        ↓
CURRENT:
first explicit RP001 LLM1 -> blind LLM2 live run
```

This conversation also corrected two conceptual mistakes:

1. "human review" in the current manual loop was often actually `LLM1 -> user screenshots -> ChatGPT/LLM2 judgment -> user click`; the semantic second review was already another LLM. That should be formalized honestly as automated source-faithful review, not mislabeled as human review.

2. Rights/Authority work started becoming the product roadmap. The user corrected the product target back to "paper -> agronomic knowledge -> GEOX contextual agronomy". Rights remains a required substrate, not the feature frontier.

---

# 5. Exact PR / merge progression since the previous handoff

## PR #54 — v0.3 paid-pilot integrated release acceptance

```text
title:
test(v0.3): close paid-pilot integrated release acceptance

head:
5cdba2633ae6f6064ca36519ba7aea1607c81bfe

merge:
bf1e7f1676da7e196b2988bc4f3876be652902df

status:
MERGED
```

This closed the software release acceptance for the existing v0.3 Gate-A / Workbench / P01/P02/P03 / P06/P07/P08 paid-design-partner candidate.

Permanent nonclaim:

```text
software release acceptance
!=
commercial validation
!=
agronomic recommendation correctness
!=
the user's original end-to-end product MVP
```

## PR #55 — old handoff

```text
docs/handoff-2026-08-18
42792f241bc04ddc2bad08a3555c61fb73ada996

status:
CLOSED
NOT MERGED
```

It is historical context only and is superseded by this handoff.

## PR #56 — pilot application / large-PDF ingestion

```text
feat/v0.3-pilot-application-source-ingestion
head:
b513a98616273b2979bc6fad575ac9e24e5168b1

status:
OPEN
DRAFT
```

#56 introduced the practical application surface needed to put real papers through ADR:

```text
large PDF upload
streaming retention
Source / SourceArtifact materialization
OpenAI Files/Responses extraction path
manual external proposal import
ScientificCompiler materialization
browser source-faithful review
restart-durable local checkpoint
recovery of existing compilation/review state
Workbench
canonical extraction prompt v3
```

It also froze the first manual real-paper benchmark history using `2211.16938v1.pdf`.

## PR #57 — RA01 Rights Authority foundation

```text
feat/rights-authority-foundation
head:
f3a735e4e883e8384ab430de0c394411a117ad99

merge:
38e66a60c603b42cc9a72d377abc4a3bbdb75b31

status:
MERGED
```

RA01 added:

```text
RightsPolicy
RightsGrant
RightsDecision
RightsRevocation
UNKNOWN/no grant -> DENY
exact Source / SourceArtifact subjects
point-in-time semantics
expiry / revocation replay semantics
mandatory obligations
closed semantic shapes
no raw import bypass
```

RA01 did **not** itself gate the actual PDF/storage/network side effects.

## PR #58 — first RA02 attempt

```text
feat/rights-source-egress-enforcement
head:
ccd23a0362e358684ec62040b3fe4e6783a38ed4

status:
CLOSED
NOT MERGED
SUPERSEDED
```

Useful historical finding:

```text
old ingestion order:
create session
-> write PDF bytes into CAS
-> finalize
-> only then Source existed
```

That made pre-retention Rights enforcement impossible against an exact Source subject.

Do not resume #58.

## PR #59 — temporary debug-only RA02 CI split

```text
debug/ra02-host-ci-ccd23
head:
439500c2e23a10e45bb74e83b34deb2deccf8d17

status:
CLOSED
NOT MERGED
DIAGNOSTIC ONLY
```

Do not resume or merge #59.

## PR #60 — automated blind source-faithful LLM2 review

```text
feat/automated-source-faithful-review
head:
023964c6cf5abe15f4ee255dfe15e29ee9b660da

status:
OPEN
DRAFT
```

This replaces the screenshot/manual second-pass loop with governed:

```text
LLM1 candidate
        ↓
blind LLM2 falsification proposal
        ↓
deterministic promotion
        ↓
AUTO ACCEPT
AUTO REJECT
ESCALATE_TO_HUMAN
```

More detail is frozen below.

## PR #62 — final RA02 source/read/model-egress enforcement

```text
feat/rights-ra02-source-egress-enforcement
head:
fd64f9553e7e8ef6990d6b1d184a09c7616420e2

status:
OPEN
DRAFT
implementation-complete on exact head
```

This is the current valid RA02 implementation. It supersedes the #58 attempt.

## PR #61 — real-paper calibration corpus / RP001 benchmark

```text
feat/real-paper-benchmark-v1
head:
d45fbc3562a51fcb51d69d282bff7f009dc7cd05

base:
feat/rights-ra02-source-egress-enforcement

status:
OPEN
DRAFT
CURRENT EXPERIMENT FRONTIER
```

It contains:

```text
frozen RP001 corpus
exact PDF identity pin
PMC acquisition
rights-enforced materialization
live LLM1->LLM2 runner
zero-cost fake-host dry run
blind reference packet
reference worksheet/finalizer
reference application
deterministic Phase-A summarizer
```

## PR #63 — enable default-branch workflow_dispatch

```text
ops/enable-rp001-live-dispatch
head:
4244036d2370b3285625d0fede75618eab8c5d67

merge:
80aafc9f25a184801a221fe2dbf2126fcd05a02f

status:
MERGED
```

It places a fail-closed registration stub on default branch so GitHub exposes the manual workflow.

The main-branch stub deliberately fails if executed on main. The real benchmark must be run against `feat/real-paper-benchmark-v1`.

---

# 6. Pilot application / local large-PDF workflow

The practical pilot application runs:

```text
node apps/pilot-api/src/server.mjs
```

Typical local endpoint:

```text
http://127.0.0.1:8787
```

The source-ingestion host supports large PDFs by streaming to retained storage instead of loading the entire file into application memory.

Observed local readiness from this conversation included:

```text
Max source upload bytes:
1073741824
```

i.e. 1 GiB configured pilot maximum.

The pilot separates:

```text
Source
=
logical provenance identity

SourceArtifact
=
exact retained bytes + SHA-256 + byte length + acquisition identity
```

The correct current rights-aware upload order is:

```text
create upload session
        ↓
pre-register exact Source
        ↓
provision Source RETAIN_FULLTEXT rights
        ↓
point-in-time RightsDecision
        ↓
only then stream PDF bytes into retained CAS
        ↓
finalize exact SourceArtifact
```

For SourceArtifact use, rights are separately provisioned. Source rights do not silently inherit.

The pilot local checkpoint is restart durable.

Observed startup states included:

```text
EMPTY_RUNTIME
RESTORED_AND_VERIFIED
```

Important:

```text
LOCAL_CHECKPOINT_RESTART_DURABLE_V1
```

is a persistence mode / authority-persistence label.

It is **not** the operator token.

The operator token is the random value placed in:

```text
ADR_OPERATOR_TOKEN
```

The local shell/browser operational lesson is:

```text
restart terminal/computer
=> environment variables are lost
=> checkpoint authority may restore successfully
but provider/model/operator-token configuration may be absent
```

So:

```text
RESTORED_AND_VERIFIED
!=
OpenAI/provider configured
!=
browser authenticated
```

The Workbench/browser may recover compilation authority from checkpoint while still requiring a newly configured operator token or provider environment.

---

# 7. First manual real-paper benchmark — `2211.16938v1.pdf`

Before RP001 was frozen, the application was tested manually with:

```text
2211.16938v1.pdf

Evaluating Digital Agriculture Recommendations with Causal Inference
```

This paper is **historical calibration evidence** for #56/#60.

It is not the frozen `RP001` corpus paper.

The exact manual benchmark results recorded in #56 are:

## DeepSeek web run #1

```text
raw candidates:       6
compiler REVIEWABLE:  5
compiler INVALID:     1

source-faithful ACCEPT: 1
source-faithful REJECT: 4
```

Accepted:

```text
causal-graph-assumption-constant-management
claimType = MODEL_ASSUMPTION
```

Key rejections included:

```text
causal effect:
material causal-context omission

refutation:
overstatement / collapsed distinct outcomes

external-validity:
paired management-context evidence binding incomplete

sowing thresholds:
temporal semantic expansion
+ incomplete claim-level evidence coverage
```

The invalid candidate used a non-frozen claim type:

```text
MEASUREMENT
```

and was never materialized as a valid ClaimCandidate.

## KIMI web run #1

```text
raw output captured
status:
SKIPPED_NOT_ADJUDICATED
```

Do not include KIMI in adjudicated denominators.

## Model C web run #1

```text
raw candidates:       8
compiler REVIEWABLE:  8
compiler INVALID:     0

source-faithful ACCEPT: 0
source-faithful REJECT: 8

authority minted: none
```

The most important interpretation:

```text
0/8 source-faithful ACCEPT
does NOT mean
8/8 factual nonsense
```

Model C was substantively much stronger than the raw 0/8 number suggests.

Its dominant failure pattern was:

```text
multiple true/relevant propositions
compressed into one compound assertion
        ↓
one narrow claim-level evidenceText
        ↓
evidence does not cover the whole assertion
        ↓
REJECT_SOURCE_FAITHFUL
```

Examples included:

```text
dataset size + yield range
model metrics + trimmed sample result
causal effect + model assumption + relative effect
Placebo + RCC + RSR + UCC outcomes
external-validity limitation + reason + generalization boundary
```

This observation drove the extraction-contract correction.

---

# 8. Extraction correction — `ADR_ATOMIC_SINGLE_LOCATOR_V3`

The first response to Model C's provenance-granularity failure was **not** to change `Claim` schema.

The frozen correction is:

```text
promptVersion:
adr-paper-extraction-prompt-v3

profile:
ADR_ATOMIC_SINGLE_LOCATOR_V3
```

Core rules:

```text
one claim
=
one independently evidenced atomic assertion

claim-level evidenceText
must support every material proposition in assertion

SourceContext locators
cannot repair an incomplete claim-level evidence locator

if disjoint evidence can be safely separated:
split the claim

if the scientific assertion cannot be supported by one legal locator
under the current contract:
abstain rather than silently compose evidence
```

Material qualifiers must remain attached when source-supported:

```text
time window
comparator
unit
population
study design
causal qualifier
management condition
measurement meaning
```

Do not change the current frozen single-locator Claim contract merely to improve pass rate.

A later multi-locator:

```text
Claim
  -> evidenceSet[]
```

may be justified only if repeated real-paper evidence shows important claims that are genuinely indivisible but inherently require multiple disjoint source fragments.

Important benchmark-contamination lesson:

The first draft of prompt v3 accidentally used examples derived from the same test paper. That was caught **before** the v2 experiment and rejected.

Final v3 uses unrelated synthetic examples and has a leakage acceptance that fails if paper-specific signatures appear in the canonical prompt.

Permanent rule:

> Never improve a benchmark prompt by embedding the benchmark paper's answer structure.

---

# 9. LLM1 -> blind LLM2 source-faithful review

The user correctly observed that the prior "human review" loop often was:

```text
LLM1 extracts
        ↓
user screenshots candidate
        ↓
ChatGPT / another LLM evaluates against source
        ↓
user clicks ACCEPT/REJECT
```

The semantic second review was therefore already largely an LLM2 review.

The project now represents this honestly.

## LLM1 role

LLM1 is an extractor:

```text
PDF
-> ClaimCandidate
-> SourceContextCandidate
-> evidence locator
```

Its output remains:

```text
PROPOSAL_ONLY
```

Schema-valid is not source-faithful and is not scientifically qualified.

## LLM2 role

LLM2 is a falsifier/reviewer, not a second extractor.

It receives:

```text
same exact PDF
+
candidate assertion
+
candidate context
+
candidate evidence
```

and asks:

```text
Can this exact candidate survive a hostile source-faithfulness review?
```

The frozen check families include:

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

The LLM2 result itself is still:

```text
AutomatedSourceFaithfulReviewProposal
PROPOSAL_ONLY
```

A deterministic promotion layer decides:

```text
AUTO ACCEPT
AUTO REJECT
ESCALATE_TO_HUMAN
```

## Blindness

The provider-facing reviewer packet hides:

```text
LLM1 provider/model identity
LLM1 confidence
LLM1 rationale
SourceContext dimension confidence
Authority logical IDs
original source filename
```

It retains only the exact candidate/evidence needed for review plus opaque semantic/content bindings.

The provider-side PDF filename is neutralized:

```text
source-review.pdf
```

## Independence

The second reviewer must not simply self-review the same model identity.

Frozen behavior:

```text
same identified model
=> ESCALATE_TO_HUMAN

missing / placeholder extractor identity
=> ESCALATE_TO_HUMAN
```

Direct runtime provider identity can use:

```text
RUNTIME_RECORDED_PROVIDER_MODEL
```

Manual web-model import may use explicitly declared:

```text
providerLabel
modelLabel
```

for independence checks, but its trust class remains:

```text
OPERATOR_DECLARED_NOT_VERIFIED
```

Never upgrade a manually typed model label into verified provider identity.

Therefore a manually imported first pass such as:

```text
DEEPSEEK_WEB / explicit model label
```

may be automatically second-reviewed by a clearly different LLM2 while still retaining the fact that the LLM1 identity was operator-declared.

Unknown manual identity still escalates.

## Authority boundary

An automated source-faithful ACCEPT may create the same K03-level authority that a source-faithful reviewer may create:

```text
SourceFaithfulReviewDecision
Claim
SourceContext
```

It must **not** create:

```text
ScientificQualificationDecision
QualifiedKnowledge
KnowledgeRelease
ApplicabilityAssessment
RuntimeEligibility
DecisionResult
```

Acceptance explicitly asserts:

```text
AUTO ACCEPT
=> ScientificQualificationDecision count remains 0
```

This boundary is permanent until separately adjudicated.

## Batch behavior

`PilotAutomatedSourceFaithfulBatchService` reviews one exact compilation:

```text
terminal review exists
=> skip

clear accept
=> AUTO ACCEPT

clear defect
=> AUTO REJECT

ambiguous / low-confidence / same-model
=> ESCALATE_TO_HUMAN
```

Restart behavior preserves:

```text
TERMINAL_REVIEW_MATERIALIZED
ESCALATED_PENDING_HUMAN
PROMOTION_INCOMPLETE
```

An unresolved escalation is not repeatedly sent to LLM2 unless explicitly retried.

This is the correct scalable replacement for "screenshot every claim and ask ChatGPT".

---

# 10. Scientific Qualification remains a distinct third layer

Do not collapse:

```text
source-faithful
```

into:

```text
scientifically qualified
```

The second review answers:

> Did the paper actually support this candidate as written and contextualized?

Scientific Qualification answers a different question:

> Should this source-faithful claim be admitted for a specified scientific/agronomic use?

That later judgment may depend on:

```text
study design
sample size
causal identification quality
measurement validity
replication
external validity
conflicting literature
evidence hierarchy
scientific-use target
```

The current automated LLM2 path does not decide those questions.

A future system may use an LLM as a qualification assistant, but no automatic qualification authority has been established.

---

# 11. Rights Authority — useful substrate, not current product roadmap

The conversation explored a broader "Authority DAG":

```text
Source
-> Rights
-> Evidence
-> Qualification
-> Applicability
-> Release
-> Decision
-> Evidence
```

and correctly identified a commercial-grade need:

```text
rights metadata
must not equal
permission to retain/read/export/send/train/use
```

This produced valuable RA01 and RA02 work.

But the conversation later recognized a product-direction drift:

```text
building Rights Engine / enterprise governance
was becoming the mainline

while the user's actual goal remained:
papers -> agronomic knowledge -> GEOX advice
```

Current correction:

```text
Rights stays
but Rights stops leading the roadmap
```

Do not continue directly into hypothetical:

```text
RA03 qualification-rights binding
RA04 release current-rights gate
RA05 DecisionEvidenceBundle
...
```

unless a real product test exposes a concrete blocker that requires one of those slices.

The current high-value work is the real scientific-knowledge pipeline.

---

# 12. RA01 — merged Rights Authority foundation

RA01 is merged in `main @ 38e66a60...` and remains valid infrastructure.

Rights Authority and Principal Authorization are different.

Authorization asks:

```text
May this principal perform this platform operation?
```

Rights asks:

```text
May this exact source/source-artifact be used
for this operation / purpose / jurisdiction / time?
```

They cannot substitute for each other.

RA01 objects:

```text
RightsPolicy
RightsGrant
RightsDecision
RightsRevocation
```

Execution-facing decision:

```text
ALLOW | DENY
```

No executable `CONDITIONAL` result exists in v1.

Conditions/obligations must be resolved before side effect.

Fail-closed rules include:

```text
no grant -> DENY
UNKNOWN -> DENY / fail closed
unknown operation -> fail closed
Source rights do not inherit to SourceArtifact
expired grant blocks new use
later retroactive grant cannot rewrite earlier decision world
later-recorded revocation blocks current use without rewriting historical decision
hidden/ignored semantic fields are rejected
unsupported mandatory obligation prevents execution
```

The recorded rights basis is not a legal opinion by ADR.

Examples such as:

```text
LICENSE
CUSTOMER_ASSERTION
CONTRACT
PUBLIC_DOMAIN
INTERNAL_POLICY
```

are recorded provisioning bases, not legal conclusions.

---

# 13. RA02 — minimum enforcement required before real model benchmarks

The initial Rights implementation was insufficient because actual side effects could occur before exact authority existed.

The critical ingestion finding was:

```text
old order:
session
-> bytes retained
-> finalize
-> Source created

problem:
RETAIN_FULLTEXT could not be checked
against an exact Source before retention
```

The corrected RA02 order is:

```text
session
-> exact Source pre-registration
-> Source RETAIN_FULLTEXT RightsPolicy/Grant
-> point-in-time RightsDecision
-> assert ALLOW
-> retain bytes
-> exact SourceArtifact
```

The Source and SourceArtifact remain separate authority identities.

After SourceArtifact exists, separate exact rights are needed.

Host-enforced operations include:

```text
RETAIN_FULLTEXT
READ_FOR_EXTRACTION
MODEL_EGRESS
RETAIN_DERIVED
```

For LLM1 extraction, all required decisions are obtained before opening the PDF stream/provider path.

For LLM2 automated review, fresh point-in-time decisions are obtained for unreviewed candidates before the PDF is opened.

For human source-faithful ACCEPT/REJECT materialization, `RETAIN_DERIVED` is enforced before derived authority persistence.

For manual copy/paste import performed outside ADR:

```text
ADR does not fabricate MODEL_EGRESS authority retroactively
```

It enforces the rights relevant to the ADR-side read/derived persistence path.

Important distinction:

```text
externalProcessingAuthorized=true
=
operator consent / explicit intent

externalProcessingAuthorized=true
!=
RightsDecision ALLOW
```

Both are required on the external-provider path.

RA02 also introduced operational evidence linking a completed dangerous side effect to the exact RightsDecision used.

Unsupported provider obligations fail closed. Example:

```text
grant requires DELETE_PROVIDER_COPY
but adapter cannot prove/enforce it
=> no provider transport
```

Do not weaken this to "best effort".

---

# 14. RP001 — frozen first real-paper corpus baseline

The unique frozen v1 benchmark corpus is:

```text
docs/implementation/real-paper-benchmark/corpus-v1.json
```

Current corpus contains exactly one frozen baseline paper:

```text
paperId:
RP001

title:
Seedling-Stage Deficit Irrigation with Nitrogen Application in Three-Year Field Study Provides Guidance for Improving Maize Yield, Water and Nitrogen Use Efficiencies

journal:
Plants

year:
2022

volume:
11

issue:
21

article:
3007

DOI:
10.3390/plants11213007

PMCID:
PMC9656380

license metadata:
CC_BY_4_0
```

Why RP001 was selected:

```text
three-year field experiment
explicit maize / irrigation / nitrogen context
soil-water context
growth-stage context
quantitative grain yield / WUE / NUE outcomes
year-specific response differences
open-access first rights path
```

The frozen exact PDF identity is:

```text
mediaType:
application/pdf

sourceArtifactLogicalId:
source.paper.doi-10.3390-plants11213007.artifact.pdf

contentHash:
sha256:0e17a738d09b6d6638b103ce6a7b979cb9c7b2d9011e449ccdbc5d585dea6cab

byteLength:
6045990
```

Benchmark acquisition must fail closed **before Rights retention** if acquired bytes do not match this pin.

This is crucial because a DOI/PMCID identifies the publication but not necessarily forever-identical bytes.

The exact PDF identity is benchmark-source identity only:

```text
BENCHMARK_SOURCE_IDENTITY_ONLY_NOT_SCIENTIFIC_AUTHORITY
```

Current reference status:

```text
PENDING_INDEPENDENT_ANNOTATION_AND_DOMAIN_EXPERT_ADJUDICATION
```

Do not call RP001 a gold corpus yet.

---

# 15. RP001 acquisition / materialization

The project deliberately does not commit the PDF binary into git.

RP001 materialization uses official open-access acquisition and then the actual rights-enforced ADR ingestion path.

Sequence:

```text
PMC OA acquisition
        ↓
verify exact pinned PDF hash / byteLength
        ↓
Source
        ↓
RETAIN_FULLTEXT RightsDecision
        ↓
retained content-addressed PDF
        ↓
SourceArtifact
        ↓
durable checkpoint + materialization evidence artifact
```

The materialization job configures **no LLM provider** and asserts no LLM execution occurred.

Across repeated independent materialization runs, PDF bytes remained stable:

```text
sha256:
0e17a738d09b6d6638b103ce6a7b979cb9c7b2d9011e449ccdbc5d585dea6cab

byteLength:
6045990
```

SourceArtifact and Rights publication refs may differ across exact execution worlds because their audit/acquisition metadata binds the individual run.

That is expected.

Permanent distinction:

```text
content identity may remain stable

while

authority publication identity may differ by exact execution world
```

## PMC acquisition pitfall

PMC's open-access distribution moved/deprecated older `oa_package` locations.

Do not hardcode a fragile FTP path in workflow YAML.

The acquisition logic was moved into a repository script which:

```text
queries OA metadata
preserves original href
tries the current/deprecated compatible location
extracts the package
identifies the primary PDF
verifies PDF magic
records actual acquisition locator
```

Another pitfall caught here:

Complex nested shell heredocs in workflow YAML caused a download-step failure even though the source resource was valid.

The fix was to move acquisition behavior into an auditable Node script instead of adding more shell special cases.

---

# 16. Benchmark v1 — what success actually means

The benchmark must not optimize for automation rate alone.

Primary safety concern:

```text
false automatic acceptance
```

Phase-A primary gate:

```text
FALSE_ACCEPT_COUNT == 0
```

Automation rate is secondary.

Deterministic metrics include:

```text
raw candidate count
compiler REVIEWABLE
compiler INVALID

AUTO ACCEPT
AUTO REJECT
ESCALATE
SKIP

auto-resolution rate
escalation rate

independent-reference coverage

false accept count/rate
false reject count/rate

per-paper distribution
claim-type distribution
defect-code distribution

phaseASafetyGate
=
PASS
| INCOMPLETE_REFERENCE_COVERAGE
| FAIL
```

Benchmark metrics are explicitly:

```text
BENCHMARK_METRICS_ARE_NOT_SCIENTIFIC_AUTHORITY
```

A REAL run must bind:

```text
exact code head
RA02 execution marker
exact SourceArtifact ref
PDF contentHash
byteLength
retention RightsDecision
```

Do not accept an experiment result that only says "model accepted 7/10" without the exact execution/source identity.

---

# 17. Blind reference-adjudication protocol

A critical benchmark rule is:

```text
independent reference judgment
must be frozen
before the adjudicator sees the LLM2 final disposition
```

The live runner therefore freezes:

```text
rp001-reference-packet.json
```

**after LLM1 and before LLM2 starts**.

The reference packet includes:

```text
exact SourceArtifact/source evidence
candidate assertion
candidate context
candidate locator
```

It excludes:

```text
LLM2 disposition
automated review state
human review state
extraction confidence
LLM1 provider/model identity
```

The independent reference workflow is two-stage:

```text
reference packet
        ↓
prepare reference worksheet
        ↓
blind adjudication:
REFERENCE_ACCEPT
or
REFERENCE_REJECT + defect codes
        ↓
finalize reference annotation
        ↓
only after freeze:
open automated-result artifact
        ↓
apply reference annotation
        ↓
compute final metrics
```

Fail-closed rules include:

```text
reference packet contains automated review fields
=> reject packet

reference worksheet says automated result was viewed
=> cannot finalize

REFERENCE_REJECT without defect code
=> cannot finalize

reference application may change only:
referenceDisposition
reference defectCodes

it may not rewrite:
automatedStatus
claimType
compilerStatus
REAL execution evidence
```

If:

```text
LLM2 AUTO ACCEPT
but independent reference = REFERENCE_REJECT
```

then:

```text
falseAcceptCount += 1
Phase-A gate = FAIL
```

This is intentional. The system must make false-safe automation visible rather than optimizing it away.

---

# 18. Live RP001 workflow — current exact blocker/frontier

The real workflow on #61 is:

```text
.github/workflows/rp001-live-benchmark.yml
```

Workflow name:

```text
ADR RP001 Live LLM1-LLM2 Benchmark
```

It is:

```text
workflow_dispatch only
```

A normal push must never send the PDF to an external model or spend provider credits.

Required inputs are:

```text
external_processing_authorized
  boolean
  default false
  must be true for live model execution

extraction_model
  required string
  explicit OpenAI model name for LLM1

review_model
  required string
  explicit different OpenAI model name for LLM2

rights_jurisdiction
  required string
  default UNSPECIFIED
```

Repository secret required:

```text
OPENAI_API_KEY
```

Do not copy the API key into the workflow input, PR, issue, chat log or handoff.

The workflow explicitly fails if:

```text
OPENAI_API_KEY missing
LLM1 model missing
LLM2 model missing
LLM1 == LLM2
```

The workflow runs Node 24.

It first materializes/restores exact RP001, then starts the rights-enforced pilot host, then executes the real HTTP product path.

Artifacts are intentionally split:

```text
rp001-reference-packet-<sha>
=
blind reference input

rp001-live-llm1-llm2-<sha>
=
automated pre-reference result / checkpoint
```

**Do not open the automated-result artifact before independent reference adjudication is frozen.**

## Default-branch registration stub

Current `main` contains the same workflow filename only as a registration stub.

The main stub always exits fail-closed and says:

```text
run the workflow against:
feat/real-paper-benchmark-v1
```

This is deliberate.

Current external blocker:

```text
the connected GitHub tool surface can inspect/re-run existing workflow runs,
but cannot create a new workflow_dispatch event.
```

Therefore the first live RP001 model run requires one explicit manual GitHub UI action.

At this handoff:

```text
NO real external RP001 LLM1->LLM2 run is claimed.
NO provider-spend result is claimed.
NO RP001 automated-review metrics are claimed.
```

Do not confuse the repeated successful **materialization** jobs with a completed model benchmark.

---

# 19. Exact next actions — do these in order

The next conversation should not begin by editing architecture or adding more Rights objects.

It should begin with the current live experiment.

Sequence:

```text
1. Read this handoff.
2. Confirm:
   main = 80aafc9f...
   #61 head = d45fbc35...
   #61 Constitution + Real Paper Benchmark are green.
3. In GitHub Actions:
   open "ADR RP001 Live LLM1-LLM2 Benchmark".
4. Select branch:
   feat/real-paper-benchmark-v1
5. Set:
   external_processing_authorized = true
6. Supply:
   a valid current extraction_model
   a valid current different review_model
7. Set/confirm:
   rights_jurisdiction
8. Confirm repository secret:
   OPENAI_API_KEY
9. Run workflow.
10. Wait for terminal state.
```

Model names are deliberately **not frozen in this handoff**.

Do not treat a chat-suggested model string as repository authority. Model availability is time-sensitive. Use currently valid API model identifiers and keep LLM1 and LLM2 distinct.

If the workflow fails before provider use, diagnose exact step:

```text
secret/config failure
materialization failure
rights failure
host readiness failure
provider network/API failure
schema/extraction/review failure
```

Do not collapse these into "LLM failed".

If live run succeeds:

```text
11. Retrieve only:
    exact materialization evidence
    rp001-reference-packet-<sha>

12. Do NOT retrieve/open:
    rp001-live-llm1-llm2-<sha>

13. Complete blind independent reference adjudication.

14. Finalize reference annotation.

15. Only after reference freeze:
    open automated result.

16. Apply reference annotation.

17. Run deterministic summary.

18. Record:
    falseAcceptCount
    falseRejectCount
    auto-resolution rate
    escalation rate
    defect distribution
    Phase-A gate.
```

Only after this first real measurement should the next corpus-expansion decision be made.

---

# 20. After RP001 — return to the product mainline

If RP001 exposes a safety defect, fix that exact extraction/review defect first.

If RP001 is clean, expand the real-paper corpus carefully.

`benchmarks/real-paper-v1/expansion-candidates.json` contains discovery candidates only.

They are **not** automatically part of the frozen corpus.

Promotion must be explicit.

Recommended scientific coverage for the next papers should continue to stress:

```text
crop identity
phenology / growth stage
soil-water state
irrigation thresholds/timing
nitrogen / nutrient management
weather / precipitation modifiers
multi-year variation
management-system boundaries
measurement / remote-sensing proxies
causal vs observational language
external-validity constraints
```

But the project should not remain an extraction benchmark forever.

Once source-faithful extraction/review quality is demonstrated across a modest real-paper set, the product frontier should return to:

```text
Agronomic Knowledge
        +
GEOX Field Context
        ↓
Applicability
        ↓
first narrow agronomic reasoning use case
```

The best first narrow end-to-end product case remains:

```text
crop-water / irrigation decision support
```

because GEOX already has a strong context substrate:

```text
crop
phenology
soil moisture / modeled state
weather
forecast
rainfall
ET0 / water demand inputs
satellite observations
management/execution history
```

The first real product proof should answer something like:

```text
For this exact field now:

What agronomic state is material?
Which qualified paper-derived knowledge applies?
Which knowledge conflicts or does not transport?
What information is missing?
Should the system recommend an action,
ask for information,
wait,
or abstain?
What should be observed next?
Which exact evidence supports that result?
```

That is the user's original ADR vision.

---

# 21. Do not resume the Rights expansion as the mainline

RA01 and RA02 are useful and should remain.

But the next conversation should **not** continue directly into:

```text
RA03 scientific-qualification rights binding
RA04 KnowledgeRelease current-rights gate
RA05 DecisionEvidenceBundle
enterprise rights administration UI
complex rights delegation
```

unless one of those is required by a concrete real-paper/GEOX product blocker.

Why:

The conversation briefly drifted into designing ADR as a sophisticated enterprise governance system.

The user then corrected the product target:

```text
ADR exists to turn scientific/agronomic literature
into a usable agronomic knowledge base
for GEOX contextual recommendations.
```

That correction is now the planning priority.

---

# 22. Local operator environment / current local evidence

The local repository path used in this conversation is:

```text
C:\Users\mylr1\agronomy-deployment-runtime
```

Earlier setup started from a clean clone and used branch:

```text
feat/v0.3-pilot-application-source-ingestion
```

Initial observed Node:

```text
node --version
v20.11.1
```

and Node executable:

```text
C:\Program Files\Volta\node.exe
```

Later, after environment changes/restart, the latest operator command showed:

```text
volta which node
C:\Users\mylr1\AppData\Local\Volta\tools\image\node\24.19.0\node.exe
```

The latest user-local `npm test` run completed the full root suite successfully, including authority, source ingestion/extraction, source-faithful, qualification, knowledge release, applicability, Workbench, RuntimePlan/Eligibility/Binding, DecisionResult, P06/P07/P08, Public API, SDK, reference integration, v0.3 release and GEOX adapter tests.

However, that console snippet did **not** include:

```text
git branch --show-current
git rev-parse HEAD
```

immediately before the run.

Therefore record it as:

```text
useful local operator evidence
but not exact-head repository release authority
```

Current GitHub workflows for the RP001 benchmark use:

```text
Node 24
```

Permanent local rule:

```text
do not infer active Node from old shell history
run:
volta which node
node --version
npm --version
git branch --show-current
git rev-parse HEAD
before reproducing an exact test
```

---

# 23. Important provider / API lessons

## ChatGPT subscription != OpenAI API billing

The user initially suspected no API quota when the host returned provider errors.

Do not infer billing exhaustion from:

```text
UND_ERR_CONNECT_TIMEOUT
OPENAI_NETWORK_FAILURE
```

Network/connectivity errors and quota/billing errors are different classes.

API usage is separately billed/configured from a ChatGPT subscription.

## A provider transport error is not a scientific result

Classify failures by stage.

Do not let:

```text
provider network failure
```

become:

```text
paper extraction failed scientifically
```

Likewise:

```text
schema invalid
```

is not the same as:

```text
source-faithful reject
```

and neither is the same as:

```text
scientific qualification reject
```

Keep these denominators separate.

## Never persist secrets in authority or handoff

Do not write:

```text
OPENAI_API_KEY
operator bearer token
provider secret
```

into semantic authority, git, benchmark JSON, handoff or model prompt.

---

# 24. Important Workbench / operator-token lessons

The operator token is generated separately, e.g.:

```text
ADR_OPERATOR_TOKEN
```

The user once confused:

```text
LOCAL_CHECKPOINT_RESTART_DURABLE_V1
```

with the token.

It is not a token.

A browser reload may leave the app UI in a different state from the shell environment.

A computer/shell restart loses environment variables.

If the API says:

```text
OPERATOR_AUTH_REQUIRED
```

first verify the actual token used by the browser/client against the current server environment.

Do not treat checkpoint restoration as authentication restoration.

---

# 25. Review / benchmark pitfalls that must not be repeated

## Pitfall: interpreting compiler-valid as source-faithful

`REVIEWABLE` means:

```text
the candidate can be materialized under compiler/schema rules
```

It does not mean:

```text
the paper supports it
```

## Pitfall: interpreting source-faithful as scientifically qualified

`ACCEPT_SOURCE_FAITHFUL` means:

```text
the source supports the claim/context
```

It does not mean:

```text
the study is strong enough for a scientific-use target
```

## Pitfall: interpreting Model C 0/8 as zero useful science

The dominant Model C failure was evidence binding, not gross factual hallucination.

Keep content quality and provenance quality separate.

## Pitfall: "repairing" a candidate during review

Reviewer must:

```text
ACCEPT unchanged
REJECT unchanged
ESCALATE
```

not silently rewrite it into something acceptable.

A repaired assertion is a new candidate and must have a new provenance path.

## Pitfall: using context evidence to repair claim evidence

If the assertion contains proposition B but claim-level locator only supports proposition A, the candidate fails even if SourceContext contains another locator supporting B.

This was deliberately enforced in the first benchmark.

## Pitfall: benchmark leakage

Never give the extractor:

```text
previous model output
previous review outcome
paper-specific prompt example
known benchmark defect list
reference verdict
```

The prompt-v3 paper-specific example leak was caught and removed before use.

## Pitfall: correlated review

Do not use the same identified model as LLM1 and LLM2 and call the result independent.

Same model => escalation.

## Pitfall: opening automated result before reference freeze

This destroys the intended independent calibration.

The artifact split exists specifically to prevent this.

## Pitfall: optimizing automation rate

The primary Phase-A gate is false acceptance, not "percentage auto-reviewed".

Safe escalation is better than incorrect automatic acceptance.

---

# 26. Rights / I/O pitfalls that must not be repeated

## Pitfall: treating Source.rights as permission

These remain provenance metadata.

Real use requires:

```text
RightsPolicy
-> RightsGrant
-> RightsDecision
-> assertRightsAllowed
```

## Pitfall: Source -> SourceArtifact silent inheritance

Forbidden.

They are distinct exact subjects.

## Pitfall: checking retention after bytes already entered storage

The exact Source must exist before RETAIN_FULLTEXT adjudication.

## Pitfall: using external-processing checkbox as permission

The checkbox is operator consent only.

RightsDecision is separate.

## Pitfall: unsupported obligation ignored

If the grant requires an obligation the adapter cannot enforce, block the side effect.

## Pitfall: "historical ALLOW" reused for a new action

RightsDecision is point-in-time.

A past ALLOW does not authorize a later action automatically.

## Pitfall: allowing raw Rights authority module bypass

RA01 includes static import-boundary protection. Consumers must use the hardened public surface.

---

# 27. CI / Git / stacked-PR pitfalls

## Exact-head evidence only

Do not reuse CI from an old head after:

```text
merge-forward
retarget
workflow change
branch update
```

Each material head move requires new exact-head evidence.

## Do not treat stacked PRs as merged main

At this handoff:

```text
#56/#60/#62/#61 are open Draft PRs
```

Their implementation exists in the branch stack, not current main.

## #58/#59 are dead ends

They are closed.

#62 is the valid RA02 path.

## Default-branch stub vs feature workflow

Current main workflow file is intentionally a fail-closed registration stub.

The #61 branch file is the real live benchmark.

When eventually integrating #61 to main, do not accidentally preserve the stub and discard the real workflow.

## Corpus branch vs main

The current RP001 benchmark must run on:

```text
feat/real-paper-benchmark-v1
```

not on main.

---

# 28. Current benchmark nonclaims

At this handoff, none of the following has been established:

```text
RP001 LLM1 extraction quality
RP001 LLM2 auto-review quality
RP001 false-accept rate
RP001 false-reject rate
real automation rate
scientific qualification accuracy
multi-paper benchmark quality
production agronomic recommendation correctness
yield/profit uplift
commercial willingness-to-pay
PMF
```

What **has** been established is narrower:

```text
real PDF acquisition/materialization works
exact RP001 bytes are pinned
rights gating exists on the branch execution graph
LLM1/LLM2 live runner is prepared
blind reference workflow is prepared
zero-cost live-runner dry run passes
deterministic benchmark metrics contract exists
current exact #61 CI is green
manual dispatch registration exists on main
```

---

# 29. Current product completion status

Use three separate statements.

## v0.3 infrastructure/software slice

```text
Paid Design-Partner Pilot Candidate
software release acceptance:
CLOSED in repository history via #54
```

## Real-paper knowledge production

```text
large-PDF ingestion:
implemented on #56 stack

manual extraction/review:
demonstrated

blind automated LLM2 review:
implemented on #60

rights-enforced real-paper path:
implemented on #62

RP001 real materialization:
demonstrated

first real RP001 LLM1->LLM2 calibration:
NOT YET RUN
```

## User's original end-to-end ADR product

```text
paper
-> validated agronomic knowledge base
-> GEOX field context
-> applicable agronomic advice / next instruction
```

Status:

```text
NOT YET COMPLETE
```

This distinction must survive into the next conversation.

---

# 30. Recommended post-benchmark product sequence

After enough real-paper source-faithful quality is demonstrated, the recommended development order is:

```text
A. real agronomy paper corpus
   -> validate extraction/review precision

B. Agronomic Knowledge representation
   -> qualified evidence usable by runtime

C. GEOX FieldContextManifest
   -> crop
   -> phenology
   -> soil
   -> weather/forecast
   -> rainfall/water status
   -> satellite
   -> management history

D. Applicability
   -> MATCH
   -> MISMATCH
   -> UNKNOWN
   -> CONFLICT
   -> CALIBRATION_REQUIRED / bounded limits

E. first narrow agronomic reasoning case
   -> irrigation / crop-water

F. output
   -> current agronomic assessment
   -> recommended action or ASK/ABSTAIN
   -> next observation / next check
   -> missing information
   -> conflicts / non-applicable evidence
   -> exact paper evidence
```

Do not jump straight from LLM extraction into unconstrained natural-language recommendation.

The knowledge-to-field transport boundary remains a core ADR value.

---

# 31. First-message checklist for the next conversation

The next conversation should first verify these exact facts:

```text
repo:
liyongshang44-max/agronomy-deployment-runtime

main:
80aafc9f25a184801a221fe2dbf2126fcd05a02f

current benchmark branch:
feat/real-paper-benchmark-v1

current benchmark head:
d45fbc3562a51fcb51d69d282bff7f009dc7cd05

RP001 PDF:
sha256:0e17a738d09b6d6638b103ce6a7b979cb9c7b2d9011e449ccdbc5d585dea6cab
6045990 bytes

#61 exact CI:
ADR Constitution 32266158355 SUCCESS
ADR Real Paper Benchmark 32266157341 SUCCESS
```

Then ask only:

```text
Has the RP001 live workflow been manually dispatched yet?
```

If **no**:

```text
do not redesign
do not add another benchmark framework
do not add Rights RA03
do not expand corpus

trigger the first exact live run
```

If **yes**:

```text
inspect terminal workflow state
then retrieve blind reference packet first
not the automated-result artifact
```

That is the current frontier.

---

# 32. Final handoff summary

The shortest accurate summary is:

```text
ADR's v0.3 software substrate is mature,
but the user's actual product is not "done".

The product goal is:
papers -> trustworthy agronomic knowledge
-> GEOX exact field context
-> applicable recommendation / next instruction.

This conversation:
- made large real PDFs operable;
- tested real model extraction;
- discovered evidence-granularity failures;
- froze an atomic extraction contract;
- replaced the screenshot-based semantic second review with blind LLM2 review;
- added minimum Rights Authority and pre-effect enforcement so real PDFs are not retained/read/egressed by metadata alone;
- froze and exactly materialized RP001;
- built a blind independent reference benchmark with a false-accept safety gate;
- enabled GitHub manual dispatch.

The system is now waiting for the first explicit real RP001 LLM1->LLM2 run.

Run that experiment before adding more architecture.
Then use the result to validate a real agronomic knowledge base and reconnect ADR to GEOX field-context reasoning.
```

This handoff is documentation only. It must not be treated as Architecture authority, scientific authority, benchmark result, release acceptance or proof that the first live RP001 model run occurred.
