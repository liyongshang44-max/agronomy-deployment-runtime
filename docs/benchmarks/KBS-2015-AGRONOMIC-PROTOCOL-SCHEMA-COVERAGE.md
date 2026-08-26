# KBS 2015 Agronomic Protocol — ADR Schema Coverage Matrix

Status: **BENCHMARK EVIDENCE — NOT NORMATIVE ARCHITECTURE**

Date: 2026-08-27

Source: `current_agronomic_protocol.pdf`, *2015 LTER Agronomic Protocol*, Kellogg Biological Station, Michigan State University.

Locally inspected original PDF identity for this benchmark session:

```text
Title: 2015_LTER_Agronomic_Protocol
PDF pages: 23
Byte length: 386105
SHA-256: d89a267437bb664af9b724b8ce9d8669e1a3b1b1838f894b470abbdaf6c4b58f
```

This fingerprint is evidence metadata only. The exact original PDF bytes are not committed to the repository and are not represented as a retained ADR SourceArtifact by this benchmark.

## Purpose

The first KBS Gold Protocol benchmark focused on PDF page 23 irrigation scheduling. That rule exposed two concrete gaps in accepted declarative rule v1: a source-bound calendar start and a distinct communication coordinator.

This matrix widens the review to other operational rules in the same 23-page protocol before any v2 contract is accepted. The objective is to distinguish:

- semantics already representable by accepted rule v1;
- semantics covered by the current DEC-0003 v2 candidate;
- recurring source semantics that remain unrepresented and therefore should block any claim that ADR already has a general agronomic-protocol schema.

## Representative source rule shapes

| PDF page | Source-faithful rule shape | Agronomic semantic family | v1 | current v2 candidate | Finding |
|---:|---|---|---|---|---|
| 23 | `Starting on May 1` daily rainfall/irrigation recording | source-bound calendar start for evaluation/data cadence | NO | YES (`evaluationStart`) | page-23 gap closed by current v2 candidate |
| 23 | PAW `< 0` for two consecutive days -> irrigate next day | threshold + persistence + action offset | YES | YES | already covered by v1 |
| 23 | rainfall restores net PAW -> override pending irrigation | conditional exception / override | YES | YES | already covered by v1 |
| 23 | irrigation amount based on prior-day PAW deficit | action parameter expression | YES | YES | already covered by v1 |
| 23 | e-mail listed recipients, coordinated by Joe Simmons | communication channel + recipients + distinct coordinator | PARTIAL | YES | coordinator gap closed by current v2 candidate |
| 2/3/5 | `Plant soybeans anytime after May 5th` | action eligibility not-before calendar date | NO | NO | `evaluationStart` is the wrong semantic; this is an action boundary |
| 2/3/5 | plant winter wheat after Hessian fly-free date / September 20 | action eligibility after named agronomic/calendar boundary | NO | NO | requires governed action temporal constraint, not evaluation cadence |
| 3/22 | `Application of 2,4-D must be 7 days before planting` | minimum relative offset between two operations | NO | NO | requires event-relative temporal constraint |
| 3/22 | if Roundup application is within 7 days of planting, `do not use 2,4-D in the tank mix` | conditional temporal relation + prohibited material/action combination | NO | NO | requires explicit prohibition/no-go semantics plus event-relative time |
| 2/3/5/22 | apply herbicide `when weeds are 2-6 inches` | measured-state interval trigger + action + dosage | YES* | YES* | representable as ALL of `>=2` and `<=6` predicates if weed-height semantics/units are governed |
| 11 | `Do not add any nitrogen to treatment 6` | unconditional action/input prohibition in exact management context | NO* | NO* | actionSpace exclusion alone does not preserve explicit source no-go authority |
| 12 | no mowing or tillage at any time except micro-plot area | spatially scoped prohibition with exception | NO | NO | requires prohibition + spatial scope + exception semantics |
| 12 | have micro-plot tillage within same week as T1 tillage | event-relative bounded temporal relation | NO | NO | requires relation between two operation events |
| 12 | notify Carol Baker when tillage operations completed | post-operation event trigger + notification | PARTIAL | PARTIAL | coordination metadata alone does not encode its execution-event trigger |
| 16/17/20 | `when corn is knee high plant red clover` | phenological/state trigger + action | YES* | YES* | representable if phenology state is governed ContextDatum; source phrase itself still needs semantic adjudication |
| 17-19 | after soybean harvest, soil finish before planting winter wheat | ordered operation sequence | NO | NO | requires explicit before/after event relations |
| 22 | irrigated weekly during growing season to exceed normal precipitation | recurring action cadence + seasonal scope + target condition | PARTIAL | PARTIAL | evaluation cadence is not equivalent to recurring action schedule |

