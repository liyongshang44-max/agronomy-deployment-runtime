# Agronomy Deployment Runtime — Capability Map v0.1（中文版）

状态：**PLANNING DERIVATION / 非架构 Authority**  
语言：中文（zh-CN）  
派生基线：`main @ 4852912699741e9491f4e92611251b561108488e`  
架构基线：**Agronomy Deployment Runtime Architecture v1.0 FROZEN**

本文件把冻结的 Architecture v1.0 转换成可实现、可验收、可排序的产品能力图。它不新增领域对象，不修改 authority 边界，不定义 MVP，也不替代 Architecture v1.0。

若本文件与 Architecture v1.0 authority set 发生冲突，以 Architecture v1.0 及其 Final Adjudication 为准。

---

## 1. Capability Map 的定义

这里的 `Capability` 不是 package、service、API endpoint 或数据库表，而是：

> **ADR 必须能够稳定、可审计地完成的一项端到端行为，并能通过正向验收和禁止性验收证明。**

因此：

```text
Capability ≠ Component
Capability ≠ Package
Capability ≠ Task
Capability ≠ Version
```

一个 Capability 可以横跨多个组件；一个组件也可以支撑多个 Capability。

每个 Capability 统一记录：

1. **目的**：它解决什么产品问题；
2. **涉及 Authority**：它消费/产生哪些冻结对象；
3. **前置能力**：必须先成立什么；
4. **正向验收**：什么结果证明能力成立；
5. **禁止性验收**：哪些结果即使“能跑”也必须判失败；
6. **商业/产品含义**：它在客户价值链中承担什么作用。

---

# 2. 总体 Capability Graph

```text
                         ┌──────────────────────┐
                         │ C00 独立产品宪法执行 │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼───────────────────┐
                 ▼                  ▼                   ▼
        C01 身份/不可变/审计   C02 IAM/IP        C03 语义契约基础
                 │                  │                   │
                 └────────────┬─────┴────────────┬──────┘
                              │                  │
                              ▼                  ▼
                     KNOWLEDGE CONTROL       TARGET CONTEXT
                              │                  │
                 C04 Source/Artifact       C07 Context 接入
                              │                  │
                 C05 Scientific Compile    C08 ContextManifest
                              │                  │
                 C06 Qualification/Release      │
                              │                  │
                              └────────┬─────────┘
                                       ▼
                              C09 Knowledge Retrieval
                                       │
                                       ▼
                              C10 Applicability/Transport
                                       │
                    ┌──────────────────┼───────────────────┐
                    ▼                  ▼                   ▼
             C11 Spec Registries  C12 Conformance     C13 Calibration
                    │                  │                   │
                    └────────────┬─────┴────────────┬──────┘
                                 ▼                  │
                         C14 RuntimeProfile/Deployment
                                 │                  │
                                 ▼                  │
                         C15 DecisionProblem        │
                                 │                  │
                                 ▼                  │
                         C16 RuntimePlan DAG ◄──────┘
                                 │
                                 ▼
                         C17 Information Planner
                                 │
                                 ▼
                         C18 RuntimeEligibility
                                 │
                                 ▼
                         C19 RuntimeBinding
                                 │
                                 ▼
                         C20 Runtime Execution
                                 │
                                 ▼
                         C21 AlternativeSet/Robustness
                                 │
                                 ▼
                         C22 DecisionResult
                                 │
                                 ▼
                         C23 Outcome/Evaluation
```

横切所有能力：

```text
C24 Public API / SDK / Adapter Integration
C25 Agronomist Workbench
C26 Enterprise Operations / Observability / Security Operations
```

注意：上图表示主要 authority/dependency 方向，不表示唯一实现顺序。

---

# 3. Foundation Capabilities

## C00 — Standalone Independence / Repo Constitution Enforcement

### 目的

确保 ADR 从实现第一天起就是独立产品，而不是 GEOX 或任何客户平台的隐式子模块。

### 涉及 Authority

- Repository Constitution；
- DEC-0001 Independent Product Boundary；
- public ADR contracts。

### 前置能力

无。它是所有实现工作的根前置。

### 正向验收

必须能够自动证明：

```text
ADR core 无 @geox/* 依赖
ADR core 无 GEOX schema/table 依赖
ADR core 无 MCFT/CAP/KBS/T3R1 语义依赖
core package 不 import adapters/*
删除 adapters/geox 后 core build/test 仍通过
GEOX repository 不可用时 standalone acceptance 仍通过
```

### 禁止性验收

以下任一情况必须失败：

- 为了方便实现，把 GEOX 类型直接作为 core domain type；
- adapter 中的判断成为 scientific/applicability authority；
- core service 直接调用特定 farm platform URL；
- 用 GEOX 的运行事实证明 ADR 自身 contract 正确。

### 商业/产品含义

这是 ADR 能被独立销售、独立部署、独立定价和接入第三方客户系统的基础。

---

## C01 — Canonical Identity / Immutability / Lineage / Replay / Audit

### 目的

让每一个 authority-bearing object 都能被稳定识别、版本化、哈希、追溯和重放。

### 涉及 Authority

覆盖全部 authority-bearing objects，尤其：

- Source / SourceArtifact；
- Claim / QualifiedKnowledge / DerivedKnowledge；
- KnowledgeRelease；
- Transformation / Model / Policy；
- ImplementationConformance / CalibrationArtifact；
- RuntimeProfile / Deployment；
- ContextManifest；
- ApplicabilityAssessment；
- RuntimeBinding / RuntimeAlternativeSet；
- DecisionResult；
- OutcomeEvaluation / EffectAttributionAssessment。

### 前置能力

