# ADR_PILOT_HOST_RELIABILITY_FIX_V1

Bounded deployment-host correction; ADR Core, resource contracts, scientific
qualification, applicability and execution authority are unchanged.

## Defect

At baseline a5b053fcdab5179cda40d1040bafcb4c55211f6f, a governed write updated
the in-memory ledger and transport cache before the checkpoint was saved. A
checkpoint/copy/write/rename failure returned an error but left the instance
available. A same-key retry could return 201 from that unpersisted cache, and a
later write could checkpoint the earlier unconfirmed mutation.

## Correction

Any persist failure latches `persistenceFault`, clears readiness, and returns
503 `PILOT_RUNTIME_UNAVAILABLE`. The same instance cannot clear its fault through
the HTTP API. `/healthz` and `/ready` report 503. Domain reads and writes are
blocked, including cache hits, queued requests and direct subsequent persist
attempts. `/openapi.json` remains available because it carries no runtime facts.

Write availability is checked before authentication/body processing and again
after asynchronous body collection. The serialized task executes this check,
so requests already queued when another request fails cannot carry dirty memory
into a later checkpoint. Errors before persistence such as invalid JSON,
principal mismatch and idempotency conflicts do not themselves poison a healthy
instance; the existing contract and authorization checks remain in force.

The latch deliberately does not roll back or reinterpret Core facts, clear the
cache, persist dirty state a second time, or fall back to `.prev`/`.tmp`. A new
runtime must load the validated canonical checkpoint. If rename completed but
the response was lost, the checkpoint retains the exact transport key/result
and a restart replay returns that same result. If persistence failed before
rename, recovery uses the previous valid canonical file; unknown requests need
controlled same-key reconciliation. Never substitute a new key or principal.

Operators should preserve state/.prev/.tmp and failure evidence before creating
a replacement instance; normal initialization may overwrite those auxiliary
files. Corrupt canonical checkpoints remain startup failures, even if a valid
`.prev` exists; automatic historical rollback is not introduced.

## Acceptance

From repository root on Node 24:

```sh
node deploy/adr-pilot-host/reliability.mjs
node deploy/adr-pilot-host/acceptance.mjs
npm test
```

Set `ADR_HOST_RELIABILITY_EVIDENCE_DIR` to a new directory to retain R0–R8 JSON
and the exact source HEAD. The fault suite stops at its first actual failure;
transport replays are planned assertions, not retries to obtain PASS.

The existing Host acceptance entrypoint also imports the fault suite, so the
unchanged Node 24 Host workflow exercises these scenarios on future Host changes.

R0 checks normal commit/replay/restart and healthy rejection behavior. R1–R5
inject checkpoint/copy/partial-write/rename failures and assert isolation,
unchanged disk, no cache 201, blocked reads and successful controlled restart.
R6 kills the child after rename and before a response. R7 corrupts the main
checkpoint while a valid `.prev` exists and requires startup failure. R8 holds
one request body while a second request queues, then injects the first write
failure and requires both the queued and later requests to be rejected.

Evidence is process-crash and synchronous-I/O fault evidence. It is not power
loss/fsync, multi-process shared-volume, real-customer or production deployment
qualification. No new deployment or automatic recovery mechanism is claimed.

Keep the PR unmerged pending CTO exact-head review. WP02–WP06 remain HOLD.
