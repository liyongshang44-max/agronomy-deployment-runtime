import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createDemoHarness} from '../src/demo-harness.mjs';
import {createProductServer} from '../src/server.mjs';

test('source metadata intake is session-isolated and never grants rights or knowledge authority', async () => {
  const harness=await createDemoHarness();
  let product;
  try {
    product=createProductServer({mode:'DEMO',demoBinding:harness});
    await new Promise((resolve)=>product.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+product.address().port;
    const sr=await fetch(base+'/api/demo/session');
    const cookie=sr.headers.get('set-cookie').split(';')[0];
    const {csrf}=await sr.json();
    const body={
      title:'Candidate paper',owner:'Sample owner',version:'R1',crop:'maize',
      region:'fictional geography',season:'2026',rightsBasis:'NOT_PROVIDED',
      notes:'No fulltext retained'
    };
    const submit=(value,headers={})=>fetch(base+'/api/demo/sources',{
      method:'POST',
      headers:{
        'content-type':'application/json',origin:base,cookie,
        'x-csrf-token':csrf,...headers
      },
      body:JSON.stringify(value)
    });
    assert.equal((await fetch(base+'/api/demo/sources')).status,401);
    assert.equal((await submit(body,{'x-csrf-token':'wrong'})).status,403);
    assert.equal((await submit({...body,sourceBytes:'base64-content'})).status,400);
    assert.equal((await submit({...body,qualifiedKnowledgeRef:{kind:'QualifiedKnowledge'}})).status,400);
    assert.equal((await submit({...body,rightsBasis:'ALLOW_MODEL_EGRESS'})).status,400);
    const accepted=await submit(body);
    assert.equal(accepted.status,201);
    const item=await accepted.json();
    assert.equal(item.kind,'NON_AUTHORITY_SOURCE_INTAKE');
    assert.equal(item.status,'SUBMITTED');
    assert.equal(item.qualificationStatus,'UNAVAILABLE');
    assert.equal(item.qualifiedKnowledgeRef,null);
    assert.equal(item.rightsVerified,false);
    assert.equal(item.fulltextRetained,false);
    assert.equal(item.authorizedForModelEgress,false);
    assert.equal((await (await fetch(base+'/api/demo/sources',{headers:{cookie}})).json()).length,1);

    // Session isolation: another browser cannot read the submitted candidate.
    const other=await fetch(base+'/api/demo/session');
    const otherCookie=other.headers.get('set-cookie').split(';')[0];
    assert.notEqual(otherCookie,cookie);
    const otherRecords=await (await fetch(base+'/api/demo/sources',{
      headers:{cookie:otherCookie}
    })).json();
    assert.deepEqual(otherRecords,[]);
  } finally {
    if(product?.listening)await new Promise((resolve)=>product.close(resolve));
    await harness.close();
  }
});
