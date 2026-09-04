# Real KBS T4/R1 durable GEOX authority replay provenance

Status: productization qualification evidence only. This is not architecture authority and does not grant field actionability, approval, dispatch, or machine execution authority.

## Purpose

PR #179 proved that a live GEOX authority resolution can be replayed exactly while the retained source bytes remain in one process-local `GeoxTargetAuthoritySnapshotStore`.

This acceptance world tests the next deployment boundary: the online resolver process may terminate, and a new process must be able to replay the same resolution without repository or network access.

## Persistence boundary

`adapters/geox/src/durable-target-authority-store.mjs` is an adapter-local filesystem implementation of the existing snapshot store surface used by `resolveGeoxTargetAuthority()` and `replayGeoxTargetAuthorityResolution()`.

It persists:

- exact source bytes as content-addressed immutable `sha256` snapshot blobs;
- the exact resolver receipt as a content-addressed immutable JSON blob.

It does not copy or replace the GEOX authority compiler. Replay still calls the frozen `replayGeoxTargetAuthorityResolution()` implementation from PR #179, which rechecks SHA-256, Git blob SHA, exact source set, cross-source semantics, and the receipt's `authority_export_hash`.

## Cross-process proof

The qualification runner starts two separate Node processes.

Process A:

1. resolves live `liyongshang44-max/GEOX@main`;
2. retains all four exact authority source files in the durable store;
3. persists the exact resolution receipt;
4. exits.

Process B:

1. receives only the durable store root and receipt content hash;
2. runs with `GITHUB_TOKEN` removed;
3. replaces `globalThis.fetch` with a fail-fast network trap;
4. reopens the durable store in a different process;
5. loads the exact receipt by hash;
6. performs exact replay through the existing PR #179 replay function.

The replay must reproduce the same GEOX authority target and retain the same authority ceiling.

## Failure model covered here

Offline integrity tests require fail-closed behavior for:

- invalid content hashes / path-like inputs;
- missing snapshots;
- mutated persisted snapshot bytes;
- missing receipts;
- mutated persisted receipt bytes;
- unsupported receipt contract versions.

This qualification proves process-durable local persistence. It does not claim multi-host replication, HA, backup/restore, remote object-store durability, database transactionality, or power-loss guarantees beyond filesystem file sync.

## Authority ceiling

Persistence changes evidence retention only. It does not authorize:

- ADR/GEOX identity equality;
- provider/GEOX geometry equality;
- field actionability;
- human approval;
- dispatch;
- machine execution;
- GEOX field-validity promotion;
- GEOX production-site promotion.

No generic ADR core package, SDK contract, or architecture decision is changed by this qualification.