- C00。

### 正向验收

- 核心对象具有 `logical_id + version + semantic_hash`；
- authority semantics 改变只能创建新版本；
- 历史 RuntimeBinding 永远解析到原始 exact versions；
- 同一 canonical object 在不同进程/数据库实例中可得到一致 semantic hash；
- lineage 可以回答 `ASSERTED_BY / COMPILED_FROM / DERIVED_FROM / QUALIFIED_BY / BOUND_BY / EXECUTED_BY / SUPERSEDES / REVOKES` 等关键关系；
- replay class 真实反映可重放能力。

### 禁止性验收

- `UPDATE` 原地改变已发布 authority semantics；
- 使用数据库 UUID 代替 semantic identity；
- provider-dependent 内容宣称 `EXACT` replay；
- 历史绑定自动追随“最新版本”。

### 商业/产品含义

这是企业审计、客户信任、知识 IP 治理和历史解释能力的底座。

---

## C02 — IAM / Multi-Tenancy / Knowledge IP / Entitlement

### 目的

允许多个农业组织在同一平台安全管理 proprietary agronomy，并确保知识读取、资格化、发布和部署都受授权约束。

### 涉及 Authority

- Organization / Tenant / Workspace / Program；
- User / ServiceAccount / Role / ResourceScope；
- ownership；
- visibility_policy；
- qualification_scope；
- deployment_scope；
- Deployment entitlements。

### 前置能力

- C00；
- C01。

### 正向验收

- Tenant A private knowledge 无法被 Tenant B retrieval 命中；
- knowledge owner 与 runtime tenant 可以不同；
- visibility 权限与 deployment 权限可以独立配置；
- Compiler identity 无 `QUALIFY` 和 `DEPLOY_PRODUCTION` 权限；
- service account 只能访问明确授权 scope；
- cross-organization program 能通过显式 entitlement 合法共享指定知识，而不扩大 visibility。

### 禁止性验收

- 只在 UI 层过滤 private knowledge；
- runtime tenant 自动获得 knowledge ownership；
- PUBLIC/PRIVATE 单字段承担所有授权语义；
- customer proprietary knowledge 无授权进入其他 tenant retrieval/index/training/inference path。

### 商业/产品含义

这是 seed company、咨询公司、retailer 等企业愿意把核心 Agronomy IP 放进 ADR 的前提。

---

## C03 — Public Semantic / Agronomic Context Contract

### 目的

用 ADR 自己的平台中立语义描述 Context 和 Runtime 数据，使外部系统无需采用 ADR 数据库结构。

### 涉及 Authority

- ContextDatum；
- RuntimeDatum semantic envelope；
- semantic_id registry；
- EpistemicClass；
- ProvenanceClass；
- spatial / vertical / temporal support；
- uncertainty；
- canonical units/value forms。

### 前置能力

- C00；
- C01。

### 正向验收

同一个字段状态可以分别表达：

```text
10 cm VWC observation
root-zone storage state estimate
grower planting-date assertion
planter planting observation
72 h weather forecast
model prior parameter
```

并保留它们不同的 epistemic、time、space、depth、uncertainty 和 provenance semantics。

### 禁止性验收

- `{soil_moisture: 32}` 这类失去语义支持范围的裸值进入 decision-critical path；
- provenance 自动提升 epistemic class；
- observation 被 adapter 静默转换为 state estimate；
- runtime output 丢失 time/space/uncertainty semantics。

### 商业/产品含义

这是 ADR 能接入 GEOX、FieldX-like、客户数据湖、OEM、第三方模型而不被某一平台锁死的公共语言。

---

# 4. Knowledge Control Capabilities

## C04 — Source Provenance & Exact SourceArtifact Materialization

### 目的

把“逻辑来源”与“实际被编译的 exact bytes/content”分开管理。

### 涉及 Authority

- Source；
- SourceArtifact；
- source version/edition；
- content hash；
- rights/license；
- retention identity；
- supersession lineage。

### 前置能力

- C01；
- C02。

### 正向验收

- 同一 Source 可拥有多个 SourceArtifact materialization；
- CompilerJob 必须绑定 exact `SourceArtifact@content_hash`；
- Claim 可以同时追溯逻辑 Source 与 exact SourceArtifact；
- Source URL 后续变化不改变历史编译来源。

### 禁止性验收

- 直接从 mutable URL 编译但不保留 materialization identity；
- 把 publication identity 与 PDF/HTML bytes 当作同一对象；
- SourceArtifact 内容变化仍保留相同 semantic identity。

### 商业/产品含义

解决企业知识审计最基本的问题：**“这条知识到底是从哪一版材料产生的？”**

---

## C05 — Scientific Compile → Source-Faithful Claim / SourceContext Candidate

### 目的

把文献、协议、技术资料等转成 source-faithful 的结构化候选，而不让 Compiler 获得科学 authority。

### 涉及 Authority

输入：

- SourceArtifact。

输出候选：

- ClaimCandidate；
- SourceContextCandidate；
- extraction provenance；
- source locator / genealogy。

后续正式对象：

- Claim；
- SourceContext。

### 前置能力

- C03；
- C04。

### 正向验收

- 每条 claim 能定位到 exact source artifact location；
- source 未报告的 context dimension 保持 `NOT_REPORTED`；
- Compiler 能区分 parameter、causal effect、association、recommendation、boundary constraint 等不同 claim semantics；
- 人工 reviewer 可以从结构化 claim 反查原文依据。

### 禁止性验收

- LLM 把背景知识补进 SourceContext；
- LLM 把推断写成 source asserted fact；
- Compiler 直接创建 QualifiedKnowledge；
- Compiler 根据“看起来合理”修改 source claim。

