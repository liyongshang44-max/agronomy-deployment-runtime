# Agronomy Deployment Runtime — Version Slicing 01（中文版）

Status: **PLANNING CANDIDATE / NON-ARCHITECTURE-AUTHORITY**

Repository baseline: `main @ 1276381da7d1d127ac19787abee45d9351393a47`

Architecture authority baseline: `4852912699741e9491f4e92611251b561108488e`

Planning authority:

- `docs/planning/ADR-CAPABILITY-MAP-01.md`
- `docs/planning/ADR-CAPABILITY-MAP-01-FINAL-ADJUDICATION.md`
- `docs/planning/ADR-MASTER-TASK-LINE-01.md`
- `docs/planning/ADR-MASTER-TASK-LINE-01-REVIEW-ADJUDICATION.md`

Frontier: `ADR-VERSION-SLICING-01`

Purpose: 在不重开 Architecture v1.0、不改变 Capability/Task authority 的前提下，把 Master Task Line 切成一组能够逐步证明真实用户价值、技术闭环和商业价值的产品版本。版本按**闭合用户价值和可验证风险**切，不按组件数量、代码量或 Task 数量平均切。

---

# 1. Version Slicing 的最高原则

本文件冻结以下产品规划原则：

```text
Version
=
Closed user value
+ exact capability boundary
+ explicit nonclaims
+ measurable acceptance
```

永久禁止：

```text
一个版本只是“做完几个 package”；
为了赶版本跨过 authority seam；
把未实现 Gate 的能力写进产品 claim；
用 demo fixture 代替 customer-value proof；
用 architecture correctness 代替 willingness-to-pay；
用 commercial success 反向证明 scientific validity。
```

版本关系：

```text
Architecture v1.0
  ↓
Capability Map 01
  ↓
Master Task Line 01
  ↓
Version Slicing 01
  ↓
Implementation / Release PRs
```

Version Slicing 无权修改上游 authority。若版本目标无法在现有 Architecture/Capability/Task 约束下实现，必须先判断是 product choice 还是 architecture contradiction；只有后者才允许提出新的 `DEC-xxxx`。

---

# 2. 版本切分的核心商业假设

ADR 的第一条商业假设不是：

> AI 能否自动给农户更好的 recommendation。

而是：

> 一个拥有 Agronomy 的组织，能否把自己的知识部署到大量 target context，并让 Agronomist 只处理真正需要人判断的少数 case，从而提高专业服务吞吐量、降低 routine review 成本，同时保留 scientific authority、explainability 和 human control。

因此第一个必须尽早验证的商业闭环是：

```text
Company Agronomy
       ↓
Qualified KnowledgeRelease
       ↓
DecisionProblem + ContextManifest
       ↓
Replayable Retrieval
       ↓
Applicability
       ↓
NO_REVIEW_CANDIDATE / REVIEW_REQUIRED-like product flow
       ↓
Agronomist Workbench
```

注意：Gate A 产品 read-model taxonomy 不复用 RuntimeEligibility authority values；`DIRECTLY_APPLICABLE` 也不自动等于 `NO_REVIEW_CANDIDATE`。

---

# 3. 第一个 Reference Domain

为了避免把 ADR 做成抽象平台后再寻找问题，本 Version Slicing 指定一个**产品验证锚点**：

```text
Reference Domain 01:
Maize/Corn Irrigation Agronomy Applicability & Escalation
```

它不是 Architecture authority，也不限制 ADR 长期支持其他 crop/domain。

选择它作为第一验证域的理由：

- agronomic knowledge 有明确 source/target transport 条件；
- crop identity、phenology、soil/water state、weather、irrigation regime/capacity 等 applicability dimensions 足够丰富，可以真正测试 ADR，而不是做 trivial rule matching；
- decision cadence 足以产生重复 review workload；
- result 可以先证明 agronomist workflow value，而不需要立即宣称 yield causal benefit；
- GEOX 可以在后期作为 first-party field-validation substrate，但 Reference Domain 01 的 standalone acceptance 必须先由 non-GEOX reference integration 成立。

第一版本不要求 ADR 自己拥有 soil-water Digital Twin，也不要求执行灌溉。核心问题只是：

> 这条 corn irrigation agronomy 在这个 exact target context / use purpose 下是否可部署、缺什么、是否需要专家介入？

---

# 4. Release Maturity 的两个正交维度

