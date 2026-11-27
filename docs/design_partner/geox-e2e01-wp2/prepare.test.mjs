import test from 'node:test';
import assert from 'node:assert/strict';
import {loadUnsigned,verifyUnsigned} from './prepare.mjs';
test('exact unsigned preparation has no minted scientific authority',()=>{const p=loadUnsigned(),r=verifyUnsigned(p);assert.equal(r.formal_authority_ready,false);assert.equal(r.approval_requests,10);});
test('reject release promotion, changed scope, fabricated approval and invented source hashes',()=>{
 for(const mutate of [p=>p.publication_authorized=true,p=>p.scope.field_id='foreign',p=>p.approval_requests[2].approval_ref='self-signed',p=>p.sources[0].raw_sha256='sha256:'+'a'.repeat(64),p=>p.formal_refs.knowledge_release_ref={kind:'KnowledgeRelease'},p=>p.proposed_resources.request_sha256='fake',p=>p.sources[1].rights.commercial_deployment_admitted=true]){
  const p=loadUnsigned();mutate(p);assert.throws(()=>verifyUnsigned(p));
 }
});

import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SOURCE_CONTEXT_FAMILIES,CLAIM_CANDIDATE_TYPES} from '../../../packages/scientific-compiler/src/index.mjs';
import {normalizeScientificUseTarget} from '../../../packages/knowledge-registry/src/qualification.mjs';
const read=n=>JSON.parse(readFileSync(new URL(n,import.meta.url),'utf8'));
const stable=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
function verify(p){
 const original=loadUnsigned(),obs=read('./source-byte-observation-successor-20261127.json');
 assert.equal(p.status,'SCIENTIFIC_REVIEW_READY_MATERIALS_ONLY');
 assert.equal(p.source_status,'SOURCE_OBSERVED');assert.equal(p.formal_status,'HOLD_FORMAL_AUTHORITY');
 assert.equal(obs.unsigned_package_hash,verifyUnsigned(original).package_hash);
 assert.equal(p.source_observation.observed_package_hash,obs.unsigned_package_hash);
 assert.equal(p.source_observation.observed_head,obs.executed_head);
 const soy=obs.results.find(x=>x.candidate_id==='SOY-WUR-ROTUNDO-2024-01');
 assert.equal(p.source_observation.raw_sha256,'sha256:bced62f287892f147e2f9c450c801a972c48855c0f5e255d17a7358ad3fe2495');
 assert.equal(p.source_observation.raw_sha256,soy.raw_sha256);
 assert.equal(p.source_observation.byte_length,soy.byte_length);
 assert.equal(p.source_observation.license,'CC-BY-4.0');assert.equal(p.source_observation.internal_policy_ref,null);
 assert.deepEqual(p.scope,original.scope);
 const s=p.scope, id='native_'+createHash('sha256').update(stable({scope:[s.tenant_id,s.project_id,s.group_id,s.field_id],review_id:s.review_id})).digest('hex');
 assert.equal(p.consumer.head,'e29589148ec6ca875eae64690390ebcd3d439a75');assert.equal(p.consumer.attempt_id,id);
 assert.equal(p.consumer.decision_problem_logical_id,id+':problem');assert.equal(p.consumer.retrieval_logical_id,id+':retrieval');
 assert.equal(p.consumer.a01_idempotency_key,id+':problem:1');assert.equal(p.consumer.a07_idempotency_key,id+':retrieval:1');
 for(const k of ['basis_sha256','a01_request_sha256','a07_request_sha256','target_binding_ref','decision_mapping_ref','a01_authorization_ref','a07_authorization_ref'])assert.equal(p.consumer[k],null);
 assert.deepEqual(normalizeScientificUseTarget(p.proposed_qualification_target),{use:'CROP_SUITABILITY_EVIDENCE_RETRIEVAL'});
 assert.deepEqual(p.claims.map(c=>c.key),['SOY-COLD-SEASON-01','SOY-MODEL-LIMIT-02']);
 for(const c of p.claims){assert.ok(CLAIM_CANDIDATE_TYPES.includes(c.claimType));assert.ok(c.assertion&&c.sourceLocator.coordinates.page&&c.proposedLimitations.length&&c.requiredForLaterApplicability.length);
 assert.deepEqual(Object.keys(c.sourceContext).sort(),[...SOURCE_CONTEXT_FAMILIES].sort());for(const f of Object.values(c.sourceContext)){assert.ok(['REPORTED','NOT_REPORTED'].includes(f.status));assert.equal(f.dimensions.length>0,f.status==='REPORTED');assert.ok(f.dimensions.every(d=>d.supportClass==='EXPLICIT_SOURCE'&&d.sourceLocator.kind==='DOCUMENT_COORDINATE'&&d.sourceLocator.coordinates.page));}}
 assert.deepEqual(p.proposed_release.evidence_crops,['SOYBEAN']);assert.deepEqual(p.proposed_release.question_crops,['CORN','SOYBEAN']);
 assert.deepEqual(p.proposed_release.member_candidate_keys,p.claims.map(c=>c.key));
 for(const k of ['release_target','release_ref','publication_decision_ref','validity'])assert.equal(p.proposed_release[k],null);
 assert.deepEqual(p.gates.map(x=>x.gate),['SOURCE_POLICY_K01_K02','K03','K04','K06']);
 assert.ok(p.gates.every(x=>x.status.startsWith('HOLD_')&&x.principal===null&&x.decision_ref===null&&x.role_assignment_refs.length===0));
 assert.ok(Object.values(p.native_refs).every(x=>x===null||Array.isArray(x)&&x.length===0));
 for(const k of ['formal_authority_ready','action_authority','execution_authority','publication_authorized','secret_issuance_authorized','deployment_authorized'])assert.equal(p[k],false);
}
test('soy source observation and review preparation retain exact no-authority boundary',()=>verify(read('./soy-review-ready.json')));
test('reject false promotion, wrong source or scope, mixed release and incomplete candidate context',()=>{for(const mutate of [p=>p.formal_authority_ready=true,p=>p.source_observation.raw_sha256='sha256:'+'0'.repeat(64),p=>p.scope.crop_codes=['SOYBEAN'],p=>p.proposed_release.evidence_crops.push('CORN'),p=>p.gates[1].principal={principalId:'invented'},p=>delete p.claims[0].sourceContext.BIOLOGICAL,p=>p.native_refs.release={kind:'KnowledgeRelease'},p=>p.consumer.basis_sha256='invented',p=>p.proposed_qualification_target.crop='SOYBEAN']){const p=read('./soy-review-ready.json');mutate(p);assert.throws(()=>verify(p));}});