### 商业/产品含义

这是低成本导入公司 Agronomy 的效率引擎，但本身不是最终护城河。

---

## C06 — Qualification / Derived Knowledge / Conflict / Knowledge Release

### 目的

把 source-faithful claim 变成明确用途范围内可被 ADR 使用的科学 authority，并形成可冻结发布的 KnowledgeRelease。

### 涉及 Authority

- QualifiedKnowledge；
- qualification decision lineage；
- DerivedKnowledge；
- DerivedKnowledgeContext；
- KnowledgeConflict；
- KnowledgeRelease。

### 前置能力

- C01；
- C02；
- C05。

### 正向验收

必须证明：

- `Claim ≠ QualifiedKnowledge`；
- qualification 明确 allowed/forbidden use、limitations、effect modifiers、scope；
- DerivedKnowledge 保留所有 material source lineage，并拥有独立 DerivedKnowledgeContext；
- 冲突知识不会被 silent average / newest-wins / LLM preference 消掉；
- KnowledgeRelease 只冻结 exact QualifiedKnowledge/DerivedKnowledge versions；
- KnowledgeRelease 不包含 Model / Policy / Implementation / rollout state。

### 禁止性验收

- citation 多就自动 QUALIFIED；
- DerivedKnowledge 假装继承某一个输入 SourceContext；
- 冲突通过 LLM“综合判断”静默消失；
- KnowledgeRelease 被用成 deployment config。

### 商业/产品含义

把客户个人经验、企业 protocol、公开科学知识变成**组织可管理、可发布的 Agronomy 资产**。

---

# 5. Target Context & Applicability Capabilities

## C07 — Context Ingress / Authorized Reference / Resolution Receipt

### 目的

允许客户以内联值或授权引用方式提供现场 Context，同时保留 exact access/replay semantics。

### 涉及 Authority

- ContextDatum；
- AuthorizedContextReference；
- ResolvedContextDatumReceipt；
- ReplayClass。

### 前置能力

- C02；
- C03。

### 正向验收

- `VALUE_INLINE` 与 `AUTHORIZED_REFERENCE` 都可进入 context resolution；
- decision-critical reference 使用前必须 resolve；
- receipt 记录 reference hash、authorization hash、resolved_at、effective/available time、provider response hash、normalized datum hash 和 replay class；
- 同一 reference 后续 provider 内容改变，不会改写历史 receipt。

### 禁止性验收

- 未 resolve 的 decision-critical reference 直接进入 ContextManifest；
- external provider 无历史保证却标记 EXACT；
- adapter 在 reference resolution 时偷偷做 scientific transformation。

### 商业/产品含义

允许大型客户“不把所有原始农田数据复制给 ADR”，降低集成、隐私和数据治理阻力。

---

## C08 — Immutable ContextManifest / Temporal Integrity

### 目的

为一次 runtime compilation 冻结“当时系统真正可见的目标世界”。

### 涉及 Authority

- DecisionProblem reference；
- ContextDatum hashes；
- receipt hashes；
- logical_time；
- evidence_cutoff；
- ContextManifest semantic hash。

### 前置能力

- C01；
- C03；
- C07；
- C15（DecisionProblem identity 可先实现最小契约）。

### 正向验收

- Applicability 只消费 immutable ContextManifest；
- 新 evidence/state 只能创建新 manifest；
- historical manifest 可精确回答当时有哪些值、何时有效、何时可用；
- future data 无法泄漏进 earlier logical time。

### 禁止性验收

- Applicability 直接查询 mutable “current field state”；
- ContextManifest 创建后成员被更新；
- available_at 晚于 cutoff 的 datum 被静默纳入；
- 用 RuntimeDatum 回填并反向证明产生它的同一个 binding。

### 商业/产品含义

这是 explain/replay 的核心，也是让客户敢把 ADR 放进实际决策流程的信任基础。

---

## C09 — Knowledge Retrieval Result

### 目的

从 active KnowledgeRelease 中高召回找出候选知识，同时让 retrieval 本身可重放、可诊断。

### 涉及 Authority

- KnowledgeRelease；
- DecisionProblem；
- RuntimeProfile / Deployment；
- KnowledgeRetrievalResult。

### 前置能力

- C01；
- C02；
- C06；
- C08；
- C14/C15 的最小 profile/deployment/decision scope。

### 正向验收

KnowledgeRetrievalResult 必须冻结：

- exact KnowledgeRelease；
- retrieval engine/version；
- retrieval config/query semantics；
- index/corpus snapshot identity（若有）；
- candidate knowledge refs；
- material filters/limits。

历史诊断可以明确区分：

```text
相关知识从未被 retrieve
≠
retrieve 了，但 Applicability 判断错误
```

### 禁止性验收

- Retrieval 直接宣布 knowledge applicable；
- private knowledge 因索引泄漏进入无权限 tenant candidate set；
- “向量最相似”被当成 scientific authority；
- 无法复现一次历史 candidate set。

### 商业/产品含义

这是知识规模从几十条增长到大 corpus 后仍能可靠运行的必要能力。

---

## C10 — Source→Target Transport / Applicability

### 目的

判断某条 Qualified/Derived Knowledge 在一个 exact ContextManifest 和 DecisionProblem 下能否合法使用。

### 涉及 Authority

输入：

- QualifiedKnowledge 或 DerivedKnowledge；
- KnowledgeOriginContext（SourceContext / DerivedKnowledgeContext）；
- ContextManifest；
- DecisionProblem；
- UsePurpose；
- qualified transformations/calibration constraints。

输出：

- ApplicabilityAssessment。