为避免“pilot-grade”被误解为 authority semantics 可以临时做错，版本成熟度拆成两个维度。

## 4.1 Authority-semantic maturity

以下语义从第一次产生真实 authority object 起就必须正确：

```text
identity/version/hash
immutability
lineage
knowledge ownership/visibility/entitlement
source provenance
qualification boundary
SourceContext / TargetContext separation
DecisionProblem identity
ContextManifest temporal freeze
Applicability ≠ RuntimeEligibility ≠ Decision
replay class truthfulness
Evaluation proposal-only boundary
```

这些不允许“先做简版，以后 migration 修正”。历史 authority 一旦产生，就必须可解释。

## 4.2 Operational maturity

以下可以随版本逐步提升：

```text
throughput
horizontal scaling
SLO
HA
backup/restore automation
connector breadth
Workbench polish
job parallelism
index optimization
cost attribution
enterprise deployment options
```

因此：

```text
Pilot operational maturity
≠ relaxed scientific/runtime semantics
```

---

# 5. 版本总览

本次切分为：

```text
v0.1 — Knowledge Authority Preview
v0.2 — Applicability Shadow
v0.3 — Agronomist Pilot            ← first commercial proof
v0.4 — Runtime Legality Preview
v0.5 — Decision Shadow
v0.6 — Evaluation Loop
v1.0 — Enterprise Production
```

这不是承诺固定时间表。任何版本都必须通过前一版本要求的 authority/capability acceptance，但商业 Go/No-Go 可以中止后续投资。

最重要的停机点：

```text
v0.3 commercial proof failure
→ do NOT automatically continue building v0.4/v0.5 just because roadmap exists
```

如果 Agronomist workflow 不产生真实价值，应优先重审 customer/problem/positioning，而不是继续扩大 Runtime feature set。

---

# 6. v0.1 — Knowledge Authority Preview

## 6.1 产品目标

让一个农业组织第一次可以把 exact agronomic source 转成受治理、可追溯、可资格化、可发布的 KnowledgeRelease。

用户得到的核心价值：

> “我的 Agronomy 不再只是 PDF/经验/散落规则，而是一个 exact、versioned、可审计的企业知识资产。”

这是 Control Plane Preview，不是最终商业 wedge。

## 6.2 必须关闭的 Gate / Task

必须关闭：

```text
Gate F
Gate K
```

Task：

```text
MTL-F01
MTL-F02
MTL-F03

MTL-K01
MTL-K02
MTL-K03
MTL-K04
MTL-K05
MTL-K06
```

产品访问面至少需要一个受控的 internal/API/operator path，但不要求 C21 full public SDK。

## 6.3 必须支持的 Reference Domain

至少有一个 corn irrigation source corpus，能够跑通：

```text
Source
→ SourceArtifact
→ compiler candidate
→ Claim + SourceContext
→ Qualification
→ Conflict/Derived handling where applicable
→ KnowledgeRelease
```

Source 可以包含 public agronomic source、客户 protocol fixture 或两者，但 proprietary fixture 必须经过 tenant isolation acceptance。

## 6.4 Positive acceptance

- exact SourceArtifact bytes/hash 可追踪；
- compiler output 可回到 source span；
- source 未报告条件保持 `NOT_REPORTED`；
- human reviewer 能允许某 use、禁止另一 use；
- DerivedKnowledge 有 DerivedKnowledgeContext；
- conflict 不被自动平均/覆盖；
- KnowledgeRelease 不包含 Model/Policy/Implementation/Deployment；
- tenant A private knowledge 不进入 tenant B retrieval/storage view。

## 6.5 Explicit nonclaims

v0.1 **不能宣称**：

```text
knowledge applies to a field
runtime is legal
recommendation is correct
ACT / WAIT
agronomic uplift
causal benefit
```

## 6.6 Release status

```text
Developer / Scientific Preview
```

不建议作为第一付费产品单独销售；它主要为 v0.2/v0.3 提供真实 authority foundation。

---

# 7. v0.2 — Applicability Shadow

## 7.1 产品目标

第一次完整证明 ADR 核心命题：

> 对一个 exact DecisionProblem + exact Target Context，系统可以判断一条 Qualified Agronomy 从 SourceContext/DerivedKnowledgeContext transport 到目标条件后的适用状态，并解释为什么。

