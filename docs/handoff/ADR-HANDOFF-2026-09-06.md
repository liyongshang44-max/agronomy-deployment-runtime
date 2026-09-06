# Agronomy Deployment Runtime — ADR-3A Closure / ADR-3B Scientific Authority Continuation Handoff — 2026-09-06

Status:

```text
CONVERSATION HANDOFF ONLY
NOT ARCHITECTURE AUTHORITY
NOT NEW DEC AUTHORITY
NOT CTO ACCEPTANCE ARTIFACT
```

Snapshot time:

```text
2026-09-06 18:11 +08:00
```

Repository:

```text
liyongshang44-max/agronomy-deployment-runtime
```

Related read-only consumer repository:

```text
liyongshang44-max/GEOX
```

This handoff supersedes the previous continuation handoff whose snapshot time was:

```text
2026-09-06 09:21 +08:00
```

and whose immediate frontier was:

```text
CLOSE PR #203
→ ADR-1 COMPLETE
→ START ADR-2 HISTORICAL DECISION BASIS PRODUCT INTERFACE
```

That frontier is now historical.

Do not delete or retroactively rewrite earlier handoffs.

If anything in this handoff conflicts with:

```text
accepted Architecture documents
accepted DEC documents
merged contracts
protected main
exact PR heads
exact CI runs
live GitHub state
```

the live higher repository authority wins.

---

# 0. Executive continuation summary

The project has advanced materially since the previous handoff.

The Blueprint program state is now:

```text
ADR-1 Authority Model Freeze
= COMPLETE

ADR-2 Historical Decision Reproducibility
= COMPLETE

ADR-3 Real ADR Decision Authority
+ GEOX native shadow migration
= ACTIVE

ADR-3A
Legacy Scientific Decision Inventory
+ Authority Correspondence
+ Comparability Adjudication
= COMPLETE / CLOSED

ADR-3B
Exact Scientific Authority Acquisition
for the selected first migration subject
= CURRENT FRONTIER

ADR-4
Qualified Cross-Domain Consumption / Asset Core
= NOT STARTED

ADR-5
Production Graduation
= NOT STARTED
```

Current authoritative ADR protected main:

```text
6001a1240c092fa0c1655d87cf027e46cc4cff56
```

This is the merge commit of:

```text
PR #213

test(adr): qualify ADR-3A irrigation authority correspondence
```

PR #213 exact lineage:

```text
base =
26a8e72b44ec39ce28b3275bbd367c5e403172fd

qualified head =
0db5dfe3d959bc87218e4aa98959592f24f59df0

actual merge =
6001a1240c092fa0c1655d87cf027e46cc4cff56
```

Protected main was re-read after merge and still equals:

```text
6001a1240c092fa0c1655d87cf027e46cc4cff56
```

ADR-3A terminal adjudication is:

```text
FIRST ADR-3 MIGRATION SUBJECT
= SELECTED

CURRENT DEFENSIBLE SAME-DECISION ADR AUTHORITY
= ABSENT

EXACT SCIENTIFIC AUTHORITY GAP
= IDENTIFIED

ARCHITECTURE ADJUDICATION REQUIRED
= NO

READY FOR SHADOW-DUAL-RUN IMPLEMENTATION AUTHORIZATION
= NO
```

The selected first migration subject is:

```text
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1
```

The current ADR-3B frontier is therefore:

```text
EXACT SCIENTIFIC AUTHORITY ACQUISITION
FOR
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1
```

The most important new conclusion is not that ADR lacks irrigation science.

ADR already has a real irrigation scientific-authority substrate:

```text
KBS 2015 RGE irrigation protocol
→ Source / SourceArtifact
→ source-faithful Claim
→ SourceContext
→ ScientificQualificationDecision
→ QualifiedKnowledge
→ KnowledgeRelease
→ ApplicabilityAssessment
→ RuntimePlan
→ RuntimeEligibility
→ RuntimeBinding
```

The open question is narrower:

```text
DO WE HAVE A DEFENSIBLE
SAME-DECISION SEMANTIC AUTHORITY
FOR ONE EXACT ACTIVE GEOX
LEGACY IRRIGATION DECISION?
```

ADR-3A answered:

```text
NO — not for the selected active GEOX deficit decision.
```

Therefore ADR-3B is not an architecture build-out.

It is a scientific-authority acquisition / context-semantics problem.

---

# 1. Current exact ADR repository state

Protected/default main:

```text
6001a1240c092fa0c1655d87cf027e46cc4cff56
```

Latest closed ADR-3A PR:

```text
#213
MERGED / CLOSED
```

Exact candidate:

```text
0db5dfe3d959bc87218e4aa98959592f24f59df0
```

Exact merge:

```text
6001a1240c092fa0c1655d87cf027e46cc4cff56
```

PR #213 delta:

```text
3 commits
3 files
0 core package changes
```

Files:

```text
.github/workflows/productization-adr3a-irrigation-authority-correspondence.yml

acceptance/adr3a-irrigation-authority-correspondence/inventory.json

acceptance/adr3a-irrigation-authority-correspondence/run.mjs
```

No:

```text
packages/** changes
new DEC
new authority object
GEOX writes
cutover
Recommendation promotion
approval
execution
dispatch
```

---

# 2. PR #213 qualification and closure

Candidate-head dedicated ADR-3A workflow:

```text
ADR Productization — ADR-3A Irrigation Authority Correspondence
= SUCCESS
```

Candidate-head Constitution:

```text
ADR Constitution #2555
= SUCCESS
```

Ready-before-merge governance:

```text
reviews = []
review_threads = []
head unchanged
main unchanged
mergeable = true / clean
```

Ready transition:

```text
no new workflow introduced
```

Expected-head merge used:

```text
expected_head_sha =
0db5dfe3d959bc87218e4aa98959592f24f59df0
```

GitHub actual merge SHA:

```text
6001a1240c092fa0c1655d87cf027e46cc4cff56
```

Actual merge-SHA main-push trigger set:

```text
ADR Constitution #2556
= SUCCESS
```

The dedicated ADR-3A workflow did not run on main because its push filter intentionally matches the analysis branch rather than main.

Do not invent a second post-merge run.

---

# 3. ADR-1 status

ADR-1 Authority Model Freeze is COMPLETE.

The Blueprint responsibility map is now frozen onto existing authority.

No new generic authority object was required.

No new DEC was required.

DEC-0034 remains not justified / not reopened.

ADR still owns:

```text
Knowledge Authority
Science / Rule Authority
Applicability Authority
Target-Scope / Context-Binding Authority
Runtime / Decision Evaluation Authority
Decision-Basis Attribution / Provenance Authority
```

ADR still does NOT own:

```text
Field-State Authority
Human Approval Authority
Dispatch Authority
Machine Execution Authority
Enterprise Asset Qualification
```

---

# 4. ADR-2 status

ADR-2 Historical Decision Reproducibility is COMPLETE.

The final ADR-2 product state now includes:

```text
exact DecisionResult.ref entrypoint
read-only deterministic reconstruction
complete authorityGraph inspection
basisDigest stability
A03 exact retained-reference replay
D06 exact decision semantics
D04/R03 non-ACT provenance
DecisionResult publication-audit closure
A01 / K04 / K05 / K06 / A07 / A08 / D01 / D05 / Policy / execution-artifact exit-gate projection
clean npm-offline GEOX consumer verification
full no-lookahead matrix
forged ACT / ASK / WAIT / ABSTAIN fail-closed proofs
```

The canonical World P frozen basisDigest remains:

```text
sha256:103e0136fa7d0d3ad3ef8ff0e2746369a3b294a428d68e54b741dbeec8c50d45
```

ADR-2 proved that later valid evidence or later same-lineage authorities do not retroactively rewrite a historical decision basis.

This remains a permanent regression requirement.

---

# 5. Important ADR-2 merge progression

Do not resume old ADR-2 slices.

The relevant merge progression was:

```text
#203 → ADR-1 conformance map closure

#204 → historical Decision Basis read model

#205 → complete authority graph + cross-world fail-closed

#206 → A03 retained-reference replay projection

#207 → GEOX historical-basis projection transport

#208 → exact D06 ACT/WAIT/ASK/ABSTAIN semantics

#209 → non-ACT D04/R03 provenance closure

#210 → DecisionResult publication audit closure

#211 → complete ADR-2 exit-gate positive projection

#212 → final no-lookahead / forged-disposition negative closure
```

By the time main reached:

```text
26a8e72b44ec39ce28b3275bbd367c5e403172fd
```

ADR-2 was COMPLETE.

Do not restart HistoricalDecisionAuthority / DecisionEvidenceBundle work.

---

# 6. ADR-3 start condition is now satisfied

ADR-3 required:

```text
ADR-1 COMPLETE
+
ADR-2 usable historical decision basis reconstruction
```

Both are now true.

Therefore ADR-3 is legitimately active.

However:

```text
CUTOVER = NOT AUTHORIZED
```

ADR-3 currently remains shadow/migration qualification work.

---

# 7. GEOX integration substrate status

GEOX P5 / #3518 one-shot read-only observer remains accepted as integration substrate.

It provides:

```text
explicit opt-in
one invocation
read-only PostgreSQL observation
ADR projection observation
no write
no approval
no dispatch
no execution
```

But it does NOT establish:

```text
legacy-vs-ADR same-decision dual-run
production authority
cutover
```

Its existing comparison status was correctly fail-closed around missing same-domain input equivalence.

Do not rebuild a second transport.

Existing DecisionResult transport remains reusable.

---

# 8. ADR-3A authorization that governed the completed work

ADR-3A was explicitly bounded to:

```text
LEGACY SCIENTIFIC DECISION INVENTORY
+
AUTHORITY CORRESPONDENCE
+
COMPARABILITY ADJUDICATION
```

Allowed:

```text
ADR migration inventory
ADR authority correspondence matrix
ADR-only acceptance / qualification artifacts
non-authority comparison evidence design
scientific-source provenance analysis
```

Forbidden:

```text
GEOX writes
GEOX legacy replacement
GEOX route/runtime mutation
ADR production cutover
DecisionResult → GEOX Recommendation promotion
approval
operation plan
task
dispatch
machine execution
copying legacy hardcodes into ADR authority
```

Those ceilings remain valid for ADR-3B unless separately authorized.

---

# 9. GEOX legacy irrigation inventory — core conclusion

Do NOT collapse all irrigation code into one rule.

The machine inventory identified multiple materially distinct surfaces.

At minimum:

```text
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1

GEOX-COMMERCIAL-IRRIGATION-DIAGNOSIS-V1

GEOX-COMMERCIAL-IRRIGATION-REQUIREMENT-V1

GEOX-COMMERCIAL-HARD-RULE-MOISTURE-DRY-V1

corn water-balance v1

corn water-balance v2

Judge v2 irrigation requirement path
```

There are also irrigation/moisture-related historical or unreachable surfaces which must not be selected merely because they are easy to test.

---

# 10. Selected first ADR-3 migration subject

The first migration subject is frozen as:

```text
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1
```

Why this subject:

```text
ACTIVE_RUNTIME
+
COMMERCIAL_REACHABLE
+
material Recommendation gate
+
explicit observable input
+
narrow decision boundary
+
scientific proposition independently sourceable
+
representable in existing ADR authority model
+
no synthetic action translation required
```

Do not silently replace it with:

```text
whole irrigation subsystem
corn water-balance v2
irrigation requirement amount model
KBS RGE trigger
```

without a new explicit migration adjudication.

---

# 11. GEOX selected subject — current legacy semantics

The selected deficit decision consumes normalized soil-moisture input.

Current decision semantics include:

```text
DEFICIT_THRESHOLD = 0.22

deficit_detected =
normalized_soil_moisture < 0.22
```

There are also lower bands around approximately:

```text
< 0.16
< 0.20
```

for severity classification.

The exact legacy `.22` constant must remain classified as:

```text
LEGACY COMPARISON EVIDENCE
```

It is NOT yet qualified scientific truth.

---

# 12. Separate GEOX irrigation requirement surface

The irrigation requirement path is a separate material scientific/calculation surface.

It uses a combination including:

```text
target soil moisture = 0.22
root-zone depth = 300 mm
application efficiency = 0.85
72h rainfall
72h ET0
crop-stage coefficient
```

and produces a gross irrigation requirement / amount.

Do NOT conflate this with the selected deficit predicate.

The selected ADR-3 first subject is currently the deficit decision, not the complete amount formula.

---

# 13. Separate GEOX diagnosis surface

`irrigation_diagnosis_v1` is also separate.

It represents diagnosis / state-to-deficit semantics.

It is not automatically the same scientific proposition as:

```text
irrigation_requirement_skill_v1
```

and not automatically the same as:

```text
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1
```

Keep these rows separate in any future migration matrix.

---

# 14. Corn rule engine correction — permanent pitfall

A prior temporary interpretation was wrong and has been corrected from exact source.

Do NOT repeat the old claim that corn v1 and v2 both fire together.

Actual rule engine semantics are:

```text
ordered rules
→ first match
→ return
```

Therefore:

```text
v1 source predicate:
soil_moisture < 20

v2 source predicate:
soil_moisture < 25

v2 effective runtime interval:
20 <= soil_moisture < 25
```

Also do NOT reuse the old temporary v2 numbers:

```text
12 mm
0.90 confidence
+10 expected effect
```

The corrected exact-source facts are approximately:

```text
predicate <25
expected effect +15
mapped confidence 0.8
```

This correction is already reflected in ADR-3A machine inventory.

---

# 15. Reachability classification pitfall

Do not trust comments such as:

```text
LEGACY AGRONOMY SKILLS CATALOG
migration/bootstrap only
DO_NOT_USE_LEGACY_AGRONOMY_SKILLS_IN_RUNTIME
```

without checking call graph.

The audit found a real conditional path:

```text
ruleSkills
→ rule_engine
→ generateAgronomyRecommendation
→ agronomy_agent
→ recommendation persistence
```

and runtime can enable the agent.

Therefore file-header labels are not sufficient reachability proof.

Use machine call graph / route / job reachability.

---

# 16. Legacy unreachable surfaces

Some irrigation/moisture logic is currently classified as legacy/unreachable and must not be picked merely because it is convenient.

Examples include historical `water_state_estimate_v1` style thresholds where no active runtime caller was found.

The older agronomy-engine/crop-catalog irrigation path also did not satisfy current active/reachable selection requirements.

The first migration subject must remain tied to real active/commercial behavior.

---

# 17. Tomato and fertility separation

`tomato_fertilize` is fertilization logic, not an irrigation migration subject.

Fertility precheck may produce categorical moisture information such as:

```text
moisture_constraint = dry
```

which can feed an irrigation Recommendation hard rule.

That is an upstream dependency / context transformation.

Do not rename it as an independent irrigation authority.

---

# 18. Current ADR irrigation authority substrate

ADR already owns a real, source-faithful irrigation authority world based on KBS 2015 Resource Gradient Experiment protocol material.

This is a major architectural fact:

```text
REUSABLE AUTHORITY INFRASTRUCTURE
= YES
```

