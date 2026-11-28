import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {semanticHash} from '../../../packages/canonicalization/src/index.mjs';
const base=new URL('./unsigned-package.json',import.meta.url);
export function loadUnsigned(){return JSON.parse(readFileSync(base,'utf8'));}
export function verifyUnsigned(p){
 const fail=(ok,code)=>{if(!ok)throw Error(code);};
 fail(p.schema==='adr.geox-e2e01.unsigned-preparation.v1'&&p.status==='UNSIGNED_CANDIDATE_ONLY','UNSIGNED_REQUIRED');
 fail(p.publication_authorized===false&&p.secret_issuance_authorized===false&&p.deployment_authorized===false&&p.action_authority===false&&p.scientific_qualification==='NOT_ESTABLISHED','AUTHORITY_PROMOTION_DENIED');
 const s=p.scope;
 fail(s.tenant_id==='tenant_geox_e2e01'&&s.project_id==='project_geox_e2e01'&&s.group_id==='group_geox_e2e01'&&s.field_id==='field_geox_e2e01_001'&&s.review_id==='review_geox_e2e01_001'&&JSON.stringify(s.crop_codes)==='["CORN","SOYBEAN"]'&&s.target_start_date==='2027-04-01'&&s.target_end_date==='2027-10-01'&&Array.isArray(s.documents)&&s.documents.length===0,'EXACT_SCOPE_REQUIRED');
 const basis={review_id:s.review_id,scope:[s.tenant_id,s.project_id,s.group_id,s.field_id]};
 const attempt='native_'+createHash('sha256').update(JSON.stringify(basis)).digest('hex');
 fail(p.proposed_resources.decision_problem_logical_id===attempt+':problem'&&p.proposed_resources.retrieval_logical_id===attempt+':retrieval','PROPOSED_RESOURCE_MISMATCH');
 fail(p.proposed_resources.basis_sha256===null&&p.proposed_resources.request_sha256===null&&p.proposed_decision_mapping.status==='PROPOSED_NOT_GOVERNED','UNVERIFIED_REQUEST_PROMOTION');
 fail(p.sources.length===2&&p.sources.every(x=>x.scientific_status==='CANDIDATE_ONLY'&&x.raw_sha256===null&&x.rights.commercial_deployment_admitted===false&&x.rights.fulltext_retention_admitted===false&&x.claims.every(c=>c.evidence_locator&&c.limitations.length&&c.source_context)),'CANDIDATE_PROMOTION_DENIED');
 fail(p.approval_requests.length===10&&new Set(p.approval_requests.map(x=>x.gate)).size===10&&p.approval_requests.every(x=>x.approval_ref===null&&x.status.startsWith('HOLD_')&&x.actor_required&&x.native_inputs.length),'UNAPPROVED_AUTHORITY');
 fail(Object.values(p.formal_refs).every(x=>x===null||Array.isArray(x)&&x.length===0),'FORMAL_REF_INVENTION_DENIED');
 return {status:'UNSIGNED_PREPARATION_STRUCTURE_PASS',package_hash:semanticHash('GeoxE2E01UnsignedPreparation',p),source_count:2,approval_requests:10,formal_authority_ready:false};
}