v0.2 是 **Shadow**：不进入客户生产 workflow，不减少真实 human review，不影响现有 agronomist recommendation。

## 7.2 必须关闭的 Task

在 v0.1 基础上：

```text
MTL-A01 DecisionProblem
MTL-A02 Context Contract
MTL-A03 AuthorizedReference / Receipt
MTL-A04 ContextManifest
MTL-A05 Minimal RuntimeProfile
MTL-A06 Minimal Deployment
MTL-A07 Replayable Retrieval
MTL-A08 Applicability Core
MTL-A09 only if governed-transform path is claimed
MTL-A10 Escalation Read Model
```

以及 Reference Domain 所需的最小 backend/read surface。

v0.2 不要求 MTL-A11 完整 Agronomist Workbench 可生产使用；可以先有 review inspector/internal shadow console。

## 7.3 Input requirement

至少需要两类 ContextProvider fixture：

```text
1. inline deterministic fixture
2. AuthorizedContextReference fixture with resolution receipt
```

必须证明 provider 更新后旧 ContextManifest 不变。

## 7.4 Applicability dispositions

必须至少覆盖：

```text
DIRECTLY_APPLICABLE
CALIBRATION_REQUIRED
BOUNDED_EXTRAPOLATION
UNRESOLVED
CONFLICT
NOT_RELEVANT
```

若宣称 transformation path，再追加：

```text
APPLICABLE_WITH_GOVERNED_TRANSFORM
```

## 7.5 Shadow dataset design

Shadow acceptance 不能只使用 happy-path synthetic cases。

必须包含：

```text
exact match
missing critical context
known hard conflict
source context not reported
measurement/reference mismatch
soil/depth/support mismatch
management mismatch
calibration-required case
multiple competing knowledge candidates
retrieval miss negative control
provider-dependent replay case
```

## 7.6 Positive acceptance

- Applicability result deterministic/replayable；
- Retrieval miss 与 Applicability reject 可区分；
- adapter 无 scientific authority；
- unknown 不被模型补成 match；
- `DIRECTLY_APPLICABLE` 不直接变成 no-review；
- Gate A product classification 不复用 RuntimeEligibility enum。

## 7.7 Explicit nonclaims

v0.2 不宣称：

```text
customer workflow savings
RUNTIME_ELIGIBLE
ACT / WAIT
recommendation quality
field outcome improvement
```

## 7.8 Release status

```text
Internal / Design-Partner Shadow Preview
```

---

# 8. v0.3 — Agronomist Pilot

## 8.1 产品目标

这是第一个必须证明“能不能挣钱”的版本。

它不是继续证明架构，而是验证：

> ADR 能否在真实或真实等价的客户 workflow 中显著减少 routine agronomist review，同时不把 unknown/conflict/unsafe cases 错误隐藏，并且客户愿意为这种能力继续部署或付费。

v0.3 是第一候选 **paid pilot** 版本。

## 8.2 必须关闭的 Capability/Gate

必须关闭：

```text
Gate A
```

并加入最小商业 Productization：

```text
MTL-A11 Agronomist Workbench Core
MTL-P01 Public API surface required by pilot
MTL-P02 SDK / Generic Integration
MTL-P03 Non-GEOX Reference Integration Acceptance
MTL-P06 pilot-grade async/idempotency/observability
MTL-P07 pilot-grade tenant/security/audit requirements
MTL-P08 only the recovery/SLO subset required by pilot contract
```

v0.3 **不得以 GEOX 作为唯一客户集成证明**。必须先完成 MTL-P03。

MTL-P04 GEOX Adapter 可并行开始，但不能替代 non-GEOX standalone acceptance。

## 8.3 First pilot customer profile

优先目标不是单个 grower，而是具备以下经济结构的组织：

```text
Agronomy is a paid/professional service
serves meaningful acreage / many client fields
has repeatable agronomic protocols
has digital field/context records
has multiple agronomists or a scalable expert network
lacks incentive to distort advice toward product sales, or can explicitly separate commercial policy
can provide real protocols and shadow cases
```

具体 company size、acreage、agronomist count 不在 repository authority 中硬编码。

## 8.4 Pilot workflow

客户当前流程：

```text
all / many fields
→ agronomist manually checks data
→ decides whether a case needs action/attention
```

ADR pilot：

