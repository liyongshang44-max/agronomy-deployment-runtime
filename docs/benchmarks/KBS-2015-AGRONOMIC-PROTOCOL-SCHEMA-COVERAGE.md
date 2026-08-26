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

The first KBS Gold Protocol benchmark focused on PDF page 23 irrigation scheduling. That rule exposed two concrete gaps in accepted declarative rule v1: a source-bound temporal boundary for the evaluation/data schedule and a distinct communication coordinator.

An initial rule-v2 candidate used a dedicated `evaluationStart` field. A wider scan of the same 23-page protocol showed that this would overfit one irrigation example. The candidate has therefore been revised to a small source-governed `temporalConstraints` vocabulary plus `coordination.coordinator`.

This matrix records what the current **candidate** can and cannot represent. It does not accept DEC-0003 and does not establish general agronomic-protocol completeness.

## Representative source rule shapes

| PDF page | Source-faithful rule shape | Agronomic semantic family | v1 | current v2 candidate | Finding |
|---:|---|---|---|---|---|
| 23 | `Starting on May 1` daily rainfall/irrigation recording | inclusive source-bound calendar boundary for evaluation/data cadence | NO | YES (`RULE_EVALUATION + ON_OR_AFTER_DATE`) | page-23 temporal gap structurally closed |
| 23 | PAW `< 0` for two consecutive days -> irrigate next day | threshold + persistence + action offset | YES | YES | already covered by v1 |
| 23 | rainfall restores net PAW -> override pending irrigation | conditional exception / override | YES | YES | already covered by v1 |
| 23 | irrigation amount based on prior-day PAW deficit | action parameter expression | YES | YES | already covered by v1 |
| 23 | e-mail listed recipients, coordinated by Joe Simmons | communication channel + recipients + distinct coordinator | PARTIAL | YES | coordinator gap structurally closed |
| 2/3/5 | `Plant soybeans anytime after May 5th` | exclusive action eligibility after calendar date | NO | YES (`RULE_ACTION + AFTER_DATE`) | candidate preserves exclusivity rather than treating May 5 as eligible |
| 2/3/5 | plant winter wheat after Hessian fly-free date / September 20 | action eligibility after named agronomic/calendar boundary | NO | PARTIAL | explicit calendar date is representable; a named agronomic date still requires governed semantic resolution |
| 3/22 | `Application of 2,4-D must be 7 days before planting` | minimum relative offset between operations | NO | YES (`MIN_OFFSET_BEFORE_EVENT + P7D`) | grammar can preserve the source relation if planting event semantics are governed |
| 3/22 | if Roundup application is within 7 days of planting, `do not use 2,4-D in the tank mix` | temporal relation + prohibited material/action combination | NO | PARTIAL | temporal relation can be represented; explicit prohibition remains missing |
| 2/3/5/22 | apply herbicide `when weeds are 2-6 inches` | measured-state interval trigger + action + dosage | YES* | YES* | representable as governed lower/upper predicates if weed-height semantics and units exist |
| 11 | `Do not add any nitrogen to treatment 6` | unconditional action/input prohibition in exact management context | NO* | NO* | actionSpace exclusion would not preserve explicit source no-go authority |
| 12 | no mowing or tillage at any time except micro-plot area | spatially scoped prohibition with exception | NO | NO | requires prohibition + spatial scope + exception semantics |
| 12 | have micro-plot tillage within same week as T1 tillage | relation between operation times | NO | PARTIAL | duration-bounded relations exist, but `same calendar week` must not be silently equated with `within P7D` |
| 12 | notify Carol Baker when tillage operations completed | post-operation event trigger + notification | PARTIAL | PARTIAL | coordinator/participants do not by themselves encode an execution-event-triggered notification |
| 16/17/20 | `when corn is knee high plant red clover` | phenological/state trigger + action | YES* | YES* | grammar can represent a governed state trigger; the source phrase still requires semantic adjudication |
| 17-19 | after soybean harvest, soil finish before planting winter wheat | ordered operation sequence | NO | YES* | `AFTER_EVENT` / `BEFORE_EVENT` can encode rule-action ordering if the referenced operation semantics are governed |
| 22 | irrigated weekly during growing season to exceed normal precipitation | recurring action cadence + seasonal scope + target condition | PARTIAL | PARTIAL | evaluation cadence is not equivalent to recurring action schedule; candidate does not add action recurrence semantics |