`YES*` means the rule grammar can represent the logic, but deployment still requires the corresponding semantic IDs, units, context authority, applicability, and action semantics. It does not mean the source rule is currently qualified for general use.

`NO*` for explicit prohibitions means an implementation could hide the prohibition indirectly by removing an action from `actionSpace`, but that would not preserve the source assertion, reason, scope, or provenance as first-class auditable authority.

## Main result

The current DEC-0003 candidate is technically valid for the two page-23 gaps it was designed to close, but the wider protocol shows that `evaluationStart` is too narrow to be treated as ADR's general temporal answer.

The protocol repeatedly uses at least four distinct temporal relationships:

```text
1. calendar boundary
   after May 5 / after September 20

2. event-relative offset
   2,4-D at least 7 days before planting

3. event ordering
   after harvest / before soil finishing / before planting

4. bounded relation between operations
   within the same week as another tillage operation
```

The page-23 `Starting on May 1` case is only one member of that family.

The same scan also establishes a second recurring missing primitive: **explicit action prohibition / NO-GO authority**.

Examples include:

```text
Do not add any nitrogen to treatment 6.
DO NOT TILL.
If Roundup is within 7 days of planting, do not use 2,4-D in the tank mix.
No mowing or tillage ... except for the micro-plot area.
```

These are decision-material agronomic rules. They should not be represented merely as free-text limitations or inferred from an actionSpace omission.

## Architecture implication

Before DEC-0003 is accepted, ADR should decide whether rule v2 should retain the narrow `evaluationStart` field or replace it with a small source-governed temporal-constraint vocabulary that can represent more than the single irrigation example.

A minimal evidence-backed direction would distinguish targets and relations rather than introduce a general-purpose scheduling DSL. Candidate concepts for further design review:

```text
temporalConstraint
  target: EVALUATION | ACTION | OPERATION_EVENT
  relation:
    NOT_BEFORE_DATE
    NOT_AFTER_DATE
    BEFORE_EVENT
    AFTER_EVENT
    MIN_OFFSET_BEFORE_EVENT
    MIN_OFFSET_AFTER_EVENT
    WITHIN_PERIOD_OF_EVENT
  authorityBindings: [...]
```

This document does **not** accept those names or fields as architecture. It only records the source-derived semantic requirement.

Likewise, a future rule contract should evaluate an explicit source-governed prohibition primitive, conceptually separating:

```text
positive action recommendation
!=
action eligibility constraint
!=
prohibited action / prohibited material combination
```

## What should not be generalized yet

The scan does not justify a universal temporal DSL, arbitrary workflow language, or automatic conversion of vague source phrases such as `late April or early May`, `if needed`, or `as needed` into precise machine thresholds.

Those phrases require source-faithful preservation and possibly human semantic adjudication; ADR must not invent exact dates, thresholds, or trigger conditions that the protocol did not state.

## Decision frontier

- accepted rule v1 remains immutable and its KBS page-23 benchmark remains `INCOMPLETE` for the two known page-23 fields;
- the current v2 candidate proves those two fields can be closed and reaches `COMPLETE` for the irrigation rule alone;
- the broader KBS protocol proves that this does **not** yet establish general agronomic-protocol completeness;
- therefore DEC-0003 should remain `PROPOSED` while its temporal design is reconsidered against this wider evidence set.
