import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDemoHarness } from '../src/demo-harness.mjs';
import { createProductServer } from '../src/server.mjs';

test('PROD-FIX-02 review-start survives restart, duplicates do not reset, missing start is UNKNOWN', async () => {
  const harness=await createDemoHarness();
  let server;
  const open=async () => {
    server=createProductServer({mode:'DEMO',demoBinding:harness});
    await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
    return 'http://127.0.0.1:'+server.address().port;
  };
  try {
    let base=await open();
    const sessionResponse=await fetch(base+'/api/demo/session');
    const cookie=sessionResponse.headers.get('set-cookie').split(';')[0];
    const {csrf}=await sessionResponse.json();
    const headers=()=>({cookie,origin:base,'content-type':'application/json','x-csrf-token':csrf});
    const post=(url,body)=>fetch(base+url,{
      method:'POST',headers:headers(),...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    const id=randomUUID();
    const run=await post('/api/demo/assessments',{operationId:id});
    assert.equal(run.status,201);
    assert.equal((await run.json()).state,'CONFIRMED');
    const path='/api/demo/reviews/'+id;
    const absent=await (await fetch(base+path+'/start',{headers:{cookie}})).json();
    assert.equal(absent.startedAt,null);
    assert.equal(absent.timingStatus,'UNKNOWN');
    const first=await post(path+'/start');
    assert.equal(first.status,201);
    const start=await first.json();
    assert.equal(start.kind,'NON_AUTHORITY_REVIEW_START');
    assert.match(start.startedAt,/Z$/);
    const repeat=await post(path+'/start');
    assert.equal(repeat.status,200);
    assert.deepEqual(await repeat.json(),start);
    await new Promise((resolve)=>setTimeout(resolve,25));
    await new Promise((resolve)=>server.close(resolve));
    base=await open();
    const resumed=(await fetch(base+path+'/start',{headers:{cookie}}));
    assert.equal(resumed.status,200);
    assert.deepEqual(await resumed.json(),start);
    const submitted=await post(path,{outcome:'DEFERRED',notes:'review after BFF restart'});
    assert.equal(submitted.status,201);
    const record=await submitted.json();
    assert.equal(record.reviewDurationStatus,'MEASURED');
    assert.equal(record.startedAt,start.startedAt);
    assert.ok(Date.parse(record.startedAt)>=Date.parse(record.assessmentCreatedAt));
    assert.equal(record.durationMs,Date.parse(record.completedAt)-Date.parse(start.startedAt));
    assert.ok(record.durationMs>=25);
    assert.equal((await post(path,{outcome:'CONTEXT_REQUESTED',notes:'duplicate'})).status,409);
    assert.deepEqual(await (await fetch(base+path,{headers:{cookie}})).json(),record);

    const id2=randomUUID();
    const second=await post('/api/demo/assessments',{operationId:id2});
    assert.equal((await second.json()).state,'CONFIRMED');
    const noStart=await post('/api/demo/reviews/'+id2,{outcome:'DEFERRED',notes:'no trusted start'});
    assert.equal(noStart.status,201);
    const uncertain=await noStart.json();
    assert.equal(uncertain.startedAt,null);
    assert.equal(uncertain.durationMs,null);
    assert.equal(uncertain.reviewDurationStatus,'UNKNOWN');
    assert.ok(uncertain.assessmentCreatedAt);
    const report=await (await fetch(base+'/api/demo/reports/'+id2,{headers:{cookie}})).text();
    assert.ok(report.includes('UNKNOWN'));
    assert.ok(report.includes('评估创建时间（不计入复核）'));
  } finally {
    if(server?.listening)await new Promise((resolve)=>server.close(resolve));
    await harness.close();
  }
});