```text
field/context stream
→ DecisionProblem
→ ContextManifest
→ Retrieval
→ Applicability
→ product escalation classification
→ Agronomist Workbench
```

输出不是 recommendation API，而是：

```text
NO_REVIEW_CANDIDATE
AGRONOMIST_REVIEW_REQUIRED
CONTEXT_GAP
KNOWLEDGE_CONFLICT
CALIBRATION_NEEDED
GOVERNED_TRANSFORM_NEEDED
```

最终 UI taxonomy 可以在 pilot contract 中更名，但不得与 RuntimeEligibility authority 混淆。

## 8.5 Commercial metrics

必须记录：

```text
baseline manual review volume
baseline minutes/case
ADR-assisted manual review volume
minutes/case after ADR
cases/agronomist/time
acres/agronomist where meaningful
escalation precision
false-safe rate / missed-review cases
unknown/conflict rate
explanation/review override rate
integration burden
support burden
paid continuation / expansion signal
```

**本文件不硬编码全球统一数值阈值。**

每个 pilot 必须在开始前根据客户 baseline、风险容忍度和经济模型预注册：

```text
success threshold
safety/false-safe ceiling
minimum evidence volume
commercial continuation condition
```

## 8.6 Commercial Go / No-Go

v0.3 结束必须进行独立商业裁决。

### GO 条件

至少需要同时出现：

- measurable routine-review reduction；
- false-safe / missed-review risk 在预注册容忍范围；
- agronomist 愿意持续使用，而不是只在 demo 中觉得“有意思”；
- customer 能明确把价值映射到 labor productivity、service margin、coverage、retention 或 revenue expansion；
- 存在 paid continuation、paid expansion、合同承诺或等价强商业信号。

### NO-GO / REPOSITION 条件

若出现以下组合，不应自动继续 v0.4/v0.5：

- 系统大部分时间只产生无意义 MATCH，没有 decision/review-material value；
- 为保证安全几乎所有 case 仍需 agronomist review；
- false-safe 太高，专家不信任 no-review flow；
- integration/support 成本吞掉 productivity gain；
- customer 不愿为成功 deployment 付费；
- value 只来自“AI 新颖性”，没有 budget owner。

NO-GO 不等于 Architecture v1.0 错误。它意味着产品 wedge、target customer、pricing 或 workflow 假设需要重新裁决。

## 8.7 Explicit nonclaims

即使 v0.3 商业 pilot 成功，也不能宣称：

```text
ADR recommendations increase yield
ADR causes profit uplift
ADR has full Decision Runtime
ADR can autonomously irrigate
```

## 8.8 Release status

```text
Paid Design-Partner Pilot Candidate
```

这是整个路线最重要的商业 checkpoint。

---

# 9. v0.4 — Runtime Legality Preview

## 9.1 产品目标

在 Gate A 已经有商业价值或明确战略理由后，再回答第二个问题：

> 对一个 exact DecisionProblem，除了知识“适用”，是否存在一条在 Knowledge/Context/Transformation/Model/Policy/Implementation/Calibration 约束下真正合法的 runtime path？

## 9.2 必须关闭的 Gate / Task

必须关闭：

```text
Gate R
```

Task：

```text
MTL-S01 as exercised
MTL-S02/S03 if external/internal implementation path is represented
MTL-S04 if calibration path is exercised

MTL-R01 RuntimePlan DAG
MTL-R02 InformationRequirement
MTL-R03 RuntimeEligibility
```

## 9.3 Product surface

Workbench/API 新增：

```text
RuntimePlan Inspector
InformationRequirement Queue
RuntimeEligibility
NO_LEGAL_RUNTIME reasons
```

v0.4 可以让 agronomist/technical operator 知道：

- 缺什么输入；
- 什么 acquisition option 可关闭缺口；
- 为什么当前不存在合法 runtime；
- 哪些 limitations 仍可接受。

## 9.4 Positive acceptance

- DAG 可 replay；
- dependency cycle 被拒绝；
- missing input 不被发明；
- `CALIBRATION_REQUIRED` 只有有效 CalibrationArtifact 才能被满足；
- implementation registration 不等于 conformance；
- RuntimeEligibility 只输出 frozen legal-state values。

## 9.5 Explicit nonclaims

v0.4 不能宣称：

```text
ACT
WAIT
Decision robustness
recommendation effectiveness
```

## 9.6 Release status

```text
Runtime Legality Preview / Advanced Design Partner
```

