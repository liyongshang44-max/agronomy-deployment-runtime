import test from 'node:test';
import assert from 'node:assert/strict';
import {loadUnsigned,verifyUnsigned} from './prepare.mjs';
test('exact unsigned preparation has no minted scientific authority',()=>{const p=loadUnsigned(),r=verifyUnsigned(p);assert.equal(r.formal_authority_ready,false);assert.equal(r.approval_requests,10);});
test('reject release promotion, changed scope, fabricated approval and invented source hashes',()=>{
 for(const mutate of [p=>p.publication_authorized=true,p=>p.scope.field_id='foreign',p=>p.approval_requests[2].approval_ref='self-signed',p=>p.sources[0].raw_sha256='sha256:'+'a'.repeat(64),p=>p.formal_refs.knowledge_release_ref={kind:'KnowledgeRelease'},p=>p.proposed_resources.request_sha256='fake',p=>p.sources[1].rights.commercial_deployment_admitted=true]){
  const p=loadUnsigned();mutate(p);assert.throws(()=>verifyUnsigned(p));
 }
});
