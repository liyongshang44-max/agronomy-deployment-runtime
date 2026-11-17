# ADR-PROD UX-02 — 科学阅读字段映射、不可推断边界与人工复测

状态：`ENGINEERING_IMPLEMENTATION_CANDIDATE / HUMAN_RETEST_PENDING`  
基线：`PR #232 7365df6c072d4680b7a02318c6d91dfbe38ff3e9`（CTO 授权）  
写入范围：`apps/adr-product/**`、`docs/product/**`；不改动 ADR Core、Public API、SDK、Pilot Host、真实身份和科学权威

## 同源实现

**原始事实**：只有既有 ADR Pilot Host Workbench 的 `scenario.sampleCase.scientificEvidence` 或新评估 `workbenchCase.scientificEvidence` 及其 `applicability`。数据通过原 BFF 已授权接口取得；知识页、评估页、导出 HTML 报告复用同一个 `sourceCard(evidence,escape,options)`。纯产品只读 `knowledgeReading()` 解释原始字段，不建立新的资格。

- `/knowledge`：`source-intake.js` 从 `/api/demo/scenario` 读取原始知识/目标适用性；把业务摘要优先显示，候选来源元数据登记折叠并标记无科学资格。
- `/assessments`：`live-demo.js` 对原基线和新生成实际评估分别读取相应原始 Workbench 对象。精确输入绑定仍保留，放入可展开审计区，提交行为、操作 ID 与幂等身份未更改。
- `/reports` 与导出 HTML：页面调用同一 `sourceCard()`；报告后端 `renderDemoReport()` 以 `sourceCard()` 输出同一条原始主张、各来源、限制及状态，并按农业问题→分类→证据→缺口→人工意见→精确技术数据排序。

### 每类阅读内容的事实来源

| 用户要理解什么 | 唯一允许的返回字段 | 绝对不可推断 |
| --- | --- | --- |
| 科学知识在说什么 | DerivedKnowledge 顶层 `scientificEvidence.assertion`；QualifiedKnowledge `scientificEvidence.claim.assertion`，或每个 inputQualifiedEvidence[].claim.assertion | 翻译/改写成新增因果效应、效果幅度、农艺建议或虚构中文原文 |
| 来源与主张是否可追踪 | 每个来源独立 `source.title`、`source.sourceArtifactRef`、`source.contentHash`、`claim.claimRef`、`claim.sourceLocator`、`sourceFaithfulReview.disposition` | 内部 ID/哈希视为已独立核验研究，或根据 title 猜作者、年份、论文质量 |
| 原研究适用条件 | `originContext.contextFamilies` 中已返回的 family 状态和 dimensions（原始语义 ID/值）；资格决定的 `semanticPreconditions`、`transportConstraints`、`qualificationTarget`、`limitations`；Derived 的 `introducedRestrictions` 与 `unresolvedContextHeterogeneity` | 根据通用农业常识补齐未报告的作物、地区、生育阶段、测量方法或研究阈值 |
| 目标田块适用性 | `workbenchCase.applicability.transportStatus`、`conditionResults`、`limitations`、`missingContextSemanticIds`、`requiredCalibrationCodes`、`requiredTransformationRefs` | 把科学用途资格、条件匹配、未触发复核解释成真实作业许可 |
| 科学用途资格与复核 | `applicability.scientificUseStatus`、`classification`、`reviewRequired`、`sourceFaithfulReview.disposition`、既有 qualification decisions | 产品人工反馈改变原始 `ApplicabilityAssessment` 或凭来源忠实性复核认定研究普遍成立 |
| 来源原文访问 | `sourceSpan.previewAvailable` 加上返回的 `previewText`；产品源元数据表记录的 `rightsBasis` 仅为未经验证声明 | 因 source hash 存在而宣称有全文权利、自动从源文件系统读取、绕过 WP 下载 PDF |
| 精确证据 | 未更改的 `AuthorityRef`、`semanticHash`、`projectionHash`、`contextManifestRef` 和原始 JSON | 编辑哈希/引用、把合成报告升级成生产证明 |