### 前置能力

- C03；
- C06；
- C08；
- C09。

### 正向验收

至少能够确定：

```text
DIRECTLY_APPLICABLE
APPLICABLE_WITH_GOVERNED_TRANSFORM
CALIBRATION_REQUIRED
BOUNDED_EXTRAPOLATION
UNRESOLVED
CONFLICT
NOT_RELEVANT
```

并保留 condition-level：

```text
MATCH
MISMATCH
UNKNOWN
AMBIGUOUS
TRANSFORMABLE
INVALID
```

同时能给出：required transformations、calibrations、limitations、conflicts、decision relevance、runtime use。

### 禁止性验收

- 把国家/地区名称直接当兼容性 shortcut；
- REQUIRED condition 未知时自动补 prior 并宣称 MATCH；
- 无 qualified transformation 时自行做单位/深度/空间语义推断；
- Applicability 直接输出最终 ACT/WAIT；
- CONFLICT 静默降级成低 confidence MATCH。

### 商业/产品含义

这是 ADR 的核心产品能力：**判断“这套 Agronomy 到底能不能安全用在这里”。**

---

# 6. Runtime Composition Authorities

## C11 — Transformation / Model / Policy Semantic Registries

### 目的

让知识、计算模型和决策逻辑以不同 authority 域独立演化。

### 涉及 Authority

- QualifiedTransformation；
- Model specification；
- Policy specification。

### 前置能力

- C01；
- C02；
- C03。

### 正向验收

- Transformation 声明 input/output semantics、domain、uncertainty consequence、limitations；
- Model 声明 input/output contract、parameter slots、calibration requirements、applicability domain；
- Policy 声明 decision type、action space、required outputs、threshold authority、fallback/abstention/human gate；
- 三者版本可以独立演化。

### 禁止性验收

- Model 内嵌商业 policy；
- Knowledge 直接选择 action；
- Policy fabricate state/evidence；
- specification 因新增 executor 被迫 version bump。

### 商业/产品含义

允许客户 Bring Your Own Model / Policy，而 ADR 仍保持可治理和可移植。

---

## C12 — Implementation Identity & ImplementationConformance

### 目的

把“有一个 executor”与“这个 executor 被证明正确实现某个 specification”分开。

### 涉及 Authority

- Implementation；
- ImplementationConformance。

### 前置能力

- C01；
- C11。

### 正向验收

- 同一 Model 可对应多个独立 Implementation；
- 新增 Implementation 不修改 Model specification；
- RuntimeBinding 同时绑定 exact Specification + Implementation + Conformance；
- conformance 可限定环境、能力和 known limitations。

### 禁止性验收

- endpoint 注册成功即视为 model-qualified；
- executor 输出 schema 相似就自动视为 conformance；
- Runtime 为适配 executor 改写 Model semantics。

### 商业/产品含义

让 GEOX、客户自有模型、HTTP service、WASM、batch runtime 都能成为可替换执行后端，而不污染 ADR 核心语义。

---

## C13 — Calibration Authority

### 目的

给 `CALIBRATION_REQUIRED` 提供合法、可审计的关闭机制，而不是用 undocumented assumption 消掉。

### 涉及 Authority

- CalibrationArtifact；
- CalibrationProposal；
- model/transformation specification；
- calibration evidence/method/scope。

### 前置能力

- C01；
- C03；
- C11；
- C12（若 calibration 需要 executable method）。

### 正向验收

- CalibrationArtifact 明确 specification、parameters/distribution、scope、evidence、method、validity、uncertainty、limitations、review authority；
- `CALIBRATION_REQUIRED` 只有在 applicable qualified artifact 或授权 calibration step 完成后才能解除；
- field-specific calibration 不自动变成 general agronomic knowledge。

### 禁止性验收

- calibration 结果直接写入 DerivedKnowledge；
- runtime assumption 伪装成 calibration；
- evaluation 自动发布新的 CalibrationArtifact。

### 商业/产品含义

允许同一模型跨客户/地区部署时合法 localize，同时阻止“为了能跑而偷偷调参”。

---

## C14 — RuntimeProfile / Deployment Control

### 目的

把“哪些知识/模型/策略组合允许使用”与“在哪里、对谁、以什么 rollout authority 使用”分开。

### 涉及 Authority

- KnowledgeRelease；
- RuntimeProfile；
- Deployment；
- RuntimeEnvironment；
- RolloutStage；
- entitlements。

### 前置能力

- C02；
- C06；
- C11；
- C12；
- C13（当 profile 要求 calibration）。

### 正向验收

- RuntimeProfile 只描述 reusable composition constraints；
- Deployment 应用 profile 到具体 scope；
- `runtime_environment` 与 `rollout_stage` 正交；
- SHADOW/PILOT/PRODUCTION 不改变 scientific qualification；
- 同一 KnowledgeRelease 可用于多个不同 RuntimeProfile。

### 禁止性验收

- KnowledgeRelease 包含 rollout；
- `QUALIFIED` 自动意味着 `PRODUCTION`；
- `environment: PILOT` 这类混淆；
- Deployment 修改历史 RuntimeBinding。

### 商业/产品含义

让企业可以安全做 sandbox → shadow → pilot → production rollout，而不会“一点 QUALIFIED 就影响所有客户”。

---

# 7. Deployment Runtime Capabilities

## C15 — DecisionProblem Authority

### 目的

明确 ADR 此刻到底在解决什么问题，而不是对一个 field 做无边界“智能分析”。

### 涉及 Authority

- DecisionProblem；
- target scope；
- logical time；
- horizon；
- objective；
- action space；
- constraints；
- use class；
- decision authority mode；
- deadline。