---

# 10. v0.5 — Decision Shadow

## 10.1 产品目标

第一次建立完整 Decision Runtime，但优先在 `SHADOW/PILOT` rollout 下运行：

```text
RuntimeBinding
→ execution
→ RuntimeDatum
→ RuntimeAlternativeSet
→ DecisionRobustness
→ DecisionResult
```

v0.5 的价值是证明 ADR 不只是规则匹配，而能在多个合法 plausible worlds 下判断 action 是否稳定。

## 10.2 必须关闭的 Gate / Task

必须关闭：

```text
Gate D
```

Task：

```text
MTL-D01
MTL-D02
MTL-D03
MTL-D04
MTL-D05
MTL-D06
```

以及 exercised path 所需 S01/S03/S04。

## 10.3 Decision authority mode

第一阶段默认优先：

```text
RUNTIME_ONLY
or
ADR_POLICY in SHADOW with human review
```

不得为了 demo 强行启用 production ACT authority。

## 10.4 Positive acceptance

- RuntimeBinding exact/replayable；
- executor conformance 被强制；
- RuntimeDatum 保留 epistemic/time/space/uncertainty semantics；
- RuntimeAlternativeSet 有明确 coverage class；
- INCOMPLETE coverage 不能 ROBUST；
- `IRRIGATE 10 mm` 与 `IRRIGATE 30 mm` material action 不等价；
- sensitive worlds 导致 ASK/ABSTAIN，而不是 confidence-number laundering；
- RUNTIME_ONLY 不生成 ADR-owned DecisionResult。

## 10.5 Commercial role

v0.5 不要求立即成为 autonomous product。它可以作为：

```text
Agronomist Decision Shadow
```

与专家实际 decision 并行比较，测量：

```text
agreement rate
decision-material disagreement rate
override reason
action sensitivity drivers
information-request value
```

## 10.6 Explicit nonclaims

- DecisionResult 不等于 human approval；
- DecisionResult 不等于 machine dispatch；
- robust decision 不等于 agronomic truth；
- shadow agreement 不等于 causal effectiveness。

## 10.7 Release status

```text
Decision Shadow / Controlled Pilot
```

---

# 11. v0.6 — Evaluation Loop

## 11.1 产品目标

把 outcome 接回 ADR，形成：

```text
Runtime / Decision
→ Outcome
→ OutcomeEvaluation
→ EffectAttributionAssessment where supported
→ Revision Proposal
→ Control Review
```

核心价值不是“自动学习”，而是：

> 系统可以结构化地区分 Knowledge、Transport、Model、Policy、Execution 和 Commercial performance，并提出下一版 authority 的 review proposal，而不是静默自我修改。

## 11.2 必须关闭的 Gate / Task

完整 v0.6 关闭：

```text
Gate E
```

Task：

```text
MTL-E01 Outcome Ingress
MTL-E02 OutcomeEvaluation
MTL-E03 EffectAttribution capability
MTL-E04 Revision Proposal loop
```

注意：单个 evaluation 可以明确声明“不支持 causal attribution”；但产品宣称完整 Gate E 时，必须具备 E03 能力。

## 11.3 Positive acceptance

- Outcome 保留 epistemic/provenance identity；
- execution failure 不被写成 model error；
- favorable outcome 不自动证明 ADR caused benefit；
- causal claim 必须绑定 evaluation design/counterfactual/confounders/limitations；
- proposal 不能直接变成 Knowledge/Model/Policy/Calibration authority；
- approved change 总是新 version。

## 11.4 Commercial role

v0.6 支持客户回答：

```text
哪些 agronomy 在哪些 context 下表现稳定？
哪里 transport 失效？
哪里 model/policy 应调整？
哪些收益只是 association，哪些有更强 effect evidence？
```

长期 moat 数据链从此开始真正成立：

```text
SourceContext
→ TargetContext
→ Applicability
→ Runtime/Decision
→ Outcome
→ Evaluation
```

## 11.5 Explicit nonclaims

- 一季数据不自动等于 global scientific truth；
- platform 不做 silent online learning authority；
- correlation 不叫 CausalEffect。

## 11.6 Release status

```text
Closed-Loop Evaluation Preview
```

---

# 12. v1.0 — Enterprise Production

## 12.1 产品目标

v1.0 不意味着“实现 Architecture 中所有理论可能性”。

