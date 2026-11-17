import {sourceCard} from './assessment-view.js';

// Metadata-only intake. The browser has no PDF upload or knowledge qualification capability.
export async function renderSourceIntake({shell,json,escapeHtml}) {
  const session=await json('/api/demo/session');
  const scenario=await json('/api/demo/scenario');
  const sourceList=await json('/api/demo/sources');
  const row=(item) =>
    '<div class="science-block"><h3>'+escapeHtml(item.title)+' · '+escapeHtml(item.version)+'</h3>'+
    '<p class="muted">来源所有者：'+escapeHtml(item.owner)+' · 作物：'+escapeHtml(item.crop)+
    ' · 地区：'+escapeHtml(item.region)+' · 季节：'+escapeHtml(item.season)+'</p>'+
    '<p>产品接入状态：<strong>'+escapeHtml(item.status)+'</strong> ｜ 科学资格：<strong>'+
    escapeHtml(item.qualificationStatus)+'</strong></p>'+
    '<p class="muted">所记录的权利依据：'+escapeHtml(item.rightsBasis)+
    '（仅为产品元数据，不构成 ADR RightsDecision 或允许保留/外发的证明。）</p></div>';
  shell('农艺知识','来源登记、科学资格和使用限制分开管理。',
    '<section class="panel"><div class="sectionhead"><h2>正式 Host 已可读取的合格演示知识</h2>'+
    '<span class="status">SYNTHETIC / HOST READ</span></div>'+
    '<p>以下资格及来源引用来自隔离 ADR Host Workbench。不可由产品登记表单创建或修改。</p></section>'+
    sourceCard(scenario.sampleCase.scientificEvidence,escapeHtml)+
    '<section class="panel"><h2>登记待审核来源</h2>'+
    '<p class="muted">仅登记元数据。不上传 PDF、不保留全文、不进行模型外发。提交后默认 SUBMITTED；不生成 QualifiedKnowledge。</p>'+
    '<form id="source-intake" class="source-form">'+
    '<label>来源名称<input name="title" required maxlength="180" placeholder="例如：候选农业研究资料"></label>'+
    '<label>来源所有者<input name="owner" required maxlength="120" placeholder="机构或文献所有者"></label>'+
    '<label>来源版本<input name="version" required maxlength="80" placeholder="明确版本或修订标识"></label>'+
    '<label>作物<input name="crop" required maxlength="100"></label>'+
    '<label>地区<input name="region" required maxlength="140"></label>'+
    '<label>适用季节<input name="season" required maxlength="90"></label>'+
    '<label>所记录的权利依据<select name="rightsBasis" required>'+
    '<option value="NOT_PROVIDED">未提供</option>'+
    '<option value="CUSTOMER_ASSERTION_RECORDED">客户声称拥有使用权（未经核实）</option>'+
    '<option value="LICENSE_REFERENCE_RECORDED">仅登记许可证引用（未经核实）</option>'+
    '</select></label>'+
    '<label>接入说明<textarea name="notes" maxlength="400" rows="3"></textarea></label>'+
    '<button type="submit" class="primary-link">登记为 SUBMITTED</button>'+
    '<p id="source-message" role="status"></p></form></section>'+
    '<section class="panel"><h2>本次会话登记记录</h2>'+
    '<div id="sources-list">'+(sourceList.length?sourceList.map(row).join(''):
    '<p class="muted">尚未登记待审核来源。</p>')+'</div></section>');

  document.getElementById('source-intake').addEventListener('submit',async(event)=>{
    event.preventDefault();
    const form=event.currentTarget;
    const button=form.querySelector('button[type="submit"]');
    const message=document.getElementById('source-message');
    const values=Object.fromEntries(new FormData(form).entries());
    button.disabled=true;
    try {
      const response=await fetch('/api/demo/sources',{
        method:'POST',headers:{'content-type':'application/json','x-csrf-token':session.csrf},
        body:JSON.stringify(values)
      });
      const item=await response.json();
      if(!response.ok)throw new Error(item.code??'SOURCE_SUBMISSION_UNCONFIRMED');
      document.getElementById('sources-list').insertAdjacentHTML('afterbegin',row(item));
      message.textContent='来源元数据已登记：'+item.id+'；科学资格仍为 UNAVAILABLE';
      form.reset();
    }catch(error) {
      message.textContent='未确认登记：'+error.message;
    }finally{button.disabled=false;}
  });
}