The chain already demonstrates:

```text
Source
→ SourceArtifact
→ Claim
→ SourceContext
→ ScientificQualificationDecision
→ QualifiedKnowledge
→ KnowledgeRelease
→ ApplicabilityAssessment
→ RuntimePlan
→ RuntimeEligibility
→ RuntimeBinding
```

Therefore:

```text
DO WE HAVE ANY IRRIGATION SCIENTIFIC AUTHORITY?
```

is CLOSED.

---

# 19. KBS exact scientific proposition

The KBS authority is not generic irrigation.

Its semantic scope is explicitly tied to:

```text
crop.code = soybean
experiment.name = Resource Gradient Experiment
```

The scientific proposition is approximately:

```text
plant-available-water is negative
for two consecutive days
→ schedule irrigation next day
```

with amount semantics tied to the previous-day PAW deficit in the protocol world.

Do not weaken this to:

```text
soil is dry → irrigate
```

---

# 20. KBS exact source artifact hash

The retained KBS source artifact used in the real irrigation authority world has been frozen with exact content hash:

```text
sha256:8d18c0fcc5a2b536d675e9b1cdafc16fbeedb19204b67c11ae81f887844f71d9
```

Preserve this as exact evidence identity.

---

# 21. KBS exact authority identities

Current ADR-3A inventory records the relevant lineage identities including:

```text
Source
source.real-kbs-rge-runtime-v1.protocol@1

SourceArtifact
artifact.real-kbs-rge-runtime-v1.page23@1

Claim
claim.real-kbs-rge-runtime-v1.two-day-trigger@1

SourceContext
source-context.real-kbs-rge-runtime-v1.two-day-trigger@1

ScientificQualificationDecision
qualification.real-kbs-rge-runtime-v1.two-day-trigger@1

QualifiedKnowledge
knowledge.real-kbs-rge-runtime-v1.two-day-trigger@1

KnowledgeRelease
release.real-kbs-rge-runtime-v1@1

ApplicabilityAssessment
applicability.real-kbs-rge-runtime-v1@1

RuntimeEligibility
runtime-eligibility.real-kbs-rge-runtime-v1@1

RuntimeBinding
runtime-binding.real-kbs-rge-runtime-v1@1
```

Do not substitute logical-id search for exact refs when replaying this lineage.

---

# 22. KBS positive runtime composition

The real KBS irrigation target-context world already demonstrated:

```text
A08
scientificUseStatus = QUALIFIED
transportStatus = DIRECTLY_APPLICABLE
runtimeUse = ALLOWED

R01
openRequirements = []
alternatives = 1
STRUCTURALLY_COMPLETE

R03
RUNTIME_ELIGIBLE
LEGAL alternatives = 1

D01
RuntimeBinding = CREATED
```

This proves the frozen ADR authority model can represent and compose real irrigation authority.

It does not prove same-decision authority for GEOX.

---

# 23. KBS deployment ceiling

The real irrigation positive world remains bounded as:

```text
useClass = TEST_ONLY
runtimeEnvironment = STAGING
rolloutStage = SHADOW
```

Do not describe it as production authority.

Do not infer ADR-3 cutover from its success.

---

# 24. ADR-3A exact comparability result

The selected GEOX subject and KBS authority share an action domain but not the same scientific proposition.

Frozen status:

```text
SAME_ACTION_DOMAIN_DIFFERENT_SCIENTIFIC_PROPOSITION
```

Do NOT use:

```text
SIMILAR
CLOSE_ENOUGH
IRRIGATION_MATCH
```

---

# 25. KBS vs GEOX selected subject — dimension mismatch

At least these dimensions are materially non-equivalent:

```text
crop target
soybean vs GEOX field target

metric semantics
plant-available-water in mm vs normalized soil-moisture fraction

temporal semantics
two consecutive days vs instantaneous threshold

trigger semantics
PAW < 0 vs normalized soil moisture < 0.22

action timing
next day vs current Recommendation-gate semantics

amount semantics
KBS prior-day deficit vs separate GEOX amount pipeline
```

Therefore KBS cannot simply be reused as the authority for the selected GEOX decision.

---

# 26. ADR-3A terminal B

ADR-3A is now CLOSED at terminal B:

```text
FIRST ADR-3 MIGRATION SUBJECT
= SELECTED

CURRENT DEFENSIBLE AUTHORITY
= ABSENT

EXACT SCIENTIFIC AUTHORITY GAP
= IDENTIFIED
```

Not terminal A.

Not terminal C.

No architecture adjudication is currently required.

---

# 27. Current ADR-3B frontier

ADR-3B is now the active research/qualification frontier:

```text
EXACT SCIENTIFIC AUTHORITY ACQUISITION
FOR
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1
```

Current problem:

```text
not code
not transport
not runtime composition
not new authority object
```

The problem is:

```text
same-decision scientific semantics
+
measurement/context authority
```

---

# 28. Current ADR-3B machine-level conclusion

Latest research/adjudication direction is:

```text
DEFENSIBLE IRRIGATION SCIENCE
= ACQUIRABLE

CURRENT GEOX INPUT SEMANTICS
= INSUFFICIENT FOR SAME-DECISION EQUIVALENCE

LEGACY .22 THRESHOLD
= NOT SCIENTIFICALLY LAUNDERED

ARCHITECTURE GAP
= NO

CONTEXT / MEASUREMENT AUTHORITY GAP
= YES
```

This is the current continuation frontier, not yet a new merged architecture contract.

---

# 29. The current .22 problem

There is no defensible evidence supporting this generic proposition:

```text
absolute VWC = 0.22
= universal defensible irrigation trigger
```

Do not search for literature merely to validate the existing GEOX constant.

The legacy constant is evidence of current behavior, not evidence of scientific truth.

---

# 30. The deeper scientific decision input problem

Current GEOX decision input is approximately:

```text
latest normalized soil-moisture point
```

The more defensible irrigation science direction is closer to:

```text
measured soil water
→ convert/reference against soil water-holding properties
→ root-zone available water / depletion
→ crop + growth-stage specific allowable depletion
→ irrigation decision
```

Therefore the open authority question is not simply “what threshold replaces 0.22?”.

---

# 31. Required scientific-context semantics

The next defensible authority candidate is expected to require explicit support for dimensions such as:

```text
soil hydraulic context
root-zone context
crop identity
growth stage
water-depletion semantics
measurement support
metric definition
unit / normalization semantics
```

None of these may be inferred from a single normalized sensor point unless governed evidence explicitly supports the inference.

---

# 32. Current likely comparability fork

The next fail-closed comparability proof may resolve to a state such as:

```text
AUTHORITY_CANDIDATE_COMPARABLE_WITH_EXPLICIT_LIMITATIONS
```

or, more likely if the metrics remain semantically different:

```text
METRIC_SEMANTICS_NOT_EQUIVALENT
```

Do not force a `COMPARABLE` result.

If metric semantics are not equivalent, that is a valid engineering result.

---

# 33. Consequence if METRIC_SEMANTICS_NOT_EQUIVALENT

If the final ADR-3B candidate proves:

```text
METRIC_SEMANTICS_NOT_EQUIVALENT
```

then ADR-3B should NOT hard-force DecisionResult parity against the legacy `.22` behavior.

The next frontier should instead become:

```text
GEOX → ADR governed root-zone soil-water state/context
```

so that the ADR decision is made from scientifically defensible input semantics.

This still does not authorize GEOX writes or cutover.

---

# 34. Scientific source acquisition rule

External scientific-source acquisition must begin from the exact missing authority question.

It must NOT be:

```text
search for some irrigation paper
```

and must NOT be:

```text
search for a paper that contains 0.22
```

The query should be framed around:

```text
crop / stage
soil-water metric
root-zone semantics
soil hydraulic context
allowable depletion / irrigation initiation
measurement basis
temporal semantics
```

---

# 35. Required source-faithful authority chain

Any new scientific authority candidate must enter ADR as:

```text
Source
→ SourceArtifact
→ source-faithful Claim(s)
→ SourceContext
→ ScientificQualificationDecision
→ QualifiedKnowledge
→ ApplicabilityAssessment
```

before it can become a candidate for runtime/DecisionResult comparison.

Do not jump directly from paper text to Policy constant.

---

# 36. Current intended ADR-3B qualification sequence

The correct next sequence is:

```text
1. acquire independent scientific source(s)

2. freeze SourceArtifact bytes / hashes

3. extract source-faithful Claims

4. preserve SourceContext REPORTED / NOT_REPORTED

5. qualify scientific authority

6. create QualifiedKnowledge candidate

7. bind exact target/context through A08

8. reuse exact GEOX source facts in fail-closed comparability proof

9. adjudicate exact dimension-by-dimension comparability
```

Do not skip directly to DecisionResult parity.

---

# 37. Scientific Compiler / qualification capability conclusion

Current frozen ADR Scientific Compiler / qualification model is sufficient for the authority question currently visible.

It already supports claim classes such as:

```text
PARAMETER
RELATIONSHIP
OPERATIONAL_RECOMMENDATION
BOUNDARY_CONSTRAINT
```

and forces source context families to be explicit rather than silently defaulted.

Therefore:

```text
NEW DEC
= NOT REQUIRED

NEW GENERIC AUTHORITY OBJECT
= NOT REQUIRED

ADR EXISTING AUTHORITY MODEL
= SUFFICIENT
```

No architecture gap is currently proven.

---

# 38. Current blocker

The current blocker is not code.

It is not CI.

It is not package transport.

It is the final same-decision scientific boundary:

```text
what governed scientific input/metric/context
constitutes the irrigation-deficit decision
for the exact GEOX target?
```

Until that is defensible, ADR must not claim same-decision authority parity.

---

# 39. World P status

World P remains important, but not as the ADR-3 first migration subject.

Use it for:

```text
transport regression
target-correspondence regression
historical basis regression
non-comparability regression
```

Do not reintroduce soybean planting population as the first ADR-3 migration subject.

---

# 40. DecisionResult transport status

Existing DecisionResult transport is sufficient and should be reused.

Do not create a second shadow transport protocol.