它意味着：

> ADR 已经可以作为独立 enterprise product，对一个明确商业 slice 以 production-grade operations、安全、审计、集成和支持方式交付，并且核心 authority chain 不依赖 GEOX。

## 12.2 必须关闭的 Gate

目标 commercial slice 对应 core gates +：

```text
Gate P
```

至少需要：

```text
MTL-P01 Public API/OpenAPI
MTL-P02 SDK/Generic Integration
MTL-P03 Non-GEOX Reference Acceptance
MTL-P04 GEOX First-Party Adapter
MTL-P05 Full Workbench surfaces required by supported gates
MTL-P06 Async/Idempotency/Observability
MTL-P07 Security/Retention/Audit Export
MTL-P08 Recovery/Rollback/SLO
```

以及 v1.0 宣称支持的 Gate A/R/D/E 对应全部 core Task。

## 12.3 Production boundary

v1.0 必须明确产品实际支持哪些模式：

```text
Applicability-only
Runtime-legality
Decision Shadow
ADR-owned Decision
Evaluation
```

不得因为 v1.0 版本号自动宣称所有模式都生产开放。

例如一个现实 v1.0 可以是：

```text
Applicability + Agronomist Escalation = PRODUCTION
Runtime Legality = PRODUCTION
Decision = SHADOW/PILOT
Evaluation = PRODUCTION descriptive + governed attribution
```

只要产品 claim 与 Deployment rollout status 完全一致。

## 12.4 Enterprise acceptance

- multi-tenant/IP isolation；
- external/public API stable；
- non-GEOX production integration；
- GEOX adapter removable；
- exact audit export；
- retry/idempotency correctness；
- backup/restore preserves hashes/lineage；
- deployment rollback does not rewrite history；
- provider outage vs scientific ineligibility vs ABSTAIN classification；
- secret/connection isolation；
- tenant-aware retention；
- incident replay；
- SLO defined for supported runtime surfaces。

## 12.5 Commercial acceptance

v1.0 commercial readiness 不能只看 engineering gate。

至少需要已经存在：

```text
real organization usage
real knowledge/IP onboarding
real target contexts
measured workflow value
repeat/expansion signal
support/integration cost understanding
price/budget owner evidence
```

## 12.6 Explicit nonclaims

即使 v1.0：

- ADR 仍不是 FMIS；
- ADR 仍不是 weather/sensor/satellite platform；
- ADR DecisionResult 不自动等于 machine control authority；
- ADR 不因为收集 outcomes 就拥有 universal causal truth；
- GEOX 仍只是 first-party consumer/integration/reference validation substrate。

---

# 13. Version → Task Mapping

`✓` 表示该版本必须完成；`C` 表示仅在 claimed/exercised path 下必须；`→` 表示继承前版本。

| Task group | v0.1 | v0.2 | v0.3 | v0.4 | v0.5 | v0.6 | v1.0 |
|---|---:|---:|---:|---:|---:|---:|---:|
| F01–F03 Foundation | ✓ | → | → | → | → | → | ✓ prod |
| K01–K06 Knowledge | ✓ | → | → | → | → | → | ✓ prod |
| A01–A08 Applicability core |  | ✓ | → | → | → | → | ✓ prod |
| A09 Governed transform |  | C | C | C | C | C | C |
| A10 Escalation read model |  | ✓ shadow | ✓ | → | → | → | ✓ prod |
| A11 Workbench core |  | optional inspector | ✓ | → | → | → | ✓ prod |
| S01 Specs |  | C | C | ✓/C | ✓ | → | ✓ supported |
| S02/S03 Impl/Conformance |  |  | C | C | ✓ | → | ✓ supported |
| S04 Calibration |  |  | C | C | C/✓ | → | ✓ supported |
| R01–R03 Runtime legality |  |  |  | ✓ | → | → | ✓ supported |
| D01–D06 Decision runtime |  |  |  |  | ✓ | → | ✓ if claimed |
| E01–E04 Evaluation |  |  |  |  | optional outcome logging | ✓ | ✓ if claimed |
| P01/P02 API/SDK | minimal/internal | minimal | ✓ pilot | → | → | → | ✓ prod |
| P03 Non-GEOX integration |  | shadow optional | ✓ | → | → | → | ✓ prod |
| P04 GEOX adapter |  |  | optional parallel | optional | ✓ reference | → | ✓ supported |
| P05 Full Workbench |  |  | core | runtime surface | decision surface | evaluation surface | ✓ supported |
| P06 Ops | basic CI/jobs | basic | ✓ pilot | → | → | → | ✓ prod |
| P07 Security/retention | tenant core | → | ✓ pilot | → | → | → | ✓ prod |
| P08 Recovery/SLO |  |  | pilot subset | expanded | expanded | expanded | ✓ prod |