只读产品状态 `SCIENTIFIC_EXPLANATION_INSUFFICIENT` 标记关键返回字段不够：主张、可读来源名称、来源定位、明确支持条件、或可核查原文不足。**这不是新的 ADR 原始科学分类，也不能补造缺失科学事实**。阈值仅在 Host 返回显式结构化字段时展示；没有则写「未提供具体阈值」，如果原文文字有数字仍以原文为准，不能当成受治理阈值。作者、年份缺失按 `NOT_REPORTED` 呈现。

### 必须区分的状态

| 输入事实 | 展示 | 说明 |
| --- | --- | --- |
| 字段根本不存在（`undefined`） | `NOT_REPORTED` | 未报告 |
| 字段显式为空值（`null`） | `UNKNOWN` | 值未知 |
| 返回 `UNAVAILABLE` | `UNAVAILABLE` | 接口或授权不可用 |
| 返回数值 `0` | `0` | 是数值，不能被当成缺失 |
| 返回 `[]` | 「已返回空列表（不证明不存在）」 | 不自动推断没有限制 |
| 无可授权核查原文 | 「当前没有授权原文预览」 | 不推断全局无版权/无授权，不自动查取 |
| 部分来源可读、部分不可读 | 逐来源分别显示 | 不汇总成全局授权 |

### WP 专有接口依赖（不得在产品模拟）

1. **来源全文/精确定位读取**：需 WP 提供按 SourceArtifact/Claim 精确引用、主体权限、范围、许可依据、页/字节定位以及可审计拒绝状态的授权读取 API；目前只能依赖已有 Host Workbench 的许可预览字段。内部来源 ID 不足以独立核验论文全文。
2. **知识资格发布**：WP 维护科学审查、知识登记与资格决定；产品只能呈现已存在的 `QualifiedKnowledge` 或 `DerivedKnowledge` 引用，不能把来源表单中的 `SUBMITTED` 当已资格化。
3. **上下文与完整历史**：`ContextDatum/ContextManifest` 的新数据资格与完整 Assessment 历史目录均非本轮产品可生成能力。缺失保持 `UNKNOWN/NOT_REPORTED/UNAVAILABLE`，不造模拟历史。

## UX-02F 验收边界与测试事实

工程自动化：Node 24、Chromium 真实 Host 合成场景，检查同一来源在知识页/评估页/报告里的精确主张、各来源引用、资格决定和限制不变；测试没有来源、无阈值、无原文预览、UNKNOWN/NOT_REPORTED/UNAVAILABLE/0 区别、静态 ESM 加载、换行和安全转义，以及原始对象引用的 JSON 快照在呈现前后不变。浏览器截图由 GitHub Actions `adr-product-browser-evidence` artifact 保留，报告具体 run、commit、SHA 后才能称工程验收完成。

**人工失败案例**（不能改写）：原始反馈「这也看不懂啊。」。
固定复测问题（不透露点击路线和答案）：

> 请用户从农艺知识页面说明这条知识主张什么、证据来自哪里、适用于什么条件，以及是否能用于真实农业决策。

独立记录 `participant_code`、产品精确 HEAD、是否独立完成、答案原话、来源/条件/权利/安全误解、操作错误与任务耗时，并请农艺专业复核员核对解释是否超出来源。**当前没有修复后真实人工复测回执；不得标记 `KNOWLEDGE_READING_UX_ACCEPTED`。**

复测本项成功后，再执行 Issue #233 的五名独立农业用户任务。不以内部 CI 取代农业从业者的独立观察，也不升级 M2 或商业证明。

### 已有固定合成原句的字面中文阅读辅助

唯一允许的固定中文直译通过原始完整字符串严格匹配：`Maintain irrigation depletion within the qualified threshold.`。该直译只说明原句说到在其所指的合格阈值范围内维持灌溉相关亏缺，**不提供数值阈值，也不发出作业指令**。任意字符、语义或数据变化均停止匹配并保留原始英文及「暂无经核对中文阅读辅助」，不能将此固定词条套到新研究或 DerivedKnowledge 上。读者仍必须核对来源、条件和原文授权，产品不能代替科学复核员进行新增翻译资格发布。

作物 `maize` 与土壤质地 `silt loam` 的中文只是词汇标签（玉米、粉砂壤土），原始英文和值仍显示在界面与原始 JSON 中，不能改写研究范围。