ADR-3 comparator evidence, when introduced, must remain non-authority.

It must not:

```text
select winner
authorize replacement
create Recommendation
create approval
create dispatch
create execution
```

---

# 41. Future comparator evidence requirements

When same-domain semantics are ready, comparison evidence should bind at least:

```text
exact GEOX commit
exact legacy source hashes
exact governed GEOX input/context refs
exact ADR DecisionResult ref
exact ADR historical decision basis
exact authority refs
exact comparator version
comparison dimension results
```

Allowed high-level outcomes include:

```text
COMPARABLE
DIVERGENT
NOT_COMPARABLE
LEGACY_BEHAVIOR_WITH_NO_DEFENSIBLE_AUTHORITY_BASIS
```

The comparator is evidence, not authority.

---

# 42. Same-decision comparison dimensions

Do not compare only:

```text
IRRIGATE vs IRRIGATE
```

At minimum compare:

```text
target / crop
metric semantics
units / normalization
temporal semantics
threshold / trigger
required context
missing-data behavior
action semantics
action timing
material parameters
source authority
limitations
abstention behavior
```

---

# 43. No generic architecture expansion

The current evidence says:

```text
missing specific scientific authority
!=
missing generic ADR architecture
```

Only stop for architecture adjudication if a repeated real authority question cannot be represented by the frozen current authority graph.

Nothing in ADR-3A/3B currently proves that.

---

# 44. Do not launder legacy constants

Permanent ADR-3 pitfall:

```text
read legacy constant
→ search vaguely related paper
→ publish same number as ADR authority
```

is prohibited.

Examples of values that must not be laundered merely because GEOX currently uses them:

```text
0.22
300 mm
0.85
20 / 25 / 35 style thresholds
confidence constants
expected-effect constants
```

These remain legacy behavior until independently sourced and qualified.

---

# 45. Do not confuse point VWC with root-zone depletion

A normalized point soil-moisture observation is not automatically equivalent to:

```text
root-zone available water
root-zone depletion
management allowable depletion
plant-available water
```

Metric equivalence requires explicit authority.

This is now one of the main ADR-3B pitfalls.

---

# 46. Do not infer soil hydraulic context

Soil hydraulic properties, field capacity, wilting point, root-zone depth and related transformation semantics must be explicitly supported.

Do not backfill them from generic agronomy knowledge.

Do not infer them because a sensor reports volumetric water content.

---

# 47. Do not infer crop stage

Growth-stage dependence is scientifically material to many irrigation decisions.

If source authority requires crop stage:

```text
stage NOT_REPORTED
```

must not become an inferred current stage.

Use governed context only.

---

# 48. Keep diagnosis and amount separate

Do not merge:

```text
deficit detection
```

with:

```text
irrigation amount calculation
```

or:

```text
Recommendation lifecycle
```

They are separate scientific/operational questions and may have different authorities.

---

# 49. Keep ADR decision authority separate from operational authority

Even if ADR eventually becomes normative agronomy authority:

```text
DecisionResult.ACT
!= approval
!= dispatch
!= machine execution
```

B-Line/GEOX operational authority remains separate.

---

# 50. GEOX remains read-only during ADR-3B

Current working ceiling:

```text
GEOX = READ ONLY
```

Do not:

```text
change decision_engine_v1
change irrigation routes
replace legacy thresholds
write Recommendation
change scheduler
change approval
change execution
```

without explicit later authorization.

---

# 51. ADR-3A machine artifact now lives on main

The machine inventory / correspondence artifact is in protected main through #213.

It should be treated as qualification evidence.

It is not new architecture authority.

It does not authorize cutover.

---

# 52. Current handoff branch

This handoff is being written on a dedicated docs branch:

```text
docs/handoff-2026-09-06-adr3b
```

It is based on:

```text
main @
6001a1240c092fa0c1655d87cf027e46cc4cff56
```

The handoff itself is conversation-continuation evidence only.

Do not treat it as Architecture / DEC authority.

---

# 53. What is complete

The following are complete:

```text
ADR-1 Authority Model Freeze

ADR-2 Historical Decision Reproducibility

ADR-3A legacy irrigation decision inventory

ADR-3A active/reachable classification

ADR-3A KBS authority inventory

ADR-3A exact migration matrix

ADR-3A first subject selection

ADR-3A terminal-B adjudication

PR #213 qualification / merge / post-merge closure
```

---

# 54. What is not complete

The following are not complete:

```text
ADR-3B independent scientific-source acquisition

same-metric / same-target / same-time comparability proof

root-zone soil-water context authority for the selected GEOX subject

same-domain shadow dual-run

DecisionResult parity qualification

ADR cutover

GEOX legacy replacement

production authority
```

---

# 55. Current exact frontier

Resume from:

```text
ADR protected main =
6001a1240c092fa0c1655d87cf027e46cc4cff56

ADR-3A = COMPLETE / CLOSED

selected migration subject =
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1

current ADR-3B question =
acquire defensible same-decision scientific authority
without laundering the legacy .22 threshold
```

---

# 56. Immediate next task

Do not start with GEOX code.

The next task is:

```text
ADR-3B
SCIENTIFIC-SOURCE ACQUISITION
+
MEASUREMENT / CONTEXT AUTHORITY QUALIFICATION
```

The first research question should be framed around the exact governed irrigation-deficit semantics, not around reproducing `.22`.

---

# 57. ADR-3B first research objective

Find high-quality scientific/extension authority that can support a defensible irrigation-initiation decision for an exact crop/soil/stage context using an explicitly defined soil-water metric.

Candidate scientific structure:

```text
measured soil water
+
soil water-holding properties
+
root-zone depth
+
crop / growth stage
→ root-zone depletion / available water
→ allowable depletion / irrigation initiation
```

Do not assume this structure is universal; source-faithful qualification decides.

---

# 58. Scientific-source quality floor

Prefer authoritative agronomic sources such as:

```text
peer-reviewed primary research
land-grant extension
FAO / government agronomic manuals
recognized irrigation science references
crop-specific irrigation scheduling protocols
```

The source must be independently defensible and context-specific enough to answer the selected authority question.

---

# 59. Scientific acquisition deliverable

The first ADR-3B repository artifact should be test-only / qualification-only and include:

```text
Source
SourceArtifact
source-faithful Claims
SourceContext
ScientificQualificationDecision
QualifiedKnowledge candidate
```

with explicit:

```text
REPORTED / NOT_REPORTED
```

context status.

Do not prematurely create production policy.

---

# 60. Next comparability proof

After scientific authority candidate exists, reuse exact GEOX source facts from ADR-3A.

Build a fail-closed matrix over:

```text
target
crop
stage
metric definition
unit semantics
measurement normalization
root-zone semantics
temporal semantics
trigger semantics
action semantics
limitations
```

Do not compare only numeric thresholds.

---

# 61. If the candidate is comparable with limitations

If machine adjudication yields:

```text
AUTHORITY_CANDIDATE_COMPARABLE_WITH_EXPLICIT_LIMITATIONS
```

then the next step may be an ADR-only shadow decision candidate and non-authority comparator.

Still no GEOX cutover.

Still no production authority.

---

# 62. If metric semantics are not equivalent

If machine adjudication yields:

```text
METRIC_SEMANTICS_NOT_EQUIVALENT
```

then do not force the ADR candidate to consume the same weak legacy input just to achieve parity.

The next frontier becomes governed input/context acquisition:

```text
GEOX/MCFT state
→ exact root-zone soil-water context
→ ADR ContextDatum / ContextManifest
```

subject to the relevant authority ownership boundaries.

---

# 63. MCFT boundary

If future ADR-3B requires better field-state / root-zone state:

```text
ADR must consume governed field-state authority
```

not invent it.

Field-state authority remains MCFT-owned.

ADR may define required context semantics.

It must not silently become field-state authority.

---

# 64. Target identity boundary remains unchanged

Continue preserving:

```text
Provider Native Subject Identity
!= ADR Target-Scope / Context-Binding Authority
!= GEOX Field Subject Identity
```

Root-zone scientific context does not erase subject-identity boundaries.

---

# 65. No new transport

Existing DecisionResult projection/transport already works.

Do not add another transport merely because ADR-3 is now about irrigation.

The scientific authority/content changes.

The transport does not need to.

---

# 66. No public release distraction

Do not prioritize:

```text
npm publication
GitHub Release
new public semver
new installer channel
```

ADR-3B is an authority/scientific evidence problem, not a distribution problem.

---

# 67. No commercial overclaim

ADR-3A/3B technical evidence does not establish:

```text
commercial demand
customer willingness to pay
insurance adoption
production readiness
```

Keep engineering/scientific authority evidence separate from market evidence.

---

# 68. No cutover before same-decision proof

Do not move to:

```text
ADR authoritative
GEOX legacy shadow
```

until the selected first migration subject has:

```text
defensible same-decision authority
same governed input/context
shadow comparison evidence
divergence attribution
explicit cutover authorization
```

---

# 69. No DecisionResult parity laundering

A matching action code does not prove same-decision equivalence.

Example:

```text
GEOX → IRRIGATE
ADR  → IRRIGATE
```

may still be scientifically non-comparable if:

```text
metric
context
temporal semantics
authority
```

differ.

---

# 70. No forced legacy parity

If independent science says the legacy decision is based on an indefensible or under-specified input semantic, ADR should not be bent to reproduce it.

A valid comparison result may be:

```text
LEGACY_BEHAVIOR_WITH_NO_DEFENSIBLE_AUTHORITY_BASIS
```

or:

```text
NOT_COMPARABLE
```

This is useful migration evidence.

---

# 71. Source-faithfulness rule

Do not generalize a source beyond:

```text
crop
geography
soil
experiment
stage
management system
measurement design
season/year
```

actually supported by the source.

This is especially important for irrigation thresholds.

---

# 72. Units and normalization rule

Never equate:

```text
fraction
percent
mm water depth
PAW
VWC
relative depletion
management allowed depletion
```

because the numeric ranges appear similar.

Unit/metric semantics must be explicit authority.

---

# 73. Temporal semantics rule

Do not erase differences among:

```text
instantaneous point threshold
hourly average
daily mean
consecutive-day persistence
forecast-window trigger
next-day scheduling
```

The KBS two-day PAW trigger and GEOX instantaneous `.22` predicate are not temporally equivalent.

---

# 74. Action-semantics rule

Distinguish:

```text
deficit detected
irrigation indicated
IRRIGATE action
irrigation amount
scheduled irrigation timing
executed irrigation
```

These are not one object or one authority question.

---

# 75. Corn rule-engine pitfall remains permanent

Future engineers must not resume from the incorrect earlier summary.

Machine/source truth wins:

```text
first match / return
```

not multi-hit accumulation for the audited corn path.

This affects effective threshold intervals and comparison behavior.

---

# 76. Reachability labels must be machine-supported

Use only explicit statuses such as:

```text
ACTIVE_RUNTIME
COMMERCIAL_REACHABLE
SHADOW_ONLY
ACCEPTANCE_ONLY
DEMO_ONLY
LEGACY_UNREACHABLE
```

Do not invent a migration subject from dead code.

Do not trust file comments over call graph.

---

# 77. ADR-3A terminal-B artifact is evidence, not authority

`inventory.json` and its run lane freeze the migration adjudication.

They do not create:

```text
scientific authority
cutover authority
production authority
```

They are qualification evidence.

---

# 78. Current handoff-specific no-go list

Do not next:

```text
modify GEOX
replace .22 with a literature number
copy 300 mm / .85 into ADR policy
open a new generic authority DEC
create a second DecisionResult transport
force World P into irrigation migration
claim KBS soybean/RGE authority covers generic GEOX irrigation
claim same action = same decision
start production cutover
create Recommendation/approval/task/dispatch/execution
```

---

# 79. Recommended first actions in the next conversation

Start with live-state revalidation:

```text
1. read ADR protected main
expect 6001a124...

2. confirm #213 remains merged / closed

3. confirm no new ADR-3B authoritative branch/PR has superseded this handoff

4. read ADR-3A inventory.json from main

5. preserve selected subject
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1
```

Then proceed to independent scientific-source acquisition.

---

# 80. ADR-3B stopping conditions

Continue until one of these becomes true:

```text
A.
DEFENSIBLE SAME-DECISION AUTHORITY CANDIDATE
= AVAILABLE

COMPARABILITY
= EXACT OR EXPLICITLY LIMITED

READY FOR SHADOW-DUAL-RUN IMPLEMENTATION AUTHORIZATION
```

or:

```text
B.
SCIENTIFIC AUTHORITY CANDIDATE
= AVAILABLE

BUT GEOX INPUT / METRIC / CONTEXT
= NOT EQUIVALENT

NEXT GAP
= GOVERNED MEASUREMENT / ROOT-ZONE CONTEXT
```

or:

```text
C.
CURRENT ADR AUTHORITY MODEL
CANNOT REPRESENT REQUIRED SCIENTIFIC QUESTION

ARCHITECTURE ADJUDICATION
= REQUIRED
```

Current evidence strongly suggests B is plausible and C is not currently supported.

---

# 81. Current strategic conclusion

The program has moved through three distinct questions:

```text
1. Can ADR express real agronomic authority?
YES

2. Can ADR expose/reproduce historical decision authority coherently?
YES

3. Can ADR replace one exact active GEOX legacy scientific decision?
NOT YET
```

The remaining issue is now scientifically precise.

The current legacy GEOX decision is based on a normalized moisture point and a `.22` threshold.

The defensible irrigation-science direction appears to require a governed relationship among:

```text
measurement
soil hydraulic properties
root-zone water state
crop
stage
allowable depletion
irrigation decision
```

The project correctly refused to launder the legacy constant into ADR authority.

That is the current highest-value result.

---

# 82. Final continuation statement

Current authoritative ADR main:

```text
6001a1240c092fa0c1655d87cf027e46cc4cff56
```

ADR-1:

```text
COMPLETE
```

ADR-2:

```text
COMPLETE
```

ADR-3A:

```text
COMPLETE / CLOSED
terminal B
```

Selected first migration subject:

```text
GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1
```

Current ADR-3B frontier:

```text
EXACT SCIENTIFIC AUTHORITY ACQUISITION
+
MEASUREMENT / CONTEXT AUTHORITY QUALIFICATION
```

Current machine-level thesis:

```text
DEFENSIBLE IRRIGATION SCIENCE
= ACQUIRABLE

CURRENT GEOX INPUT SEMANTICS
= INSUFFICIENT FOR SAME-DECISION EQUIVALENCE

LEGACY .22 THRESHOLD
= NOT SCIENTIFICALLY LAUNDERED

ARCHITECTURE GAP
= NO

CONTEXT / MEASUREMENT AUTHORITY GAP
= YES
```

The immediate next move is not cutover and not architecture growth.

It is:

```text
independent scientific source acquisition
→ source-faithful authority construction
→ exact metric/context comparability adjudication
```

If exact metric semantics remain non-equivalent, do not force DecisionResult parity.

Move the frontier to governed root-zone soil-water context instead.

That is the correct continuation point.