### 前置能力

- C01；
- C02；
- C03。

### 正向验收

同一 field 可以同时存在不同 DecisionProblem，例如：

```text
IRRIGATION_TIMING
IRRIGATION_AMOUNT
NITROGEN_TIMING
DISEASE_SCOUTING
```

每个问题拥有独立 action space 和 authority mode。

### 禁止性验收

- 无 DecisionProblem 就开始 Runtime Compile；
- action space 由模型输出临时发明；
- `RUNTIME_ONLY` 模式仍产生 ADR DecisionResult。

### 商业/产品含义

把“农业 AI”收敛成可计量、可治理的工作单元。

---

## C16 — RuntimeCandidates / Runtime Compiler / RuntimePlan DAG

### 目的

把已检索知识、Applicability、Model/Policy/Transformation/Implementation constraints 编译成解决一个 DecisionProblem 的合法执行图。

### 涉及 Authority

- RuntimeCandidates；
- RuntimePlan；
- RuntimeProfile / Deployment；
- KnowledgeRetrievalResult；
- ApplicabilityAssessment；
- spec/conformance/calibration refs。

### 前置能力

- C09；
- C10；
- C11；
- C12；
- C13；
- C14；
- C15。

### 正向验收

- RuntimePlan 是 DAG；
- 每个 node 声明 inputs/outputs/dependencies/authority refs/implementation capability/open requirements；
- compiler 对相同 authority inputs + compiler version 产生 deterministic plan semantics；
- plan 可以包含多个 legal branches 和 unresolved requirements；
- plan 与 binding 明确分离。

### 禁止性验收

- RuntimePlan 被当成已执行事实；
- plan 中存在 current-binding epistemic cycle；
- compiler 为了得到可执行图自行发明缺失 evidence；
- unresolved candidate 被直接封成 RuntimeBinding。

### 商业/产品含义

这是“Runtime Compile”的核心：把可用 Agronomy 转成针对当前现场问题的具体可执行求解图。

---

## C17 — Information Requirement Planning

### 目的

在信息不足时，不简单报错，而是明确“缺什么、为什么缺、什么形式的数据可以满足、是否真的会改变决策”。

### 涉及 Authority

- InformationRequirement；
- required semantic dimension；
- acceptable epistemic/provenance classes；
- resolution requirements；
- deadline；
- decision materiality；
- acquisition options（非 authority）。

### 前置能力

- C03；
- C10；
- C16。

### 正向验收

- requirement 能追溯到具体 Knowledge/Model/Policy/Applicability node；
- 能区分 `OPEN / SATISFIED / UNSATISFIABLE / NO_LONGER_DECISION_MATERIAL`；
- acquisition option 可以比较现有系统、用户询问、scouting、lab、sensor 等 cost/latency/quality；
- 新信息若不再改变决策，可关闭为 `NO_LONGER_DECISION_MATERIAL`。

### 禁止性验收

- MISSING 一律阻塞；
- 为了减少 ASK 而自行填默认值；
- Information Planner 自己生成 observation；
- 用 universal confidence score 代替 decision materiality。

### 商业/产品含义

这是直接降低 agronomist workload 和现场数据获取成本的关键能力。

---

## C18 — RuntimeEligibility

### 目的

判断当前是否至少存在一个合法 runtime world，而不把“能运行”误写成“应该采取某行动”。

### 涉及 Authority

- RuntimeEligibility；
- RuntimePlan；
- InformationRequirements；
- Profile/Deployment constraints。

### 前置能力

- C16；
- C17。

### 正向验收

冻结状态：

```text
RUNTIME_ELIGIBLE
RUNTIME_ELIGIBLE_WITH_LIMITATIONS
INFORMATION_REQUIRED
NO_LEGAL_RUNTIME
```

并给出 structured reason codes，例如：

```text
KNOWLEDGE_CONFLICT
NO_COMPATIBLE_MODEL
NO_COMPATIBLE_POLICY
UNAUTHORIZED_KNOWLEDGE
UNRESOLVABLE_SEMANTICS
PROHIBITED_TRANSFORM
DEPENDENCY_CYCLE
REPLAY_REQUIREMENT_UNSATISFIED
```

### 禁止性验收

- `RUNTIME_ELIGIBLE` 自动等于 `ACT`；
- 为通过 eligibility 静默忽略 conflict；
- 不满足 replay requirement 仍建立 binding。

### 商业/产品含义

让 ADR 能安全说“当前没有合法方案”，这是企业可信度而不是功能缺失。

---

## C19 — Immutable RuntimeBinding

### 目的

冻结一个 DecisionProblem 实际采用的 exact computational world，成为 replay/composition authority。

### 涉及 Authority

RuntimeBinding 必须精确绑定：

- DecisionProblem；
- Deployment；
- RuntimeProfile；
- KnowledgeRelease；
- ContextManifest；
- exact Knowledge；
- Transformations；
- Models；
- Policies；
- Implementations；
- ImplementationConformance；
- CalibrationArtifact（若 material）；
- logical time / cutoffs；
- assumptions / limitations；
- semantic hash。

### 前置能力

- C18；
- C01。

### 正向验收

- Binding 无 unresolved alternatives；
- exact refs 可以完整 reconstruct historical computational world；
- 新知识、新模型、新 context 不改变历史 binding；
- binding 能证明“当时用了什么”，但不会宣称“当时一定科学正确”。

### 禁止性验收

- pointer 指向 latest；
- open RuntimePlan 直接视为 binding；
- current output 反向授权 current binding；
- RuntimeBinding 被当成 correctness proof。

### 商业/产品含义

