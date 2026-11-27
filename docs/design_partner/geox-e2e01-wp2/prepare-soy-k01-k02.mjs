// Exact-source input preparation only. No Ledger creation, authority publication or secret handling.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceContentHash} from '../../../packages/source-registry/src/index.mjs';
import {semanticHash} from '../../../packages/canonicalization/src/index.mjs';
import {BUILTIN_ROLES} from '../../../packages/authorization/src/index.mjs';
import {loadUnsigned,verifyUnsigned} from './prepare.mjs';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const review=JSON.parse(readFileSync(new URL('./soy-review-ready.json',import.meta.url),'utf8'));
const unsigned=verifyUnsigned(loadUnsigned());
const source=review.source_observation;
const expected='sha256:bced62f287892f147e2f9c450c801a972c48855c0f5e255d17a7358ad3fe2495';
const url='https://edepot.wur.nl/656804';
const normalize=s=>s.normalize('NFKC').replace(/\u00ad/g,'').replace(/[\u0000-\u0008\u000b\u000e-\u001f]/g,'').replace(/-\s*\n\s*/g,'-').replace(/\s+/g,' ').toLowerCase();
const rules={
 1:[/european soybean to benefit people and the environment/,/10\.1038\/s41598-024-57522-z/],
 2:[/increasing soybean production in europe/,/cool temperatures and a shorter growing season/,/north[-\s]*eastern europe and southern uk/,/clusters b and c/,/cold.tolerance/],
 9:[/crop modelling and simulations/,/phenological model and physiological model/,/0\.5.{0,8}resolution grid/,/4,?036 sites/,/1999 to 2018/,/maturity group from 0000 to iii/,/rainfed/,/european observations/],
 10:[/observed rainfed yield trials/,/belgium, germany, italy, the netherlands, spain, and the united kingdom/,/without any calibration to the data/,/observed mean trial yield of each grown maturity/,/n\s*=\s*84/,/pearson correlation\s*=\s*0\.48/,/percentage error\s*=\s*36\s*%/],
 14:[/creative commons attribution 4\.0 international license/,/creativecommons\.org\/licenses\/by\/4\.0/]
};
async function acquire(){
 let u=new URL(url);
 for(let i=0;i<5;i++){
  need(u.protocol==='https:'&&u.hostname==='edepot.wur.nl'&&!u.username&&!u.password,'SOY_REDIRECT_DENIED');
  const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Accept:'application/pdf','User-Agent':'GEOX-source-provenance-review/1.0'}});
  if([301,302,303,307,308].includes(r.status)){const next=r.headers.get('location');await r.body?.cancel();need(next,'SOY_REDIRECT_MISSING');u=new URL(next,u);continue;}
  need(r.status===200&&r.body,'SOY_PDF_HTTP_'+r.status);
  const reader=r.body.getReader(),parts=[];let n=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;need(n<=1804554,'SOY_PDF_LENGTH_EXCEEDED');parts.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  return {bytes:Buffer.concat(parts),final_url:u.href};
 }
 throw Error('SOY_REDIRECT_LIMIT');
}
const local=process.argv[2];
const fetched=local?{bytes:readFileSync(local),final_url:null}:await acquire();
const bytes=fetched.bytes;
need(source.raw_sha256===expected&&bytes.length===1804554&&sourceContentHash(bytes)===expected&&bytes.subarray(0,5).toString()==='%PDF-','SOY_EXACT_BYTES_MISMATCH');
const dir=mkdtempSync(join(tmpdir(),'adr-soy-k01-k02-'));
try{
 const pdf=join(dir,'exact.pdf');writeFileSync(pdf,bytes,{mode:0o600,flag:'wx'});
 const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});need(/^Pages:\s+14\s*$/m.test(info),'SOY_PAGE_COUNT_MISMATCH');
 const pages={};
 for(const [n,anchors] of Object.entries(rules)){
  const raw=execFileSync('pdftotext',['-f',n,'-l',n,'-layout','-enc','UTF-8',pdf,'-'],{encoding:'utf8',maxBuffer:4*1024*1024});
  const normalized=normalize(raw);
  for(const [i,re] of anchors.entries())need(re.test(normalized),'SOY_LOCATOR_PAGE_'+n+'_ANCHOR_'+(i+1)+'_MISSING');
  pages[n]={page:Number(n),layout_text_sha256:sourceContentHash(Buffer.from(raw,'utf8')),anchor_count:anchors.length};
 }
 const locate=l=>{const p=pages[l.coordinates.page];need(p,'SOY_UNCHECKED_COORDINATE');return {...l,coordinates:{...l.coordinates,pageTextExtraction:'pdftotext -f PAGE -l PAGE -layout -enc UTF-8',pageTextSha256:p.layout_text_sha256}};};
 const claims=review.claims.map(c=>{
  const assertion=c.key==='SOY-MODEL-LIMIT-02'?c.assertion.split(' The comparison supports')[0]:c.assertion;
  const context=Object.fromEntries(Object.entries(c.sourceContext).map(([family,x])=>[family,{status:x.status,dimensions:x.dimensions.map(d=>({...d,sourceLocator:locate(d.sourceLocator)}))}]));
  return {key:c.key,claimType:c.claimType,assertion,sourceLocator:locate(c.sourceLocator),sourceContext:context};
 });
 const base='geox.e2e01.soy.rotundo2024';
 const attribution='Rotundo et al. (2024), European soybean to benefit people and the environment, Scientific Reports 14:7612, DOI 10.1038/s41598-024-57522-z. CC BY 4.0 https://creativecommons.org/licenses/by/4.0/. Candidate assertions are paraphrases/adaptations; no third-party materials, underlying datasets or model rights inferred.';
 const inputs={
  source:{logicalId:'source.'+base,version:'1',sourceType:'PUBLICATION',title:'European soybean to benefit people and the environment',ownership:null,bibliographic:{doi:source.doi,citation:'Rotundo et al. (2024), Scientific Reports 14:7612',journal:'Scientific Reports',publisher:'Springer Nature',year:2024,authors:'Jose L. Rotundo et al.'},sourceVersionLabel:'Version of record',originLocator:url,rights:{license:'CC-BY-4.0',licenseUrl:source.license_url,attribution,internalPolicyRef:null},audit:null},
  artifact:{logicalId:'artifact.'+base,version:'1',sourceRef:null,mediaType:'application/pdf',materializationIdentity:expected,acquisition:{method:'HTTPS_PUBLICATION',acquiredAt:null,locator:url},rightsSnapshot:null,audit:null},
  compiler:{logicalId:'compiler.'+base,version:'1',compilerId:'adr.geox.e2e01.soy.review-proposal',implementationVersion:'1',configuration:{mode:'HUMAN_REVIEW_PROPOSAL',sourceContentHash:expected,proposalHash:semanticHash('GeoxSoyClaimProposal',claims)},audit:null},
  compilation:{compilationLogicalId:'compilation.'+base,version:'1',sourceArtifactRef:null,compilerDefinitionRef:null,proposal:{claims,runMetadata:{scope:'SOY_SOURCE_CANDIDATES_ONLY',sourceByteHash:expected,interpretation:'NOT_K03_OR_K04'}},audit:null}
 };
 const draft={schema:'adr.geox-e2e01.soy-k01-k02-inputs.v1',status:'EXACT_PDF_PAGE_ANCHORS_PASS_UNSIGNED_NATIVE_INPUTS',source:{url,final_url:fetched.final_url,raw_sha256:expected,byte_length:bytes.length,pages,pdftotext_version:execFileSync('sh',['-c','pdftotext -v 2>&1'],{encoding:'utf8'}).split('\n')[0]},unsigned_package_hash:unsigned.package_hash,scope:review.scope,inputs,review_only:review.claims.map(c=>({key:c.key,proposedLimitations:c.proposedLimitations,requiredForLaterApplicability:c.requiredForLaterApplicability})),authorization:{actual_organization_id:null,actual_tenant_id:null,owner_attestation_ref:null,authority_root_ref:null,source_steward_principal:null,compiler_principal:null,compiler_role:'COMPILER_SERVICE',compiler_permissions:BUILTIN_ROLES.COMPILER_SERVICE,proposed_resource_scopes:[{resourceType:'SOURCE',resourceId:inputs.source.logicalId},{resourceType:'SOURCE_ARTIFACT',resourceId:inputs.artifact.logicalId},{resourceType:'SCIENTIFIC_COMPILATION',resourceId:inputs.compilation.compilationLogicalId}],role_assignment_refs:[],source_rights_policy_ref:null,source_rights_grant_refs:[],retention_policy_ref:null,approval_ref:null},native_refs:null,formal_authority_ready:false,write_authorized:false,k03_authorized:false,k04_authorized:false,release_authorized:false,customer_display_authorized:false};
 const receipt={...draft,preparation_sha256:semanticHash('GeoxSoyK01K02UnsignedInputs',draft)};
 console.log(JSON.stringify(receipt,null,2));
 if(process.env.SOY_PREPARATION_OUTPUT)writeFileSync(process.env.SOY_PREPARATION_OUTPUT,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
}finally{rmSync(dir,{recursive:true,force:true});}
