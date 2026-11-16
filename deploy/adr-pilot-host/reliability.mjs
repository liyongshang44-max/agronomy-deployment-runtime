import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fork, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreAuthorityRecoveryCheckpoint } from '../../packages/recovery-operations/src/index.mjs';

// Nine independent, one-shot fault scenarios. No retries to get a green result.
// Transport replays are deliberate assertions of the idempotency contract.
const repo=fileURLToPath(new URL('../../',import.meta.url));
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const output=process.env.ADR_HOST_RELIABILITY_EVIDENCE_DIR
  ? resolve(process.env.ADR_HOST_RELIABILITY_EVIDENCE_DIR) : fs.mkdtempSync(join(tmpdir(),'adr-reliability-evidence-'));
fs.mkdirSync(output,{recursive:true});
const live=new Set(),results=[];
function next(child,type){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(new Error('WORKER_TIMEOUT_'+type));},15000);
  const onMessage=m=>{if(m.type===type||m.type==='START_FAILED'){cleanup();resolve(m);}};
  const onExit=code=>{cleanup();reject(new Error('WORKER_EXIT_'+code+'_'+type));};
  function cleanup(){clearTimeout(timer);child.off('message',onMessage);child.off('exit',onExit);}
  child.on('message',onMessage);child.on('exit',onExit);
});}
async function start(scenario,root,recover=false){
  const child=fork(new URL('./reliability-worker.mjs',import.meta.url),[scenario,root,...(recover?['recover']:[])],{silent:true});
  live.add(child);child.on('exit',()=>live.delete(child));let stderr='';child.stderr.on('data',b=>stderr+=b);
  let message;try{message=await next(child,'READY');}catch(e){throw new Error(e.message+' '+stderr);}
  return {child,...message,base:`http://127.0.0.1:${message.port}`};
}
async function command(w,type){const pending=next(w.child,type==='ARM'?'ARMED':type);w.child.send({type});return pending;}
async function stop(w){if(w.child.exitCode!==null)return;const ended=new Promise(r=>w.child.once('exit',r));w.child.send({type:'STOP'});await ended;}
function disk(root){return Object.fromEntries(['state.json','state.json.prev','state.json.tmp'].map(name=>{
  const path=join(root,name);if(!fs.existsSync(path))return [name,{exists:false}];const bytes=fs.readFileSync(path),value={exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  try{const state=JSON.parse(bytes);restoreAuthorityRecoveryCheckpoint(state.checkpoint);value.valid_checkpoint=true;value.refs=state.checkpoint.snapshot.records.map(x=>x.ref);value.idempotency=state.metadata.idempotency??{};}catch(e){value.valid_checkpoint=false;value.code=e.code??e.name;}
  return [name,value];
}));}
const target='context-datum.v03.host.pilot-reading-00017';
const has=(d,version)=>!!d['state.json'].refs?.some(x=>x.kind==='ContextDatum'&&x.logicalId===target&&x.version===version);
const count=(d,version)=>d['state.json'].refs.filter(x=>x.kind==='ContextDatum'&&x.logicalId===target&&x.version===version).length;
const headers=key=>({authorization:'Bearer probe-synthetic-only','content-type':'application/json','idempotency-key':key});
async function post(w,body,key){try{const r=await fetch(w.base+w.smoke.path,{method:'POST',headers:headers(key),body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});return {status:r.status,body:await r.json()};}catch(e){return {status:null,outcome:'OUTCOME_UNKNOWN',code:e.cause?.code??e.name};}}
async function get(w,path,token='probe-read-only'){const r=await fetch(w.base+path,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});return {status:r.status,body:await r.json()};}
function pendingPost(w,body,key,id,hold){
  let finish;
  const promise=new Promise((resolve,reject)=>{
    const req=request(w.base+w.smoke.path,{method:'POST',headers:{...headers(key),'x-probe-request':id}},res=>{
      let chunks='';res.setEncoding('utf8');res.on('data',b=>chunks+=b);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(chunks)}));
    });req.on('error',reject);req.setTimeout(8000,()=>req.destroy(new Error('REQUEST_TIMEOUT')));
    const value=JSON.stringify(body);req.write(hold?value.slice(0,-1):value);finish=()=>req.end(hold?value.slice(-1):undefined);if(!hold)finish();
  });return {promise,finish};
}
async function queuedFault(w,body,key){
  const received=next(w.child,'RECEIVED'),first=pendingPost(w,body,key,'first',true);assert.equal((await received).id,'first');
  const nextBody=structuredClone(body);nextBody.version='3';
  const receivedNext=next(w.child,'RECEIVED'),queued=pendingPost(w,nextBody,'queued-key','queued',false);assert.equal((await receivedNext).id,'queued');
  first.finish();const [firstResponse,queuedResponse]=await Promise.all([first.promise,queued.promise]);return {firstResponse,queuedResponse};
}
try{
  for(const scenario of ['R0','R1','R2','R3','R4','R5','R6','R7','R8']){
    const root=fs.mkdtempSync(join(tmpdir(),'adr-fixed-'+scenario+'-')),w=await start(scenario,root),body=structuredClone(w.smoke.body);body.version='2';
    const r={scenario,source_sha:sourceSha,request_id:target,request_version:'2',before:disk(root)};
    try{
      assert.equal(has(r.before,'2'),false);
      if(scenario==='R7'){
        await stop(w);fs.copyFileSync(join(root,'state.json'),join(root,'state.json.prev'));fs.writeFileSync(join(root,'state.json'),'{corrupt');
        r.after_fault=disk(root);assert.equal(r.after_fault['state.json.prev'].valid_checkpoint,true);
        const restarted=await start(scenario,root,true);r.restart=restarted.type;r.restart_code=restarted.code;assert.equal(restarted.type,'START_FAILED');
      }else{
        await command(w,'ARM');
        if(scenario==='R8'){const observed=await queuedFault(w,body,'scenario-key');r.response=observed.firstResponse;r.queued_response=observed.queuedResponse;assert.equal(r.queued_response.status,503);}
        else r.response=await post(w,body,'scenario-key');
        r.after_fault=disk(root);
        if(scenario==='R6'){
          r.process_exit=w.child.exitCode!==null?w.child.exitCode:await new Promise(resolve=>w.child.once('exit',resolve));assert.equal(r.process_exit,86);assert.equal(r.response.status,null);assert.equal(has(r.after_fault,'2'),true);
        }else if(scenario==='R0'){
          assert.equal(r.response.status,201);assert.equal(has(r.after_fault,'2'),true);
          r.same_key=await post(w,body,'scenario-key');assert.deepEqual(r.same_key.body,r.response.body);
          const different=structuredClone(body);different.resource.source.source_ref='changed';r.conflict=await post(w,different,'scenario-key');assert.equal(r.conflict.status,409);
          const mismatch=await fetch(w.base+w.smoke.path,{method:'POST',headers:{...headers('mismatched-principal'),authorization:'Bearer probe-read-only'},body:JSON.stringify(body)});assert.equal(mismatch.status,403);
          const malformed=await fetch(w.base+w.smoke.path,{method:'POST',headers:headers('malformed'),body:'{'});assert.equal(malformed.status,400);
          assert.equal((await get(w,'/ready')).status,200);await stop(w);
        }else{
          assert.equal(r.response.status,503);assert.equal(r.response.body.code,'PILOT_RUNTIME_UNAVAILABLE');assert.equal(has(r.after_fault,'2'),false);
          r.memory=(await command(w,'SNAPSHOT')).state;assert.equal(r.memory.injection_fired,true);assert.equal(r.memory.ready,false);assert.equal(r.memory.persistenceFault,true);
          r.same_key=await post(w,body,'scenario-key');assert.equal(r.same_key.status,503);
          const later=structuredClone(body);later.version='3';r.later=await post(w,later,'later-key');assert.equal(r.later.status,503);
          r.reads={};for(const path of ['/healthz','/ready','/v1/workbench/cases/applicability.v03.host','/v1/workbench/escalations']){r.reads[path]=await get(w,path);assert.equal(r.reads[path].status,503);}
          assert.equal((await get(w,'/openapi.json')).status,200);
          r.direct_persist=await command(w,'PERSIST');assert.equal(r.direct_persist.status,'REJECTED');
          r.after_attempts=disk(root);assert.deepEqual(r.after_attempts,r.after_fault);assert.equal(has(r.after_attempts,'3'),false);await stop(w);
        }
        const restarted=await start(scenario,root,true);assert.equal(restarted.type,'READY');r.restart_initial=disk(root);r.restart_ready=await get(restarted,'/ready');assert.equal(r.restart_ready.status,200);
        r.replay_after_restart=await post(restarted,body,'scenario-key');assert.equal(r.replay_after_restart.status,201);
        r.after_restart=disk(root);assert.equal(has(r.after_restart,'2'),true);assert.equal(count(r.after_restart,'2'),1);
        const again=await post(restarted,body,'scenario-key');assert.deepEqual(again.body,r.replay_after_restart.body);
        if(['R0','R6'].includes(scenario))assert.deepEqual(r.replay_after_restart.body,r.after_fault['state.json'].idempotency[Object.keys(r.after_fault['state.json'].idempotency)[0]].response);
        await stop(restarted);
      }
      r.admission='PASS';results.push(r);fs.writeFileSync(join(output,scenario+'.json'),JSON.stringify(r,null,2));console.log(`${scenario} PASS`);
    }catch(e){r.admission='FAIL';r.first_failure={message:e.message,stack:e.stack};results.push(r);fs.writeFileSync(join(output,scenario+'.json'),JSON.stringify(r,null,2));throw e;}
  }
}finally{
  for(const child of live)child.kill();
  const summary={source_sha:sourceSha,admission:results.length===9&&results.every(r=>r.admission==='PASS')?'PASS':'FAIL',scenarios:results.map(r=>({id:r.scenario,admission:r.admission})),production_resources_used:false};
  fs.writeFileSync(join(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({evidence_dir:output,...summary}));
}