这是客户 audit、incident review、model governance 和 enterprise liability control 的核心对象。

---

## C20 — Runtime Execution / Implementation Broker / RuntimeDatum

### 目的

在不改变 specification semantics 的前提下执行 internal/external runtime nodes，并保留完整输出语义。

### 涉及 Authority

- RuntimeBinding；
- Implementation；
- ImplementationConformance；
- RuntimeResult；
- RuntimeDatum。

### 前置能力

- C12；
- C19；
- C03。

### 正向验收

- broker 可执行 INTERNAL / HTTP / CUSTOMER / GEOX / WASM / BATCH 等 registered implementations；
- RuntimeResult 绑定 exact input hashes；
- RuntimeDatum 保留 semantic_id、value/unit、epistemic、provenance、effective/forecast time、space/depth、uncertainty、binding/node/implementation lineage；
- RuntimeDatum 只能在未来通过正常 context resolution 成为后续输入。

### 禁止性验收

- 为匹配 executor 而改变 Model semantics；
- 输出退化成裸 `value + unit`；
- current-binding output 参与 current-binding legality 证明；
- external executor 没有 conformance 仍进入 production binding。

### 商业/产品含义

把 ADR 从“规则审计工具”变成可真正编排客户模型和决策逻辑的 runtime。

---

## C21 — RuntimeAlternativeSet / Decision Robustness

### 目的

证明“在剩余合法不确定世界中，决策是否稳定”，而不是只比较碰巧执行的几个 scenario。

### 涉及 Authority

- RuntimeAlternativeSet；
- RuntimeBindings；
- material uncertainty/conflict dimensions；
- completeness/coverage class；
- DecisionRobustness；
- MaterialActionSignature。

### 前置能力

- C19；
- C20；
- C17。

### 正向验收

RuntimeAlternativeSet 必须冻结：

- included legal worlds；
- excluded candidates + governed reasons；
- generation method/compiler version；
- material uncertainty dimensions；
- coverage semantics；
- completeness class。

冻结 completeness：

```text
EXHAUSTIVE_ENUMERATION
BOUNDED_ENVELOPE
GOVERNED_COVERAGE
INCOMPLETE
```

只有满足 active profile/policy robustness requirement 的 coverage 才可返回 `ROBUST`。

### 禁止性验收

- 跑了 RB1/RB2 且都 WAIT 就宣称 ROBUST；
- INCOMPLETE coverage 返回 ROBUST；
- 只比较 ACT/WAIT 标签，不比较 structured action amount/timing/constraints；
- scientific conflict 被 robustness engine 偷偷裁决。

### 商业/产品含义

这是 ADR 与普通 rule matching / recommendation engine 拉开差距的核心能力之一：**只在剩余不确定性不会改变实质动作时自动放行。**

---

## C22 — DecisionResult / ACT-WAIT-ASK-ABSTAIN

### 目的

在 ADR 拥有合法 decision authority 时，产生完整、结构化、不可变的最终 decision authority object。

### 涉及 Authority

- DecisionDisposition；
- DecisionResult；
- Policy result；
- DecisionRobustness；
- RuntimeAlternativeSet；
- RuntimeBinding refs；
- InformationRequirement；
- structured action semantics。

### 前置能力

- C15；
- C21。

### 正向验收

- `ACT / WAIT / ASK / ABSTAIN` 仅作为 disposition；
- ACT 保留 action amount/timing/constraints；
- WAIT 保留下次评估条件；
- ASK 指向 decision-material InformationRequirement；
- ABSTAIN 保留 governed reason；
- `IRRIGATE 10 mm` 与 `IRRIGATE 30 mm` 不会因为都属于 ACT 而被视为相同 decision。

### 禁止性验收

- `RUNTIME_ONLY` 模式生成 DecisionResult；
- ACT 没有 structured action contract；
- SENSITIVE robustness 仍输出确定性 ACT；
- ASK 不说明需要什么信息。

### 商业/产品含义

这是 ADR 从“适用性平台”进入真正 decision runtime 的分界线。

---

# 8. Evaluation Capability

## C23 — Outcome / OutcomeEvaluation / Effect Attribution / Revision Proposals

### 目的

把执行后现实反馈接回 ADR，但禁止 outcome 直接改写科学或 runtime authority。

### 涉及 Authority

- Outcome；
- OutcomeEvaluation；
- EffectAttributionAssessment；
- CalibrationProposal；
- KnowledgeRequalificationProposal；
- TransformationRevisionProposal；
- ModelRevisionProposal；
- PolicyRevisionProposal。

### 前置能力

- C19；
- C22（若有 decision）；
- C03。

### 正向验收

OutcomeEvaluation 明确区分：

```text
Knowledge Evaluation
Transport Evaluation
Model Evaluation
Policy Evaluation
Execution Evaluation
Commercial Evaluation
```

任何 causal/effect claim 必须包含：

- evaluation design；
- counterfactual basis；
- attribution class；
- known confounders；
- attribution limitations。

### 禁止性验收

- yield 上升 ⇒ 自动证明 ADR 有因果效果；
- yield 下降 ⇒ 自动判 Knowledge 错；
- OutcomeEvaluation 直接发布 QualifiedKnowledge/Calibration/Model/Policy 新版本；
- descriptive association 伪装成 causal effect。

### 商业/产品含义

这是长期形成 `SourceContext → TargetContext → Runtime → Outcome` 复利资产的基础，也是未来 agronomic effectiveness 证明的入口。

---

# 9. Cross-Cutting Product Capabilities

## C24 — Public API / SDK / Adapter Integration

### 目的

