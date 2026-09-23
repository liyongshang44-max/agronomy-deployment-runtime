# ADR Agronomic Knowledge Applicability Casebook — Public Evidence Pilot V1

Status: CUSTOMER-FACING DEMONSTRATION / NOT ARCHITECTURE AUTHORITY / NOT SCIENTIFIC QUALIFICATION AUTHORITY

Date: 2026-09-23

Repository baseline: aaf5e83ab9a302a935661e284828a91aa58448d1

Product scope: Agronomy Deployment Runtime (ADR) pilot-v0.3 applicability, context, provenance and agronomist-workbench semantics.

## 1. What this casebook demonstrates

Agronomy Deployment Runtime is designed to answer a practical question:

> Given a real agronomic source, a specific target field context and a defined use purpose, is the knowledge actually justified for use here, now and for this purpose?

This casebook uses real public agronomy sources and synthetic target cases to demonstrate how ADR separates:

- source material from qualified knowledge;
- source context from target context;
- applicability from recommendation;
- scientific applicability from operational authorization;
- missing information from negative evidence;
- exact unit conversion from scientific extrapolation;
- transport uncertainty from conflict;
- expert review from automatic action.

The demo deliberately does not produce an irrigation order, pesticide recommendation, fertilizer prescription or machine instruction.

## 2. Important boundary

Publication by a university, extension service or industry research network does not automatically become ADR QualifiedKnowledge.

For this casebook:

1. The public source is treated as a candidate SourceArtifact.
2. Source-supported claims are extracted conservatively.
3. Source context is preserved only where the source supports it.
4. Synthetic target cases are clearly marked as synthetic.
5. Applicability is evaluated using ADR frozen status vocabulary.
6. Where a case says DIRECTLY_APPLICABLE, it means the claim can enter the target decision world under the stated demo assumptions. It does not mean the action is automatically recommended, safe, authorized or economically optimal.
7. No case in this document is commercial, regulatory, pesticide-label or production authority.

## 3. ADR status vocabulary used

The expected applicability outcomes are drawn from the frozen ADR public runtime contract:

- DIRECTLY_APPLICABLE
- APPLICABLE_WITH_GOVERNED_TRANSFORM
- CALIBRATION_REQUIRED
- BOUNDED_EXTRAPOLATION
- UNRESOLVED
- CONFLICT
- NOT_RELEVANT

The current pilot public surface intentionally does not expose a generic recommendation endpoint or production DecisionResult authority.

## 4. Public source corpus

### S1 — University of Nebraska–Lincoln CropWatch: late-season irrigation

Source:
https://cropwatch.unl.edu/2024/time-consider-using-remaining-stored-soil-water-irrigated-corn-and-bean-fields/

Source-supported candidate claims used in this casebook:

- After dough stage in corn, late-season planning may allow the top four feet of the active root zone to decline to about 40% remaining plant-available water, equivalent to about 60% depletion.
- The analogous late-season point for soybean is after R5, not R4.
- Remaining crop water need depends on current crop stage.
- Approximate corn water use to maturity is listed as 7.5 inches at R4, 5.0 inches at R4.7, 3.75 inches at R5 quarter milk line, 2.25 inches at R5 half milk line, 1.0 inch at R5 three-quarter milk line and zero at R6.
- Soil texture changes the amount of plant-available water.
- Soil-water monitoring is the preferred method for estimating remaining available water.
- Rainfall and irrigation should be considered together when estimating remaining water required to reach maturity.

### S2 — University of Nebraska–Lincoln CropWatch: sensor-specific irrigation approaches

Source:
https://cropwatch.unl.edu/managing-corn-irrigation-south-central-nebraska-insights-2025-under-new-groundwater-allocations/

Source-supported candidate claims used in this casebook:

- In the reported Watermark treatment, the average of sensors at one, two and three feet was used as the irrigation signal.
- A 60 centibar average represented the full-irrigation trigger in that experiment.
- An 80 centibar average represented a deficit-irrigation trigger.
- The study separately evaluated satellite-only commercial recommendations, demonstrating that different measurement systems are not semantically identical merely because they address irrigation scheduling.

### S3 — University of Minnesota Extension: soybean aphid management

Sources:
https://extension.umn.edu/agriculture/crop-production/soybean/soybean-aphid
https://extension.umn.edu/agriculture/crop-production/soybean/fact-based-soybean-aphid-insecticide-recommendations

Source-supported candidate claims used in this casebook:

- Through R5, the economic threshold requires all three conditions:
  - average of about 250 aphids per plant;
  - more than 80 percent of plants infested;
  - aphid populations increasing.
- The threshold is intended to provide lead time before economic injury, not to identify the biological damage boundary.
- In early R6, yield loss can still occur at very high aphid populations, but the formal R5 threshold should not be silently reused as an R6 threshold.
- Scouting and population trend are decision-material inputs.

### S4 — University of Minnesota Extension: corn nitrogen guidelines

Source:
https://extension.umn.edu/nutrient-management/fertilizing-corn-minnesota

Source-supported candidate claims used in this casebook:

- Minnesota nitrogen guidance uses previous crop, soil/productivity context and the nitrogen-price-to-crop-value ratio.
- For non-irrigated corn following soybean at a 0.10 nitrogen-price/crop-value ratio, the listed maximum return to nitrogen rate is 150 lb N/acre, with an acceptable range of 135–160 lb N/acre.
- For non-irrigated corn following corn at the same ratio, the listed maximum return to nitrogen rate is 185 lb N/acre, with an acceptable range of 170–200 lb N/acre.
- The non-irrigated table should not be silently used for irrigated sandy corn; a separate table is provided.
- Corn following alfalfa has separate guidance and should not be treated as ordinary corn-after-corn or corn-after-soybean.
- Regional soil nitrate-test applicability also depends on soil, prior crop, manure history, rainfall and sampling context.

### S5 — Crop Protection Network: tar spot of corn

Source:
https://cropprotectionnetwork.org/publications/an-overview-of-tar-spot

Source-supported candidate claims used in this casebook:

- Tar spot management should include hybrid susceptibility, scouting and fungicide consideration.
- A single fungicide application from tassel through milk, approximately VT–R3, has generally provided the most consistent canopy protection and greatest potential for positive return on investment.
- An R4 application may still protect yield and provide positive return under high tar spot severity, cited as at least about 5%.
- Timing and active disease context matter; a fungicide statement should not be converted into a universal prophylactic rule.

## 5. Test method

Each case follows the same semantic path:

~~~text
SourceArtifact
→ Claim
→ SourceContext
→ synthetic TargetContext
→ DecisionProblem
→ ContextManifest
→ ApplicabilityAssessment
→ expected Workbench behavior
~~~

The target cases below are synthetic. They are test inputs, not claims about an actual farm.

## 6. Batch results

### A. Late-season irrigation and soil-water semantics

#### IRR-01 — Nebraska corn, R4, monitored root zone

Synthetic target:

- crop = maize
- stage = R4 / dough
- location = central Nebraska
- production system = irrigated
- root-zone support = top four feet
- remaining available water = measured by a qualified soil-water monitoring system
- use purpose = late-season irrigation planning

Expected ADR result:

~~~text
transport_status = DIRECTLY_APPLICABLE
review_required = false
~~~

Why:

The source crop, stage, geography, irrigation context, root-zone support and evidence type align with the source-supported use.

What ADR still must not claim:

- IRRIGATE_NOW
- a site-specific yield guarantee
- machine authorization
- economic return

#### IRR-02 — Nebraska corn, crop stage missing

Synthetic target:

- crop = maize
- location = central Nebraska
- root-zone water = known
- crop stage = UNKNOWN

Expected ADR result:

~~~text
transport_status = UNRESOLVED
information_requirement = crop.stage
review_required = true
~~~