这个表不允许把 `optional/C` 解释为“可以违反 authority”；它只代表该版本不声称相关能力时可以不实现该 path。

---

# 14. Version → Gate Mapping

```text
v0.1
  closes Gate F + Gate K

v0.2
  proves Gate A core in Shadow

v0.3
  closes Gate A + commercial pilot productization
  and performs the first economic Go/No-Go

v0.4
  closes Gate R

v0.5
  closes Gate D in Shadow/Controlled mode

v0.6
  closes Gate E

v1.0
  closes Gate P for the supported production slice
```

注意：v0.2 与 v0.3 的区别不是“同功能 UI 更漂亮”。

```text
v0.2 = scientific/runtime applicability proof under shadow conditions
v0.3 = real workflow + real integration + measurable economic proof
```

如果这两个版本不能被真实验收区分，就说明切片设计失败。

---

# 15. Commercial Kill Gate — 必须冻结

为防止工程惯性把公司拖入“架构越来越漂亮但没人付钱”，Version Slicing 正式规定：

> **v0.3 是继续扩大 Runtime/Decision 投资前的商业 Kill Gate。**

除非存在以下之一，否则不得因为 roadmap 自动把 v0.4/v0.5 当作最高优先级：

```text
1. v0.3 paid pilot 达到预注册价值/安全条件；
2. 客户明确愿意为 Gate R/D 能力付费，并能给出预算/合同/扩展条件；
3. 一个新的经验证商业 use case 明确需要 Gate R/D，而不是“技术上很酷”。
```

若不成立，应优先：

```text
revisit customer segment
revisit workflow
revisit pricing
revisit decision problem
revisit applicability product UX
```

而不是默认继续增加 models/decision automation。

---

# 16. Pilot KPI Threshold 的冻结方式

本 repo 不在全局架构里写死：

```text
review rate < 20%
productivity +30%
false-safe < 1%
```

因为不同 agronomy workflow 的 base rate、risk、crop、season、customer economics 不同。

正确方式是每个 Pilot 新建一个独立、版本化的 Commercial Acceptance Profile，至少冻结：

```text
pilot_id
customer/problem scope
baseline measurement period
baseline review workflow
success metrics
success thresholds
false-safe / risk ceiling
minimum sample/evidence requirements
known exclusions
pricing/continuation condition
start/end authority
```

这些值是 pilot/commercial authority，不是 scientific authority。

后续可以为它建立独立 planning/acceptance 文档，但本 Version Slicing 不新增 Architecture domain object。

---

# 17. Reference Domain 01 的 v0.3 最小真实闭环

建议第一个 pilot 只解决：

```text
Corn irrigation agronomy applicability / escalation
```

而不是直接解决：

```text
How many mm should I irrigate now?
```

最小闭环：

```text
Customer/partner irrigation agronomy
        ↓
ADR KnowledgeRelease
        ↓
DecisionProblem:
"Is this irrigation-management knowledge usable for this field/context/use?"
        ↓
ContextManifest
        ↓
Retrieval + Applicability
        ↓
Product escalation classification
        ↓
Agronomist review/no-review workflow
        ↓
workflow KPI
```

典型 applicability dimensions 可以包括但不限于：

```text
crop/cultivar identity
planting/season timing
phenology
thermal environment
weather/rainfall/ET-related semantics
soil texture/depth/hydraulic context
root-zone water state semantics
irrigation regime/capacity/execution record
management constraints
measurement/reference conventions
spatial/depth support
uncertainty/replay quality
```

不采用固定“最多 N 个输入”的产品假设；实际 comparison 由 Knowledge conditions 与 target context 决定。

---

# 18. 为什么第一商业版本不直接做 Recommendation API

如果 v0.3 直接暴露：

```text
POST /recommend
```

容易同时掩盖三个尚未证明的问题：

```text
knowledge 是否适用？
runtime 是否合法？
decision 是否 robust？
```