`YES*` means the rule grammar can represent the logical shape, but deployment still requires the corresponding semantic IDs, units, source context authority, applicability, and action semantics. It does not mean the source rule is currently scientifically qualified for general use.

`NO*` for explicit prohibitions means an implementation could hide the prohibition indirectly by removing an action from `actionSpace`, but that would not preserve the source assertion, reason, scope, exception structure, or provenance as first-class auditable authority.

## Main result

The wider protocol supports replacing the narrow `evaluationStart` idea with a small temporal-relation vocabulary. It does **not** support a general workflow DSL.

The candidate now distinguishes calendar inclusivity/exclusivity and event-relative relations:

```text
calendar boundary
  ON_OR_AFTER_DATE
  AFTER_DATE
  ON_OR_BEFORE_DATE
  BEFORE_DATE

event ordering
  BEFORE_EVENT
  AFTER_EVENT

event-relative duration
  MIN_OFFSET_BEFORE_EVENT
  MIN_OFFSET_AFTER_EVENT
  WITHIN_PERIOD_OF_EVENT
```

Targets are deliberately restricted to:

```text
RULE_EVALUATION
RULE_ACTION
```

This is enough to represent the page-23 May 1 evaluation/data boundary and several other operation-time shapes without introducing arbitrary workflow execution semantics.

The inclusive/exclusive distinction is decision-material. For example:

```text
Starting on May 1
!=
after May 1
```

and:

```text
after May 5th
```

must not be normalized to a relation that permits May 5 itself.

## Remaining recurring gap: explicit prohibition / NO-GO authority

The same protocol independently establishes a missing primitive for explicit prohibitions.

Representative source shapes include:

```text
Do not add any nitrogen to treatment 6.
DO NOT TILL.
If Roundup is within 7 days of planting, do not use 2,4-D in the tank mix.
No mowing or tillage ... except for the micro-plot area.
```

These are decision-material agronomic rules. They should not be represented merely as free-text limitations or inferred from an `actionSpace` omission.

A future prohibition primitive needs to preserve at least:

```text
what is prohibited
under what source-governed context
whether the prohibition is conditional
what exceptions exist
which authority supports it
```

This matrix does not choose that future schema.

## Other boundaries not solved by DEC-0003

The revised temporal vocabulary still does not establish:

- recurring action schedules such as weekly irrigation;
- event-triggered communication after confirmed execution;
- arbitrary workflow sequences;
- precise machine semantics for vague source timing such as `late April or early May`, `if needed`, or `as needed`;
- automatic resolution of named agronomic calendar concepts such as a Hessian fly-free date;
- proof that a referenced operation actually occurred.

These require separate source evidence and/or runtime authority.

## What should not be generalized yet

The scan does not justify automatic conversion of vague agronomic phrases into precise dates, thresholds, durations, phenological states, or recurrence schedules.

`WITHIN_PERIOD_OF_EVENT` must not be used to turn `within the same week` into `within seven days` unless the governed source or an explicit adjudication establishes that equivalence.

Likewise, grammar-level representability is not scientific qualification, field applicability, runtime eligibility, or execution authority.

## Decision frontier

- accepted rule v1 remains immutable and its page-23 benchmark remains `INCOMPLETE` for `EVALUATION_START_DATE` and `COORDINATION_COORDINATOR`;
- revised rule v2 candidate uses source-bound `temporalConstraints` plus `coordination.coordinator`;
- the page-23 v2 benchmark must still reach `COMPLETE` using the same qualified source chain;
- protocol-neutral contract tests must separately prove calendar boundary inclusivity/exclusivity and event-relative duration validation;
- the wider protocol still demonstrates unresolved NO-GO/prohibition and recurrence semantics;
- therefore DEC-0003 remains `PROPOSED` and no claim of general agronomic-protocol completeness is permitted.
