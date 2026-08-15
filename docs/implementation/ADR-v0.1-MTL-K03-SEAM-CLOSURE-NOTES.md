# ADR v0.1 — MTL-K03 Seam Closure Notes

Status: **IMPLEMENTATION REVIEW NOTE / NON-ARCHITECTURE-AUTHORITY**

This note records the four merge-blocking negative acceptances required after independent review of PR #11.

1. A self-consistent forged `ScientificCompilationResult + ClaimCandidate + SourceContextCandidate` bundle without a real exact `Source → SourceArtifact → ScientificCompilerDefinition` authority chain must fail.
2. Compiler proposal vocabulary (`semanticHint`, `valueCandidate`, `unitCandidate`, extraction confidence) cannot be persisted as final `SourceContext` authority. Final reported dimensions use the shared semantic contract (`semanticId`, typed canonical value, unit where exact, source locator).
3. Final `Claim + SourceContext` authority publication is all-or-none. An accepted review may remain if final publication fails, but an orphan Claim is forbidden.
4. Review authorization is mandatory. The exact `SourceFaithfulReviewDecision` binds the exact `AuthorizationDecisionAudit` and reviewer principal; at least one exact role assignment must grant `SOURCE_READ + KNOWLEDGE_INSPECT` for the exact Source scope.

K04 remains blocked until the exact PR #11 head passes these acceptances and independent review.
