# DEC-0006 — Governed Agronomic Policy Obligation Compilation

Status: **ACCEPTED**

Date: 2026-08-27

## Context

ADR now has accepted authority for:

- source-bound positive agronomic rules through `AgronomicPolicyCompilation`;
- source-bound temporal constraints and named coordination through declarative agronomic rule v2;
- source-bound negative agronomic authority through `AgronomicPolicyConstraintCompilation`;
- context-only governed Policies through `adr.policy.v3`.

A wider scan of the governed 2015 KBS LTER Agronomic Protocol exposes a different class of agronomic semantics that is not faithfully represented by either a positive trigger/action rule or a prohibition.

Representative source forms include:

- Main Site Treatment 6: `Cut alfalfa three times in 2015.`
- Biodiversity System A: `Plots are tilled once a year.`
- Biodiversity System H / Treatment B21: `Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

The first two statements constrain how many times an action is expected to occur in a governed period. They do not inherently specify an event trigger, evaluation cadence, fallback, runtime due-state, or proof of execution.

The B21 statement additionally contains the normative qualifier `as needed`. Its numeric range proves that bounded occurrence cardinality exists in real agronomic protocol material, but the source does not justify silently upgrading that statement into an unconditional hard REQUIRE obligation.

Forcing these statements into `DeclarativeAgronomicRule` would require invented trigger/fallback semantics. Forcing them into `AgronomicPolicyConstraintCompilation` would reverse their direction because they are not prohibitions.

## Proposed decision

Introduce a separate governed authority:

`AgronomicPolicyObligationCompilation`

with candidate contracts:

`adr.agronomic-policy-obligation.v1`

`adr.agronomic-policy-obligation-compilation.v1`

The v1 obligation effect is intentionally limited to:

`REQUIRE`

No RECOMMEND, PREFER, PERMIT, TARGET, TRY_TO, AS_NEEDED, or other soft normative modality is introduced by this decision.

## Obligation shape

The candidate inner obligation is:

`obligationId`

`decisionType`

`effect = REQUIRE`

`actionCode`

`occurrence`

`authorityBindings`

The occurrence structure is:

`mode = EXACT_COUNT | BOUNDED_COUNT`

For EXACT_COUNT:

`exactCount = positive integer`

For BOUNDED_COUNT:

`minCount = positive integer`

`maxCount = positive integer`

with `minCount <= maxCount`.

Every occurrence additionally carries one source-governed counting period:

`period.kind = FIXED_CALENDAR_YEAR | EACH_CALENDAR_YEAR`

For FIXED_CALENDAR_YEAR:

`period.year = YYYY`

For EACH_CALENDAR_YEAR:

no fixed year value is allowed.

This period describes the source counting window only. It is not a scheduler, due-date engine, recurrence executor, or proof that a calendar interval has started or ended in runtime.

## Why this is a separate authority

A source statement such as:

`Cut alfalfa three times in 2015.`

does not itself establish:

- what state triggers each cutting;
- the exact dates of the three cuttings;
- spacing between cuttings;
- an evaluation cadence;
- what to do when one cutting is late;
- what fallback action to emit;
- whether any cutting actually happened.

Therefore an occurrence obligation is not a declarative trigger/action rule.

It also does not prohibit an otherwise legal action, so it is not an AgronomicPolicyConstraintCompilation.

The authority relationship is instead:

`source-qualified agronomic knowledge + exact governed Policy -> source-bound obligation over action occurrence cardinality`.

## Policy semantics

The obligated `actionCode` MUST remain a member of the exact bound Policy `actionSpace`.

The obligation does not add a new action to Policy and does not make that action immediately eligible.

The obligation states only that, under the source-qualified protocol context, the action has a governed occurrence requirement.

For real KBS context-only obligation Policies, accepted `adr.policy.v3` is the expected predecessor because the source context may be represented entirely through ContextDatum/ContextManifest inputs with `requiredRuntimeOutputs=[]`.

## Scientific authority closure

Every obligation and occurrence-period authority binding must:

1. be listed in enclosing `knowledgeRefs`;
2. resolve exactly;
3. independently remain active for `AGRONOMIC_POLICY_INPUT`;
4. preserve existing Claim / SourceContext / source-faithful review / scientific qualification authority;
5. remain bounded to exact source context rather than being generalized into a universal agronomic frequency.

A kind label such as `QualifiedKnowledge` is not sufficient authority by itself.

## Compilation shape

When an exact compatible Policy exists, the outer compilation binds:

- exact Protocol Source;
- exact SourceArtifact;
- active QualifiedKnowledge / DerivedKnowledge;
- exact governed Policy;
- exact content hash of the obligation;
- source-to-obligation transformation rationale;
- lossless-coverage declaration;
- exact Policy-management authorization;
- direct publication audit;
- explicit limitations.

The accepted `AGRONOMIC_POLICY_INPUT` scientific-use boundary remains unchanged.

## Fail-closed requirements

1. Every sourceProtocolRef must resolve to a Source with `sourceType=PROTOCOL`.
2. Every protocol Source must have at least one exact SourceArtifact predecessor.
3. Every scientific predecessor must remain active for `AGRONOMIC_POLICY_INPUT`.
4. Every obligation/occurrence authority binding must be declared in `knowledgeRefs`.
5. `obligation.decisionType` must equal the exact Policy decisionType.
6. The obligated `actionCode` must exist in the exact Policy `actionSpace`.
7. The only v1 effect is `REQUIRE`.
8. EXACT_COUNT requires one positive safe integer `exactCount` and forbids min/max fields.
9. BOUNDED_COUNT requires positive safe integers `minCount` and `maxCount`, forbids `exactCount`, and requires `minCount <= maxCount`.
10. FIXED_CALENDAR_YEAR requires one valid four-digit calendar year and forbids recurring-year semantics.
11. EACH_CALENDAR_YEAR forbids a fixed year value.
12. Occurrence period semantics must participate in the exact obligation hash.
13. `COMPLETE` coverage cannot hide an unrepresented source qualifier, modality, exception, goal condition, or temporal boundary.
14. Publication approval must reuse the exact Policy-management authorization and publication audit must cover all exact predecessors.
15. Obligation authority must not be interpreted as proof that an occurrence is currently due, overdue, satisfied, violated, scheduled, dispatched, or executed.

## KBS acceptance targets

### A. Treatment 6 — exact fixed-year obligation

Source:

`Cut alfalfa three times in 2015.`

Candidate source-faithful representation:

`effect = REQUIRE`

`actionCode = CUT_ALFALFA`

`occurrence.mode = EXACT_COUNT`

`occurrence.exactCount = 3`

`period.kind = FIXED_CALENDAR_YEAR`

`period.year = 2015`

The source supports the count and fixed year. It does not provide exact dates or spacing between the three cuttings, so the candidate MUST NOT invent them.

### B. Biodiversity System A — exact recurring annual cardinality

Source:

`Plots are tilled once a year.`

Candidate source-faithful representation:

`effect = REQUIRE`

`actionCode = TILL`

`occurrence.mode = EXACT_COUNT`

`occurrence.exactCount = 1`

`period.kind = EACH_CALENDAR_YEAR`

This expresses one occurrence in each source-governed annual counting period. It does not schedule a date.

### C. Treatment B21 — bounded frequency with unresolved modality

Source:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

The source proves the need for a bounded cardinality grammar:

`occurrence.mode = BOUNDED_COUNT`

`minCount = 2`

`maxCount = 6`

`period.kind = EACH_CALENDAR_YEAR`

but it also includes the source-explicit qualifier `as needed` and the purpose `to prevent plant growth from becoming established`.

DEC-0006 does not define AS_NEEDED modality or goal-conditioned obligation semantics.

Therefore the acceptance requirement is fail-closed:

- ADR may preserve the bounded numeric occurrence candidate;
- ADR MUST NOT publish or label a B21 obligation as `COMPLETE REQUIRE` merely from the 2-6 range;
- the benchmark must record at least `NORMATIVE_MODALITY_AS_NEEDED` as unrepresented or otherwise reject the hard-REQUIRE compilation;
- a later normative-modality decision is required before B21 can become a complete obligation authority.

This negative case is mandatory. It prevents numeric cardinality from laundering a soft/source-conditional instruction into a hard obligation.

## Runtime / execution boundary

`AgronomicPolicyObligationCompilation`

is not:

- current-field applicability;
- RuntimeEligibility;
- RuntimeBinding;
- a schedule;
- a task;
- a due-state;
- an overdue-state;
- an occurrence counter;
- proof of satisfaction;
- proof of violation;
- an execution receipt;
- Field Log truth;
- DecisionResult;
- Outcome.

A future system may need a separate authority to evaluate obligation satisfaction against execution evidence. DEC-0006 does not pre-accept such an authority.

The governed KBS protocol itself remains a planning protocol. Actual 2015 operations remain authoritative only through the separate agronomic field log or other execution evidence.

## Relationship to existing temporal semantics

Declarative agronomic rule v2 temporalConstraints govern source-bound relationships such as:

- on/after/before a date;
- before/after an event;
- minimum event offsets;
- within-period relations.

Occurrence cardinality is different.

`three times in 2015` cannot be reduced to one temporal relation because the source constrains the number of occurrences, not the date of a single action.

Likewise, `once a year` is not permission to invent a recurring execution schedule. It is an annual counting constraint only.

## Explicitly unresolved after DEC-0006

If accepted, DEC-0006 still leaves at least these agronomic semantics unresolved:

1. normative modality such as SHOULD / TRY_TO / AS_NEEDED / IF_POSSIBLE / PERMITTED;
2. goal-conditioned action obligations such as tillage only as needed to suppress plant establishment;
3. action-parameter/material constraints;
4. source protocol inheritance/reference;
5. multi-step prerequisite / restoration workflows;
6. obligation satisfaction/violation authority over actual execution evidence.

These must not be folded into v1 merely to improve benchmark coverage.

## Rejected alternatives

### Add occurrence fields to DeclarativeAgronomicRule v2

Rejected because occurrence cardinality does not supply trigger, fallback, or positive decision-event semantics and would force the source into an unrelated execution shape.

### Encode an obligation as the absence of PROHIBIT

Rejected because permission and requirement are different semantics.

### Treat exactCount as a scheduler

Rejected because the source cardinality does not establish event dates or spacing.

### Treat B21 2-6/year as an unconditional hard REQUIRE

Rejected because the same source explicitly says `as needed`. Ignoring that qualifier would change normative meaning.

### Introduce a complete normative-modality ontology in this decision

Rejected. The evidence proves the need for modality, but DEC-0006 is intentionally restricted to hard REQUIRE obligations so it can be independently tested.

### Count ExecutionReceipt records inside this authority

Rejected because source obligation authority and obligation-satisfaction/execution authority are distinct governance classes.

## Acceptance

Accepted on 2026-08-27 after explicit architecture approval.

The accepted architecture decision authorizes a separate implementation phase for `AgronomicPolicyObligationCompilation`, subject to these constraints:

1. v1 effect remains limited to `REQUIRE`;
2. occurrence cardinality remains limited to `EXACT_COUNT` and `BOUNDED_COUNT`;
3. counting-period semantics remain limited to `FIXED_CALENDAR_YEAR` and `EACH_CALENDAR_YEAR`;
4. Treatment 6 and Biodiversity System A must be representable without inventing trigger, schedule, due-state, fallback, or execution semantics;
5. Treatment B21 must fail closed against `COMPLETE REQUIRE` because the source-explicit qualifier `as needed` remains unresolved;
6. source-qualified knowledge, exact Policy authority, content hashing, approval, and direct audit closure must be enforced;
7. obligation authority must remain distinct from Applicability, RuntimeEligibility, RuntimeBinding, scheduling, occurrence counting, obligation satisfaction/violation, Field Log truth, DecisionResult, execution evidence, and Outcome.

Acceptance of DEC-0006 does not itself make `AgronomicPolicyObligationCompilation` normative repository authority. The implementation must be developed on a separate branch, pass dedicated real-source acceptance, preserve prior DEC-0002/0003/0004/0005 authority invariants, and pass repository-wide ADR Constitution before any implementation PR may merge.