把 ADR 的 authority chain 暴露成稳定、可集成的产品接口，而不是一个黑盒 `/recommend`。

### 涉及 Authority

覆盖 public resource model，至少包括：

- sources / compiler / claims / qualifications；
- knowledge releases；
- runtime profiles / deployments；
- decision problems；
- context data / references / manifests；
- runtime plans / information requirements / bindings / results；
- robustness / decisions；
- outcomes / evaluations。

Integration roles：

- ContextProvider；
- StateProvider；
- ForecastProvider；
- ModelExecutor；
- PolicyExecutor；
- EvidenceAcquisitionProvider；
- OutcomeProvider；
- ResultSink / RecommendationSink。

### 前置能力

- C03；
- C02；
- 对应被暴露的 domain capability。

### 正向验收

- GEOX adapter 删除不影响 core；
- generic REST/client 可在不知道 ADR DB schema 的情况下完成集成；
- SDK type 与 OpenAPI/public contract 同源；
- API 不允许外部客户端绕过 authority chain 直接改 RuntimePlan DAG 或 RuntimeBinding。

### 禁止性验收

- adapter 获得 scientific/transport authority；
- customer-specific field name 进入 core semantic ID；
- `/recommend` 成为绕过 ContextManifest/Applicability/Binding 的 shortcut。

### 商业/产品含义

决定 ADR 能否作为 embedded infrastructure 被 consultant software、seed company、GEOX 等真正采购和部署。

---

## C25 — Agronomist Workbench / Escalation Operations

### 目的

把 ADR 的自动 adjudication 转成真正降低 agronomist workload 的专业工作界面，而不是只提供 API。

### 涉及 Authority

Workbench 不新建科学 authority 类型，只操作现有 workflow：

- Source/Claim review；
- Qualification；
- Conflict queue；
- Applicability inspection；
- Deployment management；
- InformationRequirement / field escalation；
- Decision review；
- Outcome review。

### 前置能力

最小商业形态依赖：

- C02；
- C06；
- C08；
- C09；
- C10；
- C17；
- C24。

完整形态进一步依赖 C16–C23。

### 正向验收

Workbench 能形成类似：

```text
今日评估田块：32,140
无需人工审查：29,820
观察：1,860
需要 Agronomist：318
缺现场证据：91
知识冲突：51
```

并允许专业人员从任何 escalation 打开完整 Why chain。

### 禁止性验收

- UI 直接修改 immutable authority object；
- reviewer override 不留 authority/audit trail；
- “无需人工审查”只是隐藏错误，而不是通过明确 applicability/robustness gate；
- Compiler UI 可以直接 QUALIFY/PRODUCTION deploy。

### 商业/产品含义

这是第一类最直接的 B2B 产品价值：提高 `acres/agronomist`、降低 `minutes/field`、减少 routine review。

---

## C26 — Enterprise Operations / Observability / Security Operations

### 目的

让 ADR 作为独立 SaaS/enterprise product 在生产环境可运营，而不仅是 domain engine。

### 涉及范围

这是一组产品运行能力，不新增科学 authority：

- service health；
- queue/job observability；
- tenant-aware metrics；
- latency/SLO；
- audit export；
- security event logging；
- secret/connection management；
- data retention；
- backup/restore；
- deployment/rollback；
- rate limiting/quota；
- incident replay；
- cost attribution。

### 前置能力

- C00；
- C01；
- C02；
- C24；
- 具体 runtime capabilities。

### 正向验收

- production incident 能定位到 tenant / deployment / decision problem / runtime binding；
- secret 与 customer data scope 隔离；
- rollback 不改写历史 authority；
- observability 能区分 provider failure、context failure、applicability conflict、runtime execution failure、policy/decision abstention；
- enterprise audit 可导出完整 authority chain。

### 禁止性验收

- operational retry 造成重复 authority object 而无幂等语义；
- rollback 删除历史 binding；
- cross-tenant logs 暴露 proprietary knowledge；
- monitoring 把 `ABSTAIN` 当作 generic system error。

### 商业/产品含义

这是从 pilot 走向 enterprise production contract 的必要能力。

---

# 10. Capability Dependency Matrix

`→` 表示主要直接前置，不列出所有横切依赖。

| Capability | 名称 | 主要前置 |
|---|---|---|
| C00 | 独立产品宪法执行 | 无 |
| C01 | Canonical Identity / Immutability / Replay / Audit | C00 |
| C02 | IAM / Tenant / IP | C00, C01 |
| C03 | Public Semantic / Context Contract | C00, C01 |
| C04 | Source / SourceArtifact | C01, C02 |
| C05 | Scientific Compile / Claim / SourceContext | C03, C04 |
| C06 | Qualification / Derived / Conflict / Release | C02, C05 |
| C07 | Context Ingress / Reference Resolution | C02, C03 |
| C08 | ContextManifest | C01, C03, C07, C15-min |
| C09 | Knowledge Retrieval | C02, C06, C08, C14-min, C15 |
| C10 | Applicability / Transport | C03, C06, C08, C09 |
| C11 | Transformation / Model / Policy Specs | C01, C02, C03 |
| C12 | Implementation / Conformance | C01, C11 |
| C13 | Calibration | C03, C11, C12 as needed |
| C14 | RuntimeProfile / Deployment | C02, C06, C11, C12, C13 as needed |
| C15 | DecisionProblem | C01, C02, C03 |
| C16 | RuntimeCandidates / RuntimePlan DAG | C09, C10, C11, C12, C13, C14, C15 |
| C17 | Information Planner | C03, C10, C16 |
| C18 | RuntimeEligibility | C16, C17 |
| C19 | RuntimeBinding | C01, C18 |
| C20 | Runtime Execution / RuntimeDatum | C03, C12, C19 |
| C21 | RuntimeAlternativeSet / Robustness | C17, C19, C20 |
| C22 | DecisionResult | C15, C21 |
| C23 | Outcome / Evaluation / Effect Attribution | C03, C19, C22 when applicable |
| C24 | Public API / SDK / Adapters | C02, C03 + exposed capability |
| C25 | Agronomist Workbench | C02, C06, C08, C09, C10, C17, C24；完整形态追加 C16–C23 |
| C26 | Enterprise Operations | C00, C01, C02, C24 + production runtime |

