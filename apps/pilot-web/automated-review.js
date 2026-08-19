(() => {
  let rightsJurisdiction = 'UNSPECIFIED';
  let pendingCreatedUploadId = null;

  const uploadButton = document.getElementById('upload');
  const uploadSection = uploadButton.closest('section');
  const rightsCard = document.createElement('section');
  rightsCard.className = 'card';
  rightsCard.id = 'rightsAuthorityCard';
  const oneYear = new Date();
  oneYear.setUTCFullYear(oneYear.getUTCFullYear() + 1);
  rightsCard.innerHTML = `
    <h2>0. Rights Authority (RA02)</h2>
    <p class="note"><strong>Recorded source rights metadata is not permission.</strong> Dangerous side effects are fail-closed against exact RightsPolicy / RightsGrant / point-in-time RightsDecision authority. Source grants never inherit to SourceArtifact.</p>
    <p class="provider" id="rightsReadiness">Rights enforcement: checking…</p>
    <div class="grid">
      <div>
        <label>Provisioning basis class</label>
        <select id="rightsBasisClass">
          <option>LICENSE</option>
          <option>CUSTOMER_ASSERTION</option>
          <option>CONTRACT</option>
          <option>PUBLIC_DOMAIN</option>
          <option>INTERNAL_POLICY</option>
        </select>
      </div>
      <div><label>Grant valid until (ISO 8601)</label><input id="rightsValidUntil" value="${oneYear.toISOString()}"></div>
    </div>
    <label style="font-weight:500;margin-top:12px"><input id="retainFulltextAuthority" type="checkbox">I explicitly provision RETAIN_FULLTEXT for this Source for scientific knowledge ingestion. This is separate from the source metadata "Rights basis" field.</label>
    <div id="sourceRightsStatus" class="status">SOURCE_RETENTION_RIGHTS_NOT_PROVISIONED</div>
    <div class="split"></div>
    <h3>Exact SourceArtifact permissions</h3>
    <p class="note">After finalization, provision local scientific processing separately from external model egress. Repeated overlapping grants are intentionally not auto-merged.</p>
    <div class="actions">
      <button id="provisionArtifactLocalRights" class="secondary">Provision READ + RETAIN_DERIVED</button>
      <button id="provisionArtifactEgressRights" class="secondary">Provision MODEL_EGRESS</button>
    </div>
    <div id="artifactRightsStatus" class="status">SOURCE_ARTIFACT_RIGHTS_NOT_PROVISIONED</div>
  `;
  uploadSection.parentNode.insertBefore(rightsCard, uploadSection);

  function rightsRule(operation, purposes) {
    return { operation, purposes, jurisdictions: [rightsJurisdiction], obligations: [] };
  }

  function validity() {
    const validFrom = new Date().toISOString();
    const validUntil = document.getElementById('rightsValidUntil').value.trim();
    if (!validUntil || Number.isNaN(Date.parse(validUntil))) throw new Error('Rights valid-until must be a valid ISO-8601 timestamp.');
    return { validFrom, validUntil: new Date(validUntil).toISOString() };
  }

  async function provisionRights(subject, rules, version) {
    if (!currentUploadId) throw new Error('Create or resume a source session first.');
    const { validFrom, validUntil } = validity();
    const response = await fetch(`/operator/source-uploads/${encodeURIComponent(currentUploadId)}/rights`, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        subject,
        basisClass: document.getElementById('rightsBasisClass').value,
        rules,
        validFrom,
        validUntil,
        version
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(payload));
    return payload;
  }

  async function existingPendingSession() {
    if (!pendingCreatedUploadId || pendingCreatedUploadId !== currentUploadId) return null;
    const response = await fetch(`/operator/source-uploads/${encodeURIComponent(currentUploadId)}`, { headers: authHeaders() });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.state === 'CREATED' ? payload : null;
  }

  // Replace the legacy create+upload click path. The exact Source is now created first,
  // then explicit RETAIN_FULLTEXT authority is provisioned, and only then may bytes flow.
  uploadButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const file = document.getElementById('file').files[0];
    if (!file) return setResult('Select a PDF first.');
    if (!document.getElementById('token').value) return setResult('Operator token is required.');
    if (!document.getElementById('retainFulltextAuthority').checked) {
      return setResult('Explicit RETAIN_FULLTEXT rights provisioning confirmation is required before PDF bytes may be retained.');
    }

    uploadButton.disabled = true;
    document.getElementById('finalize').disabled = true;
    sourceMaterialized = false;
    currentCompilation = null;
    recoverableCompilations = [];
    document.getElementById('compilationRecovery').hidden = true;
    document.getElementById('reviewSection').hidden = true;
    refreshButtons();
    document.getElementById('progress').value = 0;
    document.getElementById('status').textContent = 'CREATING SOURCE AUTHORITY';

    try {
      let session = await existingPendingSession();
      if (!session) {
        const logicalId = document.getElementById('logicalId').value.trim();
        const sessionResponse = await fetch('/operator/source-uploads', {
          method: 'POST',
          headers: authHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({
            scope: {
              organizationId: document.getElementById('org').value.trim(),
              tenantId: document.getElementById('tenant').value.trim() || undefined
            },
            filename: file.name,
            declaredMediaType: 'application/pdf',
            source: {
              logicalId,
              version: '1',
              sourceType: document.getElementById('sourceType').value,
              title: document.getElementById('title').value.trim(),
              bibliographic: document.getElementById('doi').value.trim() ? { doi: document.getElementById('doi').value.trim() } : {},
              rights: { basis: document.getElementById('rights').value, trainingUse: 'PROHIBITED' }
            },
            artifact: {
              logicalId: `${logicalId}.artifact.pdf`,
              version: '1',
              mediaType: 'application/pdf',
              materializationIdentity: `operator-upload:${file.name}`,
              acquisition: { method: 'UPLOAD', acquiredAt: new Date().toISOString(), locator: `operator-upload://${file.name}` },
              rightsSnapshot: { basis: document.getElementById('rights').value, trainingUse: 'PROHIBITED' },
              metadata: { originalFilename: file.name }
            }
          })
        });
        session = await sessionResponse.json();
        if (!sessionResponse.ok) throw new Error(JSON.stringify(session));
        rememberUploadId(session.uploadId);
        pendingCreatedUploadId = session.uploadId;
      }

      document.getElementById('status').textContent = 'PROVISIONING RETAIN_FULLTEXT';
      const sourceRights = await provisionRights(
        'SOURCE',
        [rightsRule('RETAIN_FULLTEXT', ['SCIENTIFIC_KNOWLEDGE_INGESTION'])],
        `workbench-source-retention-${Date.now()}`
      );
      document.getElementById('sourceRightsStatus').textContent = `RETAIN_FULLTEXT PROVISIONED · ${sourceRights.rightsGrantRef.logicalId}@${sourceRights.rightsGrantRef.version}`;

      document.getElementById('status').textContent = 'UPLOADING RIGHTS-GATED PDF';
      const uploaded = await new Promise((resolveUpload, rejectUpload) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', `/operator/source-uploads/${encodeURIComponent(currentUploadId)}/content`);
        xhr.setRequestHeader('Authorization', `Bearer ${document.getElementById('token').value}`);
        xhr.setRequestHeader('Content-Type', 'application/pdf');
        xhr.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) document.getElementById('progress').value = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          document.getElementById('status').textContent = `UPLOADING ${progressEvent.loaded.toLocaleString()} / ${progressEvent.lengthComputable ? progressEvent.total.toLocaleString() : '?'} bytes`;
        };
        xhr.onerror = () => rejectUpload(new Error('network upload failed'));
        xhr.onload = () => {
          let payload;
          try { payload = JSON.parse(xhr.responseText); } catch { payload = xhr.responseText; }
          if (xhr.status >= 200 && xhr.status < 300) resolveUpload(payload);
          else rejectUpload(new Error(typeof payload === 'string' ? payload : JSON.stringify(payload)));
        };
        xhr.send(file);
      });
      pendingCreatedUploadId = null;
      document.getElementById('progress').value = 100;
      document.getElementById('status').textContent = 'STORED_WITH_RIGHTS_DECISION';
      document.getElementById('finalize').disabled = false;
      setResult(uploaded);
    } catch (error) {
      document.getElementById('status').textContent = 'RIGHTS_GATED_UPLOAD_FAILED';
      setResult(error.message);
    } finally {
      uploadButton.disabled = false;
    }
  }, true);

  document.getElementById('provisionArtifactLocalRights').addEventListener('click', async () => {
    if (!currentUploadId || !sourceMaterialized) return setResult('Finalize or resume an exact SourceArtifact first.');
    const button = document.getElementById('provisionArtifactLocalRights');
    button.disabled = true;
    try {
      const payload = await provisionRights(
        'SOURCE_ARTIFACT',
        [
          rightsRule('READ_FOR_EXTRACTION', ['SCIENTIFIC_CLAIM_EXTRACTION', 'SOURCE_FAITHFUL_REVIEW']),
          rightsRule('RETAIN_DERIVED', ['SCIENTIFIC_CLAIM_EXTRACTION', 'SOURCE_FAITHFUL_REVIEW'])
        ],
        `workbench-artifact-local-${Date.now()}`
      );
      document.getElementById('artifactRightsStatus').textContent = `READ_FOR_EXTRACTION + RETAIN_DERIVED PROVISIONED · ${payload.rightsGrantRef.logicalId}@${payload.rightsGrantRef.version}`;
      setResult(payload);
    } catch (error) {
      button.disabled = false;
      document.getElementById('artifactRightsStatus').textContent = 'LOCAL_ARTIFACT_RIGHTS_PROVISION_FAILED';
      setResult(error.message);
    }
  });

  document.getElementById('provisionArtifactEgressRights').addEventListener('click', async () => {
    if (!currentUploadId || !sourceMaterialized) return setResult('Finalize or resume an exact SourceArtifact first.');
    const button = document.getElementById('provisionArtifactEgressRights');
    button.disabled = true;
    try {
      const payload = await provisionRights(
        'SOURCE_ARTIFACT',
        [rightsRule('MODEL_EGRESS', ['SCIENTIFIC_CLAIM_EXTRACTION', 'SOURCE_FAITHFUL_REVIEW'])],
        `workbench-artifact-egress-${Date.now()}`
      );
      document.getElementById('artifactRightsStatus').textContent += ` · MODEL_EGRESS PROVISIONED ${payload.rightsGrantRef.logicalId}@${payload.rightsGrantRef.version}`;
      setResult(payload);
    } catch (error) {
      button.disabled = false;
      document.getElementById('artifactRightsStatus').textContent = 'MODEL_EGRESS_RIGHTS_PROVISION_FAILED';
      setResult(error.message);
    }
  });

  const card = document.createElement('section');
  card.className = 'card';
  card.id = 'automatedReviewCard';
  card.innerHTML = `
    <h2>3A. Automated blind source-faithful review (LLM2)</h2>
    <p class="note">Second-pass falsification against the exact PDF. LLM2 cannot repair a candidate. Clear cases are automatically accepted/rejected; ambiguous cases are escalated to the human review controls below.</p>
    <p class="provider" id="automatedReviewProvider">Automated reviewer: checking…</p>
    <label style="font-weight:500"><input id="automatedReviewExternalAuth" type="checkbox">I confirm this SourceArtifact may be sent to the configured external reviewer for this review run. This confirmation does not substitute for MODEL_EGRESS RightsDecision authority.</label>
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
      rightsJurisdiction = readiness?.rightsAuthority?.jurisdiction ?? 'UNSPECIFIED';
      document.getElementById('rightsReadiness').textContent = `Rights enforcement: ${readiness?.rightsAuthority?.enforcement ?? 'UNKNOWN'} · jurisdiction ${rightsJurisdiction} · UNKNOWN/DENY blocks before side effect`;
      configured = Boolean(readiness?.automatedSourceFaithfulReview?.configured);
      document.getElementById('automatedReviewProvider').textContent = configured
        ? `Automated reviewer: ${readiness.automatedSourceFaithfulReview.provider} / ${readiness.automatedSourceFaithfulReview.model} · ${readiness.automatedSourceFaithfulReview.mode}`
        : 'Automated reviewer: NOT_CONFIGURED — set OPENAI_API_KEY + ADR_SOURCE_FAITHFUL_REVIEW_MODEL.';
    } catch {
      configured = false;
      document.getElementById('rightsReadiness').textContent = 'Rights enforcement readiness unavailable';
      document.getElementById('automatedReviewProvider').textContent = 'Automated reviewer: readiness unavailable';
    }
  }

  document.getElementById('runAutomatedReview').addEventListener('click', async () => {
    if (!configured) return setResult('Automated source-faithful reviewer is not configured.');
    if (!currentUploadId || !sourceMaterialized) return setResult('Resume or materialize an exact SourceArtifact first.');
    if (!currentCompilation?.compilationResultRef) return setResult('Import/extract or resume an exact compilation first.');
    if (!document.getElementById('automatedReviewExternalAuth').checked) {
      return setResult('Explicit external processing confirmation is required for LLM2 blind review. MODEL_EGRESS rights are checked separately by the server.');
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