因此第一商业版本的主要 product primitive 应更接近：

```text
DecisionProblem
ContextManifest
KnowledgeRetrievalResult
ApplicabilityAssessment
Escalation Read Model
Why Chain
```

而不是把全部 authority 压成 recommendation JSON。

这也是产品差异化的重要组成部分：

> ADR 卖的是 agronomy deployment / applicability / governance，而不是另一个 AI agronomist endpoint。

---

# 19. GEOX 在 Version Slicing 中的位置

GEOX 不进入 v0.1/v0.2 核心前置。

正确顺序：

```text
standalone semantic/runtime contracts
        ↓
non-GEOX reference integration
        ↓
GEOX first-party adapter
```

GEOX 在后续承担：

```text
first-party integration
reference consumer
field-validation substrate
State/Forecast/Outcome provider where useful
```

但 ADR 不理解：

```text
MCFT
CAP09
KBS
T3R1
Neon
GEOX DB schema
```

v1.0 仍必须通过“删除 GEOX adapter 后 standalone core + non-GEOX production acceptance 不受影响”的 constitutional regression。

---

# 20. 版本升级不等于 Authority 自动升级

产品版本和 scientific/runtime authority lifecycle 永远分开。

例如：

```text
ADR software v0.4 → v0.5
```

不能自动把：

```text
KnowledgeRelease
RuntimeProfile
Deployment
Model
Policy
CalibrationArtifact
```

升级为最新版本。

反过来，客户发布新 KnowledgeRelease 也不要求 ADR 产品版本升级。

所以：

```text
Software release version
≠ KnowledgeRelease version
≠ RuntimeProfile version
≠ Deployment rollout stage
≠ Model/Policy version
```

历史 RuntimeBinding 永远指向当时 exact authority refs。

---

# 21. 每个版本的 Release Checklist

每个版本进入 Release Candidate 前必须回答：

```text
Version:
Exact main baseline:
Included Master Tasks:
Closed capability gates:
Conditional paths claimed:
Conditional paths explicitly disabled:
Positive acceptance evidence:
Forbidden/nonclaim acceptance evidence:
Tenant/IP acceptance:
Replay/immutability acceptance:
Non-GEOX independence acceptance where required:
Known limitations:
Commercial metrics collected:
Commercial thresholds pre-registered where applicable:
Explicit product claims:
Explicit product nonclaims:
Rollback/deprecation plan:
```

没有这些信息的版本，不允许只凭：

```text
build green
unit tests pass
demo works
```

进入更高 maturity label。

---

# 22. Version Slicing 完整性检查

当前切片覆盖所有 Master Task Line Track：

```text
Foundation     → v0.1 onward
Knowledge      → v0.1 onward
Applicability  → v0.2/v0.3 onward
Specification  → as exercised, full by advanced runtime versions
Runtime Legal  → v0.4 onward
Decision       → v0.5 onward
Evaluation     → v0.6 onward
Productization → progressively v0.3 → v1.0
```

并保留：

```text
Gate A ≠ Gate R ≠ Gate D
Outcome ≠ CausalEffect
Source ≠ SourceArtifact
Knowledge ≠ Model ≠ Policy ≠ Implementation
RuntimePlan ≠ RuntimeBinding ≠ RuntimeAlternativeSet
DecisionDisposition ≠ DecisionResult
```

没有发现必须重新打开 Architecture v1.0 的 contradiction。

---

# 23. 下一实施 Frontier

若本 Version Slicing 被接受，规划阶段应结束。

第一 implementation frontier 不是同时开几十个任务，而是：

```text
ADR-v0.1 / MTL-F01
Repo Constitution & Standalone CI Foundation
```

随后严格沿本版本所需 task closure 推进：

```text
v0.1:
F01 → F02 → F03
        ↓
K01 → K02 → K03 → K04 → K05 → K06
```

在 v0.1 authority substrate 建立后，再并行进入 v0.2 所需 Context/DecisionProblem work。

第一商业优先级仍然不是尽快做到 v1.0，而是尽快、可信地到达：

```text
v0.3 Agronomist Pilot
```

并让真实客户回答一个问题：

> **这套系统是否真的让 Agronomist 用更少的 routine review 时间覆盖更多高质量服务，而且值得付钱？**

如果这个答案是否定的，后续 Gate R/D/E 的工程价值不能自动成为继续投资的商业理由。