Why:

Water-to-maturity and the late-season depletion envelope are stage-dependent. ADR should ask for the missing decision-material context instead of guessing stage.

#### IRR-03 — Same agronomy, different unit system

Synthetic target:

- same context as IRR-01
- target application stores water depth in millimetres
- source guidance is expressed in inches

Expected ADR result:

~~~text
transport_status = APPLICABLE_WITH_GOVERNED_TRANSFORM
required_transform = exact unit conversion
scientific_extrapolation = false
~~~

Why:

A deterministic unit conversion changes representation, not agronomic meaning.

#### IRR-04 — Soybean R4 using the corn/late-soybean 60% depletion trigger

Synthetic target:

- crop = soybean
- stage = R4
- target rule requested = allow about 60% depletion now

Expected ADR result:

~~~text
transport_status = NOT_RELEVANT
reason = source places the analogous late-season soybean depletion point after R5
~~~

Why:

The source does not support silently moving the soybean stage condition from R5 to R4.

#### IRR-05 — Guangdong corn using Nebraska late-season guidance

Synthetic target:

- crop = maize
- stage = R4
- location = Guangdong, China
- irrigation system = drip
- climate regime and local rooting behavior = not established in the source
- source = Nebraska extension guidance

Expected ADR result:

~~~text
transport_status = UNRESOLVED
review_required = true
missing_transport_evidence = geography / production-system transfer basis
~~~

Why:

Crop and stage similarity do not establish geographic or production-system transport. ADR should not turn Nebraska guidance into universal corn truth.

#### IRR-06 — Watermark centibar trigger applied to a different sensor modality

Synthetic target:

- location = Nebraska
- crop = corn
- target sensor = capacitance probe reporting volumetric water content
- proposed rule = reuse the Watermark 60 centibar trigger as though numerically equivalent

Expected ADR result:

~~~text
transport_status = CALIBRATION_REQUIRED
direct_numeric_substitution = forbidden
~~~

Why:

Soil matric-potential centibars and volumetric-water-content readings are different measurement semantics. The sensor relationship depends on soil and calibration; ADR should require a governed correspondence or calibration instead of copying the number 60.

### B. Soybean aphid economic-threshold semantics

#### APH-01 — Minnesota R4, all threshold conditions satisfied

Synthetic target:

- crop = soybean
- stage = R4
- average aphids per plant = 310
- plants infested = 90%
- population trend = increasing
- geography = Minnesota

Expected ADR result:

~~~text
transport_status = DIRECTLY_APPLICABLE
threshold_conditions = satisfied
recommendation_authority = NONE_IN_THIS_DEMO
~~~

Why:

The target context contains the three conditions required by the source through R5.

#### APH-02 — Population trend missing

Synthetic target:

- crop = soybean
- stage = R4
- average aphids per plant = 300
- plants infested = 90%
- population trend = UNKNOWN

Expected ADR result:

~~~text
transport_status = UNRESOLVED
information_requirement = aphid.population_trend
review_required = true
~~~

Why:

ADR must not silently promote two satisfied conditions into a three-condition threshold.

#### APH-03 — Density below threshold

Synthetic target:

- crop = soybean
- stage = R4
- average aphids per plant = 100
- plants infested = 90%
- population trend = increasing

Expected ADR result:

~~~text
transport_status = DIRECTLY_APPLICABLE
threshold_condition_result = NOT_MET
automatic_treatment_claim = forbidden
~~~

Why:

The knowledge itself is applicable, but the target state does not satisfy the source threshold. Applicability and rule outcome are separate.

#### APH-04 — Early R6 with high aphid pressure

Synthetic target:

- crop = soybean
- stage = early R6
- average aphids per plant = 600
- plants infested = 90%
- population trend = increasing

Expected ADR result:

~~~text
transport_status = UNRESOLVED
reason = formal R5 economic threshold must not be silently extended into R6
review_required = true
~~~

Why:

