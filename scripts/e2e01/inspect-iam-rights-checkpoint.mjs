// Read-only E2E01 IAM/Rights checkpoint inspection. Never reads deployment secrets.
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {restoreAuthorityRecoveryCheckpoint} from '../../packages/recovery-operations/src/index.mjs';
import {sameAuthorityRef} from '../../packages/contracts/src/authority.mjs';

const root=process.argv[2];
const expected='sha256:06f5755e0b3f3d4442f2bd7955670cdf0e1dddf4be94a495b8a69313736360fc';
const need=(value,code)=>{if(!value)throw Object.assign(new Error(code),{code});};
need(typeof root==='string'&&root.length>0,'FORMAL_ROOT_PATH_REQUIRED');
const ignored=/(^|[\\/])(node_modules|\.git|\.cache)([\\/]|$)/i;
const secretName=/(token|credential|secret|session|oidc|keycloak|private[-_]?key)/i;
function* jsonFiles(dir,depth=0){
  if(depth>8)return;
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(ignored.test(path)||secretName.test(entry.name))continue;
    if(entry.isDirectory())yield* jsonFiles(path,depth+1);
    else if(entry.isFile()&&entry.name.toLowerCase().endsWith('.json')){
      const size=statSync(path).size;
      if(size>0&&size<=32*1024*1024)yield path;
    }
  }
}
const matches=[];
for(const path of jsonFiles(root)){
  try{
    const data=JSON.parse(readFileSync(path,'utf8'));
    const candidates=[data?.checkpoint,data?.recoveryCheckpoint,data].filter(Boolean);
    for(const cp of candidates){
      if(cp?.contractVersion==='adr.recovery-checkpoint.v1'&&cp?.checkpointHash===expected){
        matches.push({path,cp,bytes:readFileSync(path)});
        break;
      }
    }
  }catch{}
}
need(matches.length===1,matches.length===0?'E2E01_A05_A06_CHECKPOINT_NOT_FOUND': 'E2E01_A05_A06_CHECKPOINT_AMBIGUOUS');
const found=matches[0];
const {ledger,report}=restoreAuthorityRecoveryCheckpoint(found.cp);
const snapshot=ledger.exportSnapshot(),records=snapshot.records;
const policy=records.find(x=>x.ref.kind==='RightsPolicy'&&x.ref.logicalId==='rights.policy.geox.e2e01.soy.rotundo2024');
const source=records.find(x=>x.ref.kind==='Source'&&x.ref.logicalId==='source.geox.e2e01.soy.rotundo2024');
const artifact=records.find(x=>x.ref.kind==='SourceArtifact'&&x.ref.logicalId==='artifact.geox.e2e01.soy.rotundo2024');
const memberPolicy=records.find(x=>x.ref.kind==='KnowledgeGovernancePolicy'&&x.ref.logicalId==='policy.geox.e2e01.soy.program-release-member');
const release=records.find(x=>x.ref.kind==='KnowledgeRelease'&&x.ref.logicalId==='release.geox.e2e01.soy.model-limit.program-e2e01');
const profile=records.find(x=>x.ref.kind==='RuntimeProfile'&&x.ref.logicalId==='runtime-profile.geox.e2e01.soy.evidence-only');
const deployment=records.find(x=>x.ref.kind==='Deployment'&&x.ref.logicalId==='deployment.geox.e2e01.soy.evidence-only');
const same=(a,b)=>Boolean(a&&b&&sameAuthorityRef(a,b));
const relatedRights=(kind)=>!policy||!artifact?[]:records.filter(x=>x.ref.kind===kind&&same(x.semanticPayload?.rightsPolicyRef,policy.ref)&&same(x.semanticPayload?.subjectRef,artifact.ref));
function safe(value,depth=0){
  if(depth>6)return '[DEPTH_LIMIT]';
  if(value===null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return value.length>2400?value.slice(0,2400)+'[TRUNCATED]':value;
  if(Array.isArray(value))return value.slice(0,100).map(x=>safe(x,depth+1));
  if(value&&typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)){
      if(/^(content|fulltext|rawtext|rawbytes|token|credential|secret|password|privatekey|keymaterial)$/i.test(key))continue;
      out[key]=safe(item,depth+1);
    }
    return out;
  }
  return String(value);
}
const basisEvidence=(policy?.semanticPayload?.basis?.evidenceRefs??[]).map(ref=>{
  const record=ledger.resolve(ref);
  return {ref:record.ref,semanticPayload:safe(record.semanticPayload)};
});
const roleAssignments=records.filter(x=>x.ref.kind==='RoleAssignment'&&(
  x.semanticPayload?.principal?.organizationId==='org_geox'&&x.semanticPayload?.principal?.tenantId==='tenant_geox_e2e01'
));
const runtimeAssignments=roleAssignments.filter(x=>(
  x.semanticPayload?.permissions??[]
).some(p=>['knowledge.runtime.use','deployment.runtime.read','deployment.runtime.use'].includes(p)));
const authorizationAudits=records.filter(x=>x.ref.kind==='AuthorizationDecisionAudit'&&(
  ['DEPLOYMENT_RUNTIME_READ','KNOWLEDGE_RUNTIME_USE','DECISION_PROBLEM_CREATE'].includes(x.semanticPayload?.operation)
  || x.semanticPayload?.resourceScope?.resourceId==='deployment.geox.e2e01.soy.evidence-only'
));
const selected=[policy,source,artifact,...relatedRights('RightsGrant'),...relatedRights('RightsDecision'),...relatedRights('RightsRevocation'),...roleAssignments,...authorizationAudits].filter(Boolean);
const audits=snapshot.audit.filter(a=>selected.some(x=>same(x.ref,a.objectRef)));
const out={
  status:'E2E01_IAM_RIGHTS_CHECKPOINT_READONLY_INSPECTION_PASS',
  checkpoint_file:relative(root,found.path),
  checkpoint_file_sha256:'sha256:'+createHash('sha256').update(found.bytes).digest('hex'),
  checkpoint_hash:found.cp.checkpointHash,
  recovery_report:report,
  counts:{records:snapshot.records.length,audit_events:snapshot.audit.length},
  exact_refs:{
    rights_policy:policy?.ref??null,
    source:source?.ref??null,
    source_artifact:artifact?.ref??null,
    qualified_knowledge:records.find(x=>x.ref.kind==='QualifiedKnowledge'&&x.ref.logicalId==='knowledge.geox.e2e01.soy.SOY-MODEL-LIMIT-02')?.ref??null,
    program_release:release?.ref??null,
    member_policy:memberPolicy?.ref??null,
    runtime_profile:profile?.ref??null,
    deployment:deployment?.ref??null
  },
  rights_policy:safe(policy?.semanticPayload??null),
  rights_policy_basis_evidence:basisEvidence,
  program_member_policy:safe(memberPolicy?.semanticPayload??null),
  program_release:safe(release?.semanticPayload??null),
  runtime_profile:safe(profile?.semanticPayload??null),
  deployment:safe(deployment?.semanticPayload??null),
  source:safe(source?.semanticPayload??null),
  source_artifact:safe(artifact?.semanticPayload??null),
  rights_grants:relatedRights('RightsGrant').map(x=>({ref:x.ref,semanticPayload:safe(x.semanticPayload)})),
  rights_decisions:relatedRights('RightsDecision').map(x=>({ref:x.ref,semanticPayload:safe(x.semanticPayload)})),
  rights_revocations:relatedRights('RightsRevocation').map(x=>({ref:x.ref,semanticPayload:safe(x.semanticPayload)})),
  relevant_role_assignments:roleAssignments.map(x=>({ref:x.ref,semanticPayload:safe(x.semanticPayload)})),
  runtime_role_assignments:runtimeAssignments.map(x=>({ref:x.ref,semanticPayload:safe(x.semanticPayload)})),
  relevant_authorization_audits:authorizationAudits.map(x=>({ref:x.ref,semanticPayload:safe(x.semanticPayload)})),
  selected_publication_audits:audits.map(a=>safe({eventId:a.eventId,occurredAt:a.occurredAt,actor:a.actor,action:a.action,objectRef:a.objectRef,inputRefs:a.inputRefs,details:a.details})),
  runtime_service_principal_in_checkpoint:runtimeAssignments.some(x=>x.semanticPayload?.principal?.type==='SERVICE_ACCOUNT')
    ?'SERVICE_ACCOUNT_ROLE_ASSIGNMENT_PRESENT'
    :'NO_RUNTIME_SERVICE_ACCOUNT_ROLE_ASSIGNMENT_IN_CHECKPOINT',
  deployment_token_bindings:'NOT_READ; no token or credential values inspected'
};
console.log(JSON.stringify(out,null,2));
