(() => {
  const card = document.createElement('section');
  card.className = 'card';
  card.id = 'automatedReviewCard';
  card.innerHTML = `
    <h2>3A. Automated blind source-faithful review (LLM2)</h2>
    <p class="note">Second-pass falsification against the exact PDF. LLM2 cannot repair a candidate. Clear cases are automatically accepted/rejected; ambiguous cases are escalated to the human review controls below.</p>
    <p class="provider" id="automatedReviewProvider">Automated reviewer: checking…</p>
    <label style="font-weight:500"><input id="automatedReviewExternalAuth" type="checkbox">I confirm this SourceArtifact may be sent to the configured external reviewer for this review run.</label>
    <label style="font-weight:500;margin-top:8px"><input id="automatedReviewRetryEscalated" type="checkbox">Retry candidates already escalated to human.</label>
    <p><button id="runAutomatedReview">Run LLM2 blind review</button></p>
    <div id="automatedReviewSummary" class="status">NO_AUTOMATED_REVIEW_YET</div>
  `;
  const reviewSection = document.getElementById('reviewSection');
  reviewSection.parentNode.insertBefore(card, reviewSection);

  let configured = false;

  function summaryText(payload) {
    return `AUTO ACCEPT ${payload.autoAcceptedCount ?? 0} · AUTO REJECT ${payload.autoRejectedCount ?? 0} · ESCALATE ${payload.escalatedCount ?? 0} · SKIP ${payload.skippedReviewedCount ?? 0} / ${payload.candidateCount ?? 0}`;
  }

  function decorateAutomatedStates() {
    if (typeof currentCompilation === 'undefined' || !currentCompilation?.candidates) return;
    currentCompilation.candidates.forEach((candidate, index) => {
      const automated = candidate.automatedReview;
      if (!automated) return;
      const cardNode = document.getElementById(`candidate-${index}`);
      if (!cardNode || cardNode.dataset.automatedReviewDecorated === automated.status) return;
      cardNode.dataset.automatedReviewDecorated = automated.status;
      const firstLine = cardNode.querySelector('div');
      if (firstLine) {
        const badge = document.createElement('span');
        badge.className = automated.status === 'ESCALATED_PENDING_HUMAN' ? 'badge bad' : 'badge';
        badge.textContent = automated.status === 'ESCALATED_PENDING_HUMAN'
          ? 'LLM2 → HUMAN'
          : automated.effectiveDisposition === 'ACCEPT_SOURCE_FAITHFUL'
            ? 'LLM2 AUTO ACCEPT'
            : automated.effectiveDisposition === 'REJECT_SOURCE_FAITHFUL'
              ? 'LLM2 AUTO REJECT'
              : 'LLM2 REVIEW';
        firstLine.appendChild(badge);
      }
      if (automated.status === 'ESCALATED_PENDING_HUMAN') {
        const status = cardNode.querySelector('.review-status');
        if (status) status.textContent = `ESCALATED_TO_HUMAN · ${(automated.reasonCodes ?? []).join(', ') || 'REVIEW_REQUIRED'} · ${automated.rationale ?? ''}`;
      }
    });
  }

  const candidatesNode = document.getElementById('candidates');
  new MutationObserver(decorateAutomatedStates).observe(candidatesNode, { childList: true, subtree: true });

  async function refreshConfiguration() {
    try {
      const response = await fetch('/readyz', { cache: 'no-store' });
      const readiness = await response.json();
      configured = Boolean(readiness?.automatedSourceFaithfulReview?.configured);
      document.getElementById('automatedReviewProvider').textContent = configured
        ? `Automated reviewer: ${readiness.automatedSourceFaithfulReview.provider} / ${readiness.automatedSourceFaithfulReview.model} · ${readiness.automatedSourceFaithfulReview.mode}`
        : 'Automated reviewer: NOT_CONFIGURED — set OPENAI_API_KEY + ADR_SOURCE_FAITHFUL_REVIEW_MODEL.';
    } catch {
      configured = false;
      document.getElementById('automatedReviewProvider').textContent = 'Automated reviewer: readiness unavailable';
    }
  }

  document.getElementById('runAutomatedReview').addEventListener('click', async () => {
    if (!configured) return setResult('Automated source-faithful reviewer is not configured.');
    if (!currentUploadId || !sourceMaterialized) return setResult('Resume or materialize an exact SourceArtifact first.');
    if (!currentCompilation?.compilationResultRef) return setResult('Import/extract or resume an exact compilation first.');
    if (!document.getElementById('automatedReviewExternalAuth').checked) {
      return setResult('Explicit external processing authorization is required for LLM2 blind review.');
    }

    const button = document.getElementById('runAutomatedReview');
    const summary = document.getElementById('automatedReviewSummary');
    button.disabled = true;
    summary.textContent = 'RUNNING_LLM2_BLIND_REVIEW';
    try {
      const response = await fetch(`/operator/source-uploads/${encodeURIComponent(currentUploadId)}/automated-review`, {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          compilationResultRef: currentCompilation.compilationResultRef,
          externalProcessingAuthorized: true,
          retryEscalated: document.getElementById('automatedReviewRetryEscalated').checked
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(payload));
      summary.textContent = summaryText(payload);
      setResult(payload);
      await loadRecoverableCompilations();
      const recovered = recoverableCompilations.find((item) =>
        item.compilationResultRef?.semanticHash === payload.compilationResultRef?.semanticHash
          && item.compilationResultRef?.logicalId === payload.compilationResultRef?.logicalId
          && item.compilationResultRef?.version === payload.compilationResultRef?.version);
      if (recovered) {
        renderCandidates({ ...recovered, preflight: recoveredPreflight(recovered), recovered: true });
        decorateAutomatedStates();
      }
    } catch (error) {
      summary.textContent = 'AUTOMATED_REVIEW_FAILED';
      setResult(error.message);
    } finally {
      button.disabled = false;
    }
  });

  refreshConfiguration();
  decorateAutomatedStates();
})();