The source explicitly distinguishes early R6 from the formal through-R5 threshold.

#### APH-05 — Minnesota threshold transported to Guangdong

Synthetic target:

- crop = soybean
- stage = R4
- aphid measurements = threshold-like
- geography = Guangdong, China
- local pest population biology, economics and pesticide context = not established

Expected ADR result:

~~~text
transport_status = UNRESOLVED
review_required = true
~~~

Why:

The source is not evidence for universal geographic transport.

#### APH-06 — Public threshold conflicts with a synthetic customer policy

Synthetic customer policy:

- treat at 100 aphids per plant regardless of percent infestation or trend

Public candidate knowledge:

- University of Minnesota threshold requires about 250 aphids per plant, more than 80% infested and an increasing population through R5

Synthetic target:

- Minnesota soybean at R4
- 140 aphids per plant
- 85% infested
- increasing

Expected ADR result:

~~~text
transport_status = CONFLICT
review_required = true
silent_precedence = forbidden
~~~

Why:

ADR should preserve both authorities and surface a decision-material conflict. It should not silently choose the customer rule or the public source.

Note:

The 100-aphid customer policy is synthetic and exists only to demonstrate conflict handling.

### C. Corn nitrogen guidance and context transport

#### N-01 — Minnesota non-irrigated corn following soybean

Synthetic target:

- location = Minnesota
- crop = corn
- previous crop = soybean
- irrigation = none
- nitrogen-price/crop-value ratio = 0.10
- relevant soil/productivity assumptions = consistent with the table scope

Expected ADR result:

~~~text
transport_status = DIRECTLY_APPLICABLE
source_guideline = MRTN 150 lb N/acre
source_acceptable_range = 135–160 lb N/acre
automatic_prescription = forbidden
~~~

Why:

The synthetic target matches the published table scope.

#### N-02 — Same guideline consumed by a metric-unit customer system

Synthetic target:

- same target as N-01
- target platform requires kg N/ha

Expected ADR result:

~~~text
transport_status = APPLICABLE_WITH_GOVERNED_TRANSFORM
required_transform = exact lb N/acre to kg N/ha conversion
~~~

Why:

Unit conversion is representation transport, not new agronomic knowledge.

#### N-03 — Irrigated sandy corn using the non-irrigated table

Synthetic target:

- location = Minnesota
- crop = corn
- irrigation = yes
- soil = sandy
- previous crop = corn
- proposed source = non-irrigated Table 1

Expected ADR result:

~~~text
transport_status = NOT_RELEVANT
required_next_knowledge = irrigated sandy-soil guidance
~~~

Why:

The source itself provides a separate table for irrigated sandy corn. ADR should not use the wrong table because the crop identity matches.

#### N-04 — Minnesota nitrogen table applied to Iowa

Synthetic target:

- crop = corn
- previous crop = soybean
- irrigation = none
- geography = Iowa
- proposed source = Minnesota Extension rate table

Expected ADR result:

~~~text
transport_status = UNRESOLVED
review_required = true
reason = regional transfer basis not established by the source
~~~

Why:

A state-specific guideline is not automatically a cross-state authority.

### D. Tar spot fungicide timing

#### TS-01 — Active tar spot near tasseling

Synthetic target:

- crop = corn
- region = U.S. Midwest
- stage = VT/R1
- tar spot = confirmed active in the field
- hybrid susceptibility = known
- use purpose = fungicide timing assessment

Expected ADR result:

~~~text
transport_status = DIRECTLY_APPLICABLE
timing_context = within source-supported VT–R3 window
automatic_application = forbidden
~~~

Why:

The target is within the source-supported timing context and has active disease information.

#### TS-02 — V8 corn with no active tar spot evidence

Synthetic target:

- crop = corn
- region = U.S. Midwest
- stage = V8
- tar spot = not detected
- request = prophylactic application solely because tar spot exists in the region

Expected ADR result:

~~~text
transport_status = DIRECTLY_APPLICABLE
source_condition_result = fungicide timing condition not established
automatic_application = forbidden
~~~

Why:

The tar spot knowledge is relevant, but relevance does not mean the action condition is satisfied. ADR should preserve the source emphasis on scouting, disease activity and timing.

#### TS-03 — R4 corn with high confirmed severity

Synthetic target:

- crop = corn
- region = U.S. Midwest
- stage = R4
- confirmed tar spot severity = at least about 5%
- weather and field conditions = capable of supporting continued disease

Expected ADR result:

~~~text
transport_status = DIRECTLY_APPLICABLE
source_path = conditional R4 high-severity case
automatic_application = forbidden
~~~

Why:

The public source explicitly describes R4 as a possible yield-protection case under high severity rather than silently extending the normal VT–R3 rule.

#### TS-04 — Suspected tar spot in Guangdong with no confirmed diagnosis

Synthetic target:

- crop = corn
- location = Guangdong, China
- stage = R2
- visual black lesions = present
- disease identity = unconfirmed
- proposed source = Crop Protection Network U.S./Canada guidance

Expected ADR result:

~~~text
transport_status = UNRESOLVED
information_requirements =
  - qualified disease identity
  - target-region transport basis
review_required = true
~~~

Why:

Visual similarity, crop identity and growth stage are insufficient to establish disease identity or geographic applicability.

## 7. Result summary

Twenty synthetic target cases were evaluated against five public-source knowledge families.

Expected outcomes:

| ADR result | Count | What it demonstrates |
| --- | ---: | --- |
| DIRECTLY_APPLICABLE | 7 | ADR can recognize close source/target alignment without turning applicability into action authority |
| UNRESOLVED | 7 | ADR can stop when decision-material context or transport evidence is missing |
| APPLICABLE_WITH_GOVERNED_TRANSFORM | 2 | ADR can distinguish deterministic representation changes from scientific extrapolation |
| NOT_RELEVANT | 2 | ADR can reject a source path that is outside its own stated crop/stage/system scope |
| CALIBRATION_REQUIRED | 1 | ADR can prevent silent numeric substitution across measurement systems |
| CONFLICT | 1 | ADR can surface competing decision-material knowledge instead of choosing silently |
| Total | 20 | — |

## 8. What a customer sees

A customer does not need to inspect the entire ADR domain model.

A useful customer-facing workflow can be:

~~~text
1. Load a protocol, paper, extension guide or internal agronomy rule
2. Preserve exact source and version
3. Extract candidate claims
4. Record where those claims originally apply
5. Connect current customer/field context
6. Freeze the decision-time ContextManifest
7. Evaluate source-to-target applicability
8. Surface MATCH / MISMATCH / UNKNOWN / CONFLICT
9. Send unresolved or conflicting cases to an agronomist
10. Retain the basis for later replay
~~~

A customer-facing answer can therefore be much more useful than a generic recommendation:

~~~text
Knowledge candidate:
Late-season 60% depletion envelope

Source context:
Nebraska irrigated corn, after dough stage, top four-foot active root zone

Target context:
Nebraska irrigated corn, R4, top four-foot monitored root zone

Applicability:
DIRECTLY_APPLICABLE

Limitations:
Extension guidance; not site-specific outcome proof

Missing information:
None for applicability assessment

Authority ceiling:
No irrigation order, approval or machine execution
~~~

Or:

~~~text
Knowledge candidate:
Minnesota soybean aphid threshold

Target:
R4 soybean, 300 aphids/plant, 90% plants infested

Missing:
Population trend

Applicability:
UNRESOLVED

Next action:
Obtain trend evidence or send to expert review

ADR behavior:
Do not invent the missing condition
~~~

## 9. Customer value demonstrated

This casebook demonstrates six product behaviors that are difficult to preserve in ordinary rule engines, spreadsheets and static agronomy documents:

### 9.1 Provenance survives deployment