---

# 11. 三条关键 Critical Path

## 11.1 Knowledge Authority Path

```text
C00
→ C01/C02/C03
→ C04
→ C05
→ C06
```

证明：

> 一份客户 Agronomy 可以被 exact materialize、编译、人工资格化、形成受权限治理的 KnowledgeRelease。

这条链没有 Target Field，也不声称知识在某块田适用。

---

## 11.2 Applicability / Agronomist Escalation Path

```text
Knowledge Authority Path
+
C07 → C08
+
C14-min → C15
→ C09
→ C10
→ C16-min
→ C17
→ C25
```

证明：

> 对大量 field/context，ADR 能自动判断哪些知识可直接使用、哪些需要 transform/calibration、哪些缺信息、哪些 conflict，并只把 decision-material 问题升级给 Agronomist。

这条链是最早可能形成独立商业价值的路径；它不需要先实现完整 ACT recommendation。

---

## 11.3 Full Decision Runtime Path

```text
Applicability Path
+
C11 → C12 → C13
→ C14
→ C16
→ C18
→ C19
→ C20
→ C21
→ C22
```

证明：

> ADR 能构建一个合法、可 replay 的 runtime world，执行模型/策略，在完整 legal alternative coverage 下判断实质 action 是否稳定，并在 authority mode 允许时给出结构化 DecisionResult。

---

# 12. Evaluation / Learning Path

```text
C19/C22
→ external execution
→ Outcome
→ C23
→ proposal
→ Control Plane review
→ new authority version if approved
```

永久禁止：

```text
Outcome
→ direct Knowledge mutation

Runtime output
→ authorize the RuntimeBinding that produced it

Correlation
→ CausalEffect
```

---

# 13. 商业价值 Gate（仅映射，不是 Version Slicing）

Capability Map 允许识别几个自然的价值门，但本文件不把它们冻结成版本号。

## Gate A — Knowledge Authority Proof

需要：C00–C06。

客户可获得：

> “我的 Agronomy 已经从文档/协议变成受治理、可发布、可追溯的企业知识资产。”

不足：还不能说明它适用于某块田。

---

## Gate B — Applicability Proof

需要：Gate A + C07–C10 + C14-min + C15。

客户可获得：

> “对这块田/这个时间/这个问题，这条 Agronomy 是 DIRECT、需要 TRANSFORM/CALIBRATION、UNKNOWN、CONFLICT 还是不相关。”

这是 ADR 核心产品命题第一次真正成立。

---

## Gate C — Agronomist Productivity Proof

需要：Gate B + C16-min + C17 + C24 + C25。

核心 KPI 可包括：

```text
manual review rate
minutes / field
fields / agronomist / day
acres / agronomist
escalation precision
false-safe rate
knowledge-conflict resolution time
```

如果这组指标没有明显改善，即使架构正确，也不能证明第一条商业 wedge 成立。

---

## Gate D — Decision Runtime Proof

需要：C11–C22 完整闭合。

客户可获得：

> “ADR 不仅知道知识是否适用，而且能在合法模型/策略/实现和不确定世界下形成受治理 DecisionResult。”

---

## Gate E — Outcome / Effect Proof

需要：C23。

证明对象必须分开：

```text
replayability
runtime correctness
agronomic effectiveness
causal effect
commercial outcome
```

其中真实 agronomic/commercial effect 仍需要现实 decision→execution→outcome evidence，不能由架构验收替代。

---

## Gate F — Enterprise Production Readiness

需要：C24–C26 与目标生产 slice 所需 core capabilities。

证明：

> 多租户、IP、安全、部署、审计、SLO、incident replay、客户集成能够支撑真实 enterprise contract。

---

# 14. Capability Map 的实现原则

后续 Master Task Line 和 Version Slicing 必须遵守：

1. **Task 从 Capability 派生，不从目录结构派生。**
2. **Version 以闭合用户价值切，不以组件数量切。**
3. **正向验收和禁止性验收同等重要。**
4. **实现方便不能成为修改 Architecture v1.0 authority 的理由。**
5. **若 Capability Map 暴露真正逻辑 contradiction，必须通过新的 `DEC-xxxx` 架构决策处理，不能在实现代码里偷偷修正。**
6. **GEOX 是 reference consumer/adapter，不是 Capability Map 的 required predecessor。**
7. **第一条商业验证优先证明 Agronomist Productivity，而不是追求一次性实现全部 Evaluation Plane。**

---

# 15. 当前 Planning Frontier

在 Architecture v1.0 已冻结的前提下，当前 planning frontier 定义为：

```text
ADR-CAPABILITY-MAP-01

Architecture v1.0
        ↓
Capability Map
        ↓
Dependency Graph
        ↓
Master Task Line
        ↓
Technical / Commercial Gates
        ↓
Version Slicing
```

本文件完成的是第一步：**把完整目标架构转换成 capability-level implementation map。**

下一份文档应基于本 Capability Map 生成 Master Task Line，并明确每条任务线关闭哪些 Capability/Acceptance，而不是重新讨论产品架构。