The deployed rule does not become an unexplained number. ADR keeps the source, version, context, limitations and semantic identity attached.

### 9.2 Similar is not the same as applicable

Corn in Nebraska and corn in Guangdong are not automatically the same decision context.

### 9.3 Missing data remains missing

ADR can return UNRESOLVED and request the exact missing information instead of filling the gap with a guess.

### 9.4 Measurement systems are not silently interchangeable

A Watermark centibar trigger is not numerically equivalent to volumetric water content from a capacitance sensor.

### 9.5 Applicability is not recommendation

A knowledge source can be directly applicable while the target state still fails the action threshold.

### 9.6 Conflicts remain visible

A customer policy and a public scientific source can disagree. ADR can preserve the disagreement and route it to review instead of allowing implementation order or source priority to silently decide.

## 10. How this maps to the current ADR pilot product

The current pilot-v0.3 public API already exposes the main objects required for this workflow:

~~~text
POST /v1/decision-problems
POST /v1/context-data
POST /v1/context-references
POST /v1/context-references/{reference_id}/resolutions
POST /v1/context-manifests
POST /v1/knowledge-retrieval-results
POST /v1/applicability-assessments
GET  /v1/workbench/cases/{assessment_id}
GET  /v1/workbench/escalations
~~~

The pilot intentionally does not expose:

~~~text
/recommend
/runtime-eligibility
/runtime-bindings
/decision-results
~~~

That is a feature of the current product boundary, not a missing claim in this casebook.

The current customer proposition is therefore:

> Turn agronomy from documents, spreadsheets and expert memory into traceable knowledge that can be checked against a real target context before it enters a decision workflow.

## 11. Candidate design-partner pilot

A bounded first customer pilot should not attempt to automate all agronomy.

Suggested scope:

~~~text
one decision domain
20–100 real customer claims
3–10 source documents or internal protocols
10–30 historical or live target cases
one agronomist review team
one external context provider
~~~

Suggested first domain:

~~~text
late-season irrigation
or
one crop-protection threshold family
~~~

Suggested pilot measurements:

1. Claim traceability — can every deployed claim be traced to exact source material?
2. Context completeness — how often does ADR identify a decision-material missing datum before a human notices it?
3. Applicability agreement — how often do agronomists agree with MATCH / MISMATCH / UNRESOLVED / CONFLICT classification?
4. Review efficiency — does Workbench reduce time spent finding source material and reconstructing why a rule applies?
5. Replayability — months later, can the organization reconstruct the exact source and target context used for the assessment?
6. Silent-promotion prevention — how many cases would an ordinary rule engine have treated as equivalent despite missing transport, calibration or context evidence?

## 12. What this casebook does not prove

This casebook does not establish:

- that the public sources are ADR QualifiedKnowledge;
- that any pesticide application is legally authorized;
- that any fertilizer or irrigation rate is correct for an actual customer field;
- recommendation correctness;
- yield improvement;
- profit improvement;
- causal outcome;
- commercial product-market fit;
- autonomous decision authority;
- execution authority;
- GEOX ADR authoritative cutover.

It is a product demonstration of ADR semantic and applicability behavior.

## 13. Customer takeaway

The simplest way to describe the demonstrated ADR capability is:

> ADR is an agronomic knowledge applicability firewall.

It helps an organization answer:

~~~text
What exactly does this source say?
Where was it valid?
What is true or known about the target now?
Which conditions match?
Which conditions do not match?
What is missing?
Is a transform scientifically harmless or does it require calibration?
Are two authorities in conflict?
May this knowledge enter the decision world?
Can we prove later why we allowed or blocked it?
~~~

That is materially different from storing agronomy in PDFs or encoding thresholds directly into software.

## 14. Source note

All agronomic factual claims in this casebook are bounded to the public sources listed in Section 4. Synthetic target cases are deliberately fictional. Any future customer casebook should preserve the same distinction between source-derived facts, customer-provided context and ADR-derived applicability results.
