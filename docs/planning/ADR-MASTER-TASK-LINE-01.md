# Agronomy Deployment Runtime — Master Task Line 01（中文版）

Status: **PLANNING CANDIDATE / NON-ARCHITECTURE-AUTHORITY**

Repository baseline: `main @ e689d837f4ec6dfd3dc6b4714345256fbae2a900`

Architecture authority baseline: `4852912699741e9491f4e92611251b561108488e`

Capability-map authority:

- `docs/planning/ADR-CAPABILITY-MAP-01.md`
- `docs/planning/ADR-CAPABILITY-MAP-01-FINAL-ADJUDICATION.md`

Frontier: `ADR-MASTER-TASK-LINE-01`

Purpose: 把已经冻结并裁决过的 Capability Map 转换成真实、依赖有序、可以逐项验收的实施主任务线。本文不重新设计 Architecture v1.0，不改变 C00–C23 的 capability 语义，不切产品版本，不提前规定 package/service/database 物理结构。

若本文与 Architecture v1.0 或 Capability Map Final Planning Adjudication 冲突，以更上游 authority 为准。

---

# 1. Master Task Line 的定义

本任务线中的 Task 是：

> **能够关闭一个明确实施风险或形成一个可验收 authority/capability 增量的实施工作单元。**

因此：

```text
Task ≠ Capability
Task ≠ Package
Task ≠ Sprint
Task ≠ Product Version
Task ≠ PR
```

一个 Capability 可以由多个 Task 关闭；一个 Task 也可以同时支撑多个 Capability，但不得借此跨越被冻结的 authority boundary。

每个 Task 固定记录：

1. Task ID；
2. 目标；
3. 对应 Capability；
4. Hard predecessors；
5. Conditional predecessors；
6. 主要交付物；
7. Positive acceptance；
8. Forbidden / nonclaim acceptance；
9. 解锁对象。

任务号表达稳定引用，不代表单线程执行顺序。只要 Hard predecessors 已满足，允许并行推进。

---

# 2. 永久实施原则

后续所有实现必须遵守以下原则：

```text
Architecture authority
  > Capability planning authority
  > Master Task Line
  > Version slicing
  > Implementation PR
```

永久禁止：

```text
为了实现方便修改 Architecture 语义；
为了赶版本把 Conditional predecessor 偷偷降级成可忽略；
为了减少 Task 数量把两个 authority object 合并；
为了让测试通过使用 GEOX/KBS/CAP/MCFT 作为 ADR core 的隐式依赖；
把“能跑”当成 capability accepted；
把 commercial KPI 当成 scientific authority；
把 replayability 当成 agronomic validity；
把 Applicability 当成 RuntimeEligibility；
把 RuntimeEligibility 当成 Decision；
把 Outcome 当成 CausalEffect。
```

若实现发现真正逻辑 contradiction，必须停止该 Task，通过新的 `DEC-xxxx` 处理；不得在任务实现中自行重解释 Architecture v1.0。

---

# 3. 总体任务图

```text
                            FOUNDATION

                 MTL-F01 Constitutional CI
                            │
                            ▼
                 MTL-F02 Identity / Replay
                            │
                            ▼
                 MTL-F03 IAM / Knowledge IP
                            │
                         GATE F

        ┌───────────────────┼──────────────────────────┐
        │                   │                          │
        ▼                   ▼                          ▼
 KNOWLEDGE TRACK      CONTEXT / PROBLEM TRACK     SPEC TRACK

 MTL-K01 Source       MTL-A01 DecisionProblem     MTL-S01 Specs
      ↓                    ↓                      ↓
 MTL-K02 Compiler     MTL-A02 Context Contract    MTL-S02 Impl Registry
      ↓                    ↓                      ↓
 MTL-K03 Claim        MTL-A03 Ref Resolution      MTL-S03 Conformance
      ↓                    ↓                      ↓
 MTL-K04 Qualify      MTL-A04 ContextManifest     MTL-S04 Calibration
      ↓
 MTL-K05 Derived/Conflict
      ↓
 MTL-K06 KnowledgeRelease
      │
    GATE K
      │
      ├──────────────► MTL-A05 Minimal RuntimeProfile
      │                        ↓
      │                   MTL-A06 Minimal Deployment
      │                        ↓
      └──────────────────► MTL-A07 Retrieval
                               ↓
                          MTL-A08 Applicability Core
                               ↓
                          MTL-A09 Governed Transform Path (conditional)
                               ↓
                          MTL-A10 Escalation Read Model
                               ↓
                          MTL-A11 Agronomist Workbench Core
                               │
                            GATE A
                               │
                          MTL-R01 RuntimePlan DAG
                               ↓
                          MTL-R02 Information Planner
                               ↓
                          MTL-R03 RuntimeEligibility
                               │
                            GATE R
                               │
                          MTL-D01 RuntimeBinding
                               ↓
                          MTL-D02 Execution Broker
                               ↓
                          MTL-D03 RuntimeDatum/Result
                               ↓
                          MTL-D04 AlternativeSet Coverage
                               ↓
                          MTL-D05 Decision Robustness
                               ↓
                          MTL-D06 DecisionResult
                               │
                            GATE D
                               │
                          MTL-E01 Outcome Ingress
                               ↓
                          MTL-E02 Outcome Evaluation
                               ↓
                          MTL-E03 Effect Attribution
                               ↓
                          MTL-E04 Revision Proposals
                               │
                            GATE E

 CROSS-CUTTING PRODUCTIZATION:
 MTL-P01 Public API/Contract
 MTL-P02 SDK + Generic Integration
 MTL-P03 Non-GEOX Reference Acceptance
 MTL-P04 GEOX First-Party Adapter
 MTL-P05 Workbench Full Surface
 MTL-P06 Async/Idempotency/Observability
 MTL-P07 Security/Retention/Audit Export
 MTL-P08 Production Recovery/SLO
                            │
                         GATE P
```

这不是唯一代码开发顺序。尤其 `MTL-S01–S04` 可以在 Knowledge/Context 主线推进期间并行开发；但它们只有在被实际 runtime path 使用时才成为对应 Gate 的条件前置。

---

# 4. Foundation Track — Gate F

## MTL-F01 — Repo Constitution 与独立性 CI

**目标**

把独立 Repo Constitution 变成自动化约束，而不是文档声明。

**对应 Capability**

- C00

**Hard predecessors**

- Architecture v1.0；
- Capability Map 01。

**Conditional predecessors**

- 无。

**主要交付物**

- standalone build/test bootstrap；
- architecture-boundary lint/acceptance；
- 禁止 GEOX/MCFT/CAP/KBS/T3R1 core dependency 的自动检查；
- core→adapter 依赖方向检查；
- 删除 `adapters/geox` 后的 standalone acceptance fixture。

**Positive acceptance**

- ADR core 在 GEOX repo 完全不可用时仍可 build/test；
- core import customer/GEOX adapter 会被 CI 拒绝；
- GEOX schema/table/MCFT/CAP/KBS/T3R1 标识进入 core authority path 时测试失败；
- adapter 只能依赖 public ADR contract，不获得特殊 authority。

**Forbidden / nonclaim acceptance**

- 单独建 Repo 不等于 independence；
- 依靠 mocked GEOX boot core 不算 standalone；
- 暂时没有 GEOX import 不能替代自动防回归检查。

**解锁**

- MTL-F02；
- 全部后续实现。

---

## MTL-F02 — Canonical Identity / Immutability / Lineage / Replay / Audit 基础

**目标**

建立所有 authority-bearing object 共用的身份、版本、哈希、不可变、lineage、replay 和 audit 机制。

**对应 Capability**

- C01

**Hard predecessors**

- MTL-F01。

**Conditional predecessors**

- 无。

**主要交付物**

- `logical_id + version + semantic_hash` 公共机制；
- canonical serialization/hash contract；
- immutable publication lifecycle；
- lineage relation contract；
- audit event envelope；
- replay-class 支撑。

**Positive acceptance**

- 相同 semantic input 跨进程产生相同 semantic hash；
- 业务无关 operational metadata 不改变 semantic identity；
- 已发布对象 semantic mutation 必须产生新 version；
- 历史 ref 在新版本出现后仍解析原 exact object；
- audit 能还原 object creator、authority inputs 与 lineage。

**Forbidden / nonclaim acceptance**

- UUID 不能代替 semantic identity；
- `updated_at` 不能代替 version history；
- mutable JSON row 不能被称为 immutable authority；
- replay 成功不证明科学正确。

**解锁**

- MTL-F03；
- Knowledge/Context/Spec 三条主线。

---

## MTL-F03 — IAM / Tenant / Knowledge-IP / Entitlement

**目标**

建立 B2B multi-tenant、知识所有权、可见性、资格化和部署授权的硬边界。

**对应 Capability**

- C02

**Hard predecessors**

- MTL-F02。

**Conditional predecessors**

- 无。

**主要交付物**

- Organization/Tenant/Program/Principal authority；
- ownership/visibility/qualification/deployment 四维权限；
- service account/resource scope；
- authorization audit；
- tenant-isolation acceptance。

**Positive acceptance**

- owner、viewer、qualifier、deployment beneficiary 可以是不同主体；
- private knowledge 在 retrieval/runtime 层真正被隔离；
- qualification 不自动扩大 deployment entitlement；
- compiler principal 无 `QUALIFY`/`DEPLOY_PRODUCTION` 权限；
- cross-organization program 只能通过显式授权工作。

**Forbidden / nonclaim acceptance**

- 单一 `PRIVATE` 字段不能承担全部权限语义；
- 只在 UI 层隐藏不算 IP isolation；
- runtime tenant 不自动拥有知识；
- adapter 有数据访问权不代表有部署权。

**解锁**

- **Gate F**；
- MTL-K01；
- MTL-A01/A02；
- MTL-S01。

---

## Gate F — Standalone Authority Foundation

**完成条件**

```text
MTL-F01 + MTL-F02 + MTL-F03
```

**证明**

ADR 已经是独立、多租户、不可变、可审计的 authority platform 基座。

**不证明**

- 能处理农业知识；
- 能判断 field applicability；
- 能生成 runtime/decision。

---

# 5. Knowledge Track — Gate K

## MTL-K01 — Source / SourceArtifact Exact Materialization

**目标**

把逻辑 Source 与 exact bytes/content 的 SourceArtifact 永久分开。

**对应 Capability**

- C03 的 Source/SourceArtifact 部分。

**Hard predecessors**

- Gate F。

**主要交付物**

- Source identity lifecycle；
- immutable SourceArtifact；
- content hash；
- edition/materialization lineage；
- rights/license metadata；
- exact source locator contract。

**Positive acceptance**

- 一个 Source 可有多个 exact SourceArtifact；
- 相同 URL 内容变化会产生新的 artifact identity；
- 历史 compile 永远能定位 exact artifact bytes/hash。

**Forbidden / nonclaim acceptance**

- mutable URL 不能作为 exact artifact authority；
- Source metadata 不能假装是 SourceContext；
- artifact 存档不等于 claim qualification。

**解锁**

- MTL-K02。

---

## MTL-K02 — Scientific Compiler Candidate Pipeline

**目标**

把 exact SourceArtifact 编译成 source-faithful candidate objects，同时保持 Compiler 无 qualification authority。

**对应 Capability**

- C03 Scientific Compilation。

**Hard predecessors**

- MTL-K01。

**主要交付物**

- compiler job authority；
- ClaimCandidate；
- SourceContextCandidate；
- source span/locator provenance；
- compiler version/config identity；
- deterministic fixture suite。

**Positive acceptance**

- exact artifact + exact compiler contract 可重现 candidate semantics；
- candidate 可回到 source span；
- source 未报告条件明确为未报告，不被 LLM 补成事实。

**Forbidden / nonclaim acceptance**

- Compiler 不能产生 `QUALIFIED`；
- LLM confidence 不能转成 scientific-use authority；
- 模型推断出的实验条件不能伪装成 source assertion。

**解锁**

- MTL-K03。

---

## MTL-K03 — Claim 与 SourceContext Source-Faithful Authority

**目标**

把 candidate review 成 immutable Claim 与 SourceContext，而不混入平台后续判断。

**对应 Capability**

- C04 Claim / SourceContext 部分。

**Hard predecessors**

- MTL-K02。

**主要交付物**

- Claim object；
- SourceContext 六类 context dimensions；
- `NOT_REPORTED` semantics；
- claim/source-context lineage；
- reviewer correction workflow（不改 source claim）。

**Positive acceptance**

- Claim 仅表达 source asserted content；
- SourceContext 能表达 Biological/Environmental/Management/Operational/Measurement/Jurisdiction-Economic 条件；
- source 未报告的条件保持 unknown/not-reported。

**Forbidden / nonclaim acceptance**

- reviewer 不得“修正论文”而重写原 Claim；
- SourceContext 不得被目标田数据污染；
- 来源信誉不能自动成为 qualification。

**解锁**

- MTL-K04。

---

## MTL-K04 — Scientific Qualification Authority

**目标**

建立 Human/Scientific qualification 对 Claim 的显式 use authority。

**对应 Capability**

- C04 Qualification / QualifiedKnowledge。

**Hard predecessors**

- MTL-K03；
- Gate F IAM。

**主要交付物**

- qualification lifecycle；
- QualifiedKnowledge；
- allowed/forbidden use；
- qualification scope；
- effect modifier/limitation records；
- supersede/revoke lineage。

**Positive acceptance**

- 同一 Claim 可对 use A qualified、对 use B prohibited；
- qualification 绑定 exact Claim/version/hash；
- revocation 不改历史 Claim/Binding。

**Forbidden / nonclaim acceptance**

- `QUALIFIED` 不等于 `APPLICABLE`；
- Compiler 不能 self-qualify；
- reviewer authority 不覆盖 tenant entitlement。

**解锁**

- MTL-K05。

---

## MTL-K05 — DerivedKnowledge / DerivedKnowledgeContext / Conflict

**目标**

支持受治理 synthesis，同时显式保存 origin domain 和科学冲突。

**对应 Capability**

- C05 DerivedKnowledge / Conflict。

**Hard predecessors**

- MTL-K04。

**主要交付物**

- DerivedKnowledge；
- DerivedKnowledgeContext；
- derivation method authority；
- full `DERIVED_FROM` lineage；
- KnowledgeConflict；
- conflict resolution workflow。

**Positive acceptance**

- DerivedKnowledge 不借用某一任意输入 SourceContext；
- 多知识综合必须绑定 exact derivation method；
- 同一 semantic role 的不可调和差异显式生成 conflict。

**Forbidden / nonclaim acceptance**

- newest wins；
- LLM preference resolves conflict；
- simple average hides incompatible contexts；
- local calibration 自动变成 DerivedKnowledge。

**解锁**

- MTL-K06。

---

## MTL-K06 — KnowledgeRelease

**目标**

把可部署的 Qualified/Derived Knowledge 冻结成 exact release，而不混入 Model/Policy/Implementation/rollout state。

**对应 Capability**

- C05 KnowledgeRelease。

**Hard predecessors**

- MTL-K05。

**主要交付物**

- KnowledgeRelease identity/hash；
- exact member refs；
- release lifecycle；
- entitlement checks；
- replay fixtures。

**Positive acceptance**

- release 中每个 knowledge ref 都固定 exact version/hash；
- 新 Model/Policy 不要求无变化 KnowledgeRelease 重发；
- historical RuntimeProfile 可继续指向老 release。

**Forbidden / nonclaim acceptance**

- KnowledgeRelease 不含 Model/Policy/Implementation；
- KnowledgeRelease 不含 rollout stage；
- “latest qualified knowledge” 不能在 runtime 时动态替换 release 成员。

**解锁**

- **Gate K**；
- MTL-A05；
- MTL-A07。

---

## Gate K — Deployable Knowledge Authority

**完成条件**

```text
Gate F
+ MTL-K01..K06
```

**证明**

```text
exact SourceArtifact
→ source-faithful compile
→ Claim + SourceContext
→ scientific qualification
→ derived/conflict governance
→ exact KnowledgeRelease
```

**不证明**

- 某知识适用于任何具体 field；
- 存在合法 runtime；
- 应 ACT/WAIT。

---

# 6. Context / Decision / Applicability Track — Gate A

## MTL-A01 — DecisionProblem / Use-Purpose Authority

**目标**

冻结 ADR 当前究竟在解决什么问题，以及 action space/use class/authority mode。

**对应 Capability**

- C07

**Hard predecessors**

- Gate F。

**主要交付物**

- DecisionProblem contract；
- target scope/logical time/horizon；
- objective/constraints/action-space；
- use purpose/use class；
- `ADR_POLICY / EXTERNAL_POLICY / RUNTIME_ONLY` authority mode。

**Positive acceptance**

- horizon/action-space/objective materially 变化产生新 semantic identity；
- downstream 对 exact DecisionProblem 绑定；
- `RUNTIME_ONLY` 明确禁止 ADR final decision authority。

**Forbidden / nonclaim acceptance**

- 无 DecisionProblem 进行 Runtime Compile；
- “corn irrigation” 模糊字符串代替 exact decision contract；
- DecisionProblem 自身包含 agronomic conclusion。

**解锁**

- MTL-A04；
- MTL-A07。

---

## MTL-A02 — Agronomic Context Contract 与 ContextDatum

**目标**

建立平台中立的 agronomic context semantic envelope。

**对应 Capability**

- C06 的 Context Contract 部分。

**Hard predecessors**

- Gate F。

**主要交付物**

- ContextDatum；
- semantic_id/unit/value contract；
- epistemic_class；
- provenance_class；
- temporal/spatial/vertical support；
- uncertainty；
- inline/reference modes。

**Positive acceptance**

系统能明确区分：

```text
10 cm VWC OBSERVATION
root-zone storage STATE_ESTIMATE
grower planting-date ASSERTION
machine planting MANAGEMENT/OBSERVATION record
weather FORECAST
MODEL_PRIOR
```

并保持各自语义支持范围。

**Forbidden / nonclaim acceptance**

- 裸 `{soil_moisture: 32}` 进入 decision-critical path；
- provenance 自动升级 epistemic class；
- adapter 隐式把 observation 变成 state estimate。

**解锁**

- MTL-A03。

---

## MTL-A03 — AuthorizedContextReference / Resolution Receipt

**目标**

支持企业客户 reference-not-copy 模式，同时保存历史决策当时真正读取到的内容。

**对应 Capability**

- C06 Reference Resolution。

**Hard predecessors**

- MTL-A02；
- Gate F IAM。

**主要交付物**

- AuthorizedContextReference；
- provider authorization context；
- ResolvedContextDatumReceipt；
- content hash；
- resolved/effective/available times；
- ReplayClass。

**Positive acceptance**

- exact/content-addressed/provider-dependent/non-replayable 被真实区分；
- provider 后续更新不重写旧 receipt；
- decision-critical reference 在使用前有 resolved receipt。

**Forbidden / nonclaim acceptance**

- mutable provider URL 伪装 exact replay；
- 只存 ref、不存当时 resolved content/hash 就宣称可重放；
- reference auth token 进入 semantic hash。

**解锁**

- MTL-A04。

---

## MTL-A04 — Immutable ContextManifest

**目标**

冻结一个 exact DecisionProblem 对应的 target context world。

**对应 Capability**

- C06 complete ContextManifest。

**Hard predecessors**

- MTL-A01；
- MTL-A02；
- MTL-A03。

**主要交付物**

- TargetContext；
- ContextManifest；
- exact datum/receipt refs；
- logical time/evidence cutoff；
- manifest hash/replay classification。

**Positive acceptance**

- Manifest 必须绑定 exact DecisionProblem；
- context/provider 之后变化只生成新 Manifest；
- replay 能回答当时究竟使用了哪些 datum/receipt。

**Forbidden / nonclaim acceptance**

- Applicability 直接查询开放 mutable context pool；
- manifest 生成后中途换 datum；
- current runtime output retroactively 进入 current manifest。

**解锁**

- MTL-A07/A08。

---

## MTL-A05 — Minimal RuntimeProfile

**目标**

建立不依赖未使用 Model/Policy/Implementation/Calibration 的最小合法 RuntimeProfile。

**对应 Capability**

- C13 RuntimeProfile。

**Hard predecessors**

- Gate K；
- Gate F。

**Conditional predecessors**

- MTL-S01，当 profile 实际约束 Transformation/Model/Policy；
- MTL-S03，当 profile 实际约束 conformant implementation；
- MTL-S04，当 profile 实际约束 calibration authority。

**主要交付物**

最小 profile 至少冻结：

```text
KnowledgeRelease
context requirements
replay requirements
runtime governance
allowed use/deployment constraints
```

**Positive acceptance**

- minimal profile 无需虚构不存在的 model/policy refs；
- profile 更换 model/policy 时可独立 version，不改 KnowledgeRelease。

**Forbidden / nonclaim acceptance**

- RuntimeProfile 退化为 KnowledgeRelease；
- 为了字段非空注册 fake Model/Policy；
- profile mutation 原地改变历史 deployment semantics。

**解锁**

- MTL-A06/A07。

---

## MTL-A06 — Deployment Authority（Applicability-Safe Minimal Path）

**目标**

把 exact RuntimeProfile 授权到 organization/program/target/use/time 范围，并区分 runtime environment 与 rollout stage。

**对应 Capability**

- C13 Deployment。

**Hard predecessors**

- MTL-A05；
- Gate F IAM。

**主要交付物**

- Deployment；
- deployment scope/effective interval；
- entitlements；
- runtime_environment；
- rollout_stage；
- suspend/deprecate semantics。

**Positive acceptance**

- `DEVELOPMENT/STAGING/PRODUCTION` 与 `DRAFT/SANDBOX/SHADOW/PILOT/PRODUCTION/...` 分离；
- deployment 无权修改 profile/release 内容；
- unauthorized tenant/program retrieval 被拒绝。

**Forbidden / nonclaim acceptance**

- qualified knowledge 自动 production deployed；
- PILOT 作为 runtime environment；
- deployment rollout flag 隐式改变 scientific semantics。

**解锁**

- MTL-A07。

---

## MTL-A07 — Replayable Knowledge Retrieval

**目标**

从 exact authorized KnowledgeRelease 中生成 high-recall、可重放、非 scientific-authority 的 Candidate Knowledge Set。

**对应 Capability**

- C08

**Hard predecessors**

- Gate K；
- MTL-A01；
- MTL-A05/A06；
- Gate F IAM。

**Conditional predecessors**

- MTL-A04，当 retrieval 使用 target-context summary dimensions。

**主要交付物**

- KnowledgeRetrievalResult；
- engine/version/config identity；
- index/corpus snapshot identity；
- candidate refs；
- miss diagnostics/replay fixtures。

**Positive acceptance**

- exact same retrieval authority input 可重放 candidate identities；
- tenant/visibility/deployment filter 在 candidate disclosure 前生效；
- 能区分 retrieval miss 与 applicability reject。

**Forbidden / nonclaim acceptance**

- ranking score 变成 scientific qualification；
- 动态扫描 unreleased/latest knowledge；
- “未检索到”解释为 scientific false。

**解锁**

- MTL-A08。

---

## MTL-A08 — Source→Target Applicability Core

**目标**

对 exact KnowledgeOriginContext → ContextManifest → DecisionProblem 进行 deterministic transport adjudication。

**对应 Capability**

- C09 core path。

**Hard predecessors**

- Gate K；
- MTL-A01；
- MTL-A04；
- MTL-A07。

**Conditional predecessors**

- MTL-S01，仅在 governed transformation path 被实际使用时；
- MTL-S04，仅在既有 CalibrationArtifact 被用来关闭 calibration-required path 时。

**主要交付物**

- ApplicabilityAssessment；
- origin-vs-target condition assessments；
- effect modifier handling；
- disposition；
- limitations/conflicts/missing context refs。

**Positive acceptance**

至少能可靠区分：

```text
DIRECTLY_APPLICABLE
CALIBRATION_REQUIRED
BOUNDED_EXTRAPOLATION
UNRESOLVED
CONFLICT
NOT_RELEVANT
```

在 Transformation authority 可用时再支持：

```text
APPLICABLE_WITH_GOVERNED_TRANSFORM
```

**Forbidden / nonclaim acceptance**

- country/region equality 直接判 compatible；
- unknown 自动补 prior 以制造 match；
- LLM 把 CONFLICT 改成 low-confidence MATCH；
- Applicability 输出 ACT/WAIT；
- `CALIBRATION_REQUIRED` 被自动视为已满足。

**解锁**

- MTL-A09/A10；
- Gate A core。

---

## MTL-A09 — Governed Transformation Applicability Path（条件任务）

**目标**

当实际产品路径需要语义/单位/科学转换时，证明只有 QualifiedTransformation 才能关闭 mismatch。

**对应 Capability**

- C09 conditional path；
- C10 Transformation 部分。

**Hard predecessors**

- MTL-A08；
- MTL-S01 Transformation authority。

**主要交付物**

- transform selection；
- transform applicability check；
- exact transform ref in ApplicabilityAssessment；
- before/after semantic contract proof。

**Positive acceptance**

- governed transform 显式可追踪；
- transform 后的 semantic identity/support 正确；
- 不可合法转换的 mismatch 保持 unresolved/conflict。

**Forbidden / nonclaim acceptance**

- adapter 自己写 conversion 规则并获得 scientific authority；
- LLM 临时生成 transform；
- 仅单位转换掩盖 spatial/depth/epistemic mismatch。

**解锁**

- Gate A 中的 transform-supported path。

---

## MTL-A10 — Explainable Escalation Classification / Read Model

**目标**

把 Applicability 结果转换成专家 workflow classification，但不新建 scientific/runtime authority。

**对应 Capability**

- C22 applicability/escalation surface。

**Hard predecessors**

- MTL-A08；
- MTL-A06。

**主要交付物**

- escalation reason taxonomy；
- `NO_REVIEW_REQUIRED` candidate read model；
- `REVIEW_REQUIRED / INFORMATION_REQUIRED / CONFLICT / CALIBRATION_REQUIRED` 等 workflow views；
- full Why-chain projection。

**Positive acceptance**

- 每个 queue item 可追到 DecisionProblem、ContextManifest、RetrievalResult、ApplicabilityAssessment；
- unknown/conflict 不会被隐藏成 low-confidence normal；
- `NO_REVIEW_REQUIRED` 仅为 derived product classification。

**Forbidden / nonclaim acceptance**

- `NO_REVIEW_REQUIRED = SAFE`；
- `NO_REVIEW_REQUIRED = ACT`；
- read model 自行修改 Applicability authority；
- 为降低 review rate 隐藏 blocked cases。

**解锁**

- MTL-A11；
- 商业 workload 测量。

---

## MTL-A11 — Agronomist Workbench Core

**目标**

形成第一条真正面向 Agronomist 的 applicability/escalation 工作流。

**对应 Capability**

- C22 core surface。

**Hard predecessors**

- MTL-K03–K06；
- MTL-A04/A07/A08/A10。

**主要交付物**

- Source/Claim/Qualification review；
- Conflict queue；
- Applicability Inspector；
- field/target escalation queue；
- Why chain；
- review timing/reason instrumentation。

**Positive acceptance**

- Agronomist 从 escalation 可查看 source span→claim→origin context→qualification→target context→applicability；
- UI 的 approve/qualify/deploy 动作调用同一 backend authority；
- 可以统计 review volume/time/reasons，但这些指标不改变 scientific state。

**Forbidden / nonclaim acceptance**

- Workbench 成为 parallel recommendation engine；
- UI override 直接 UPDATE immutable authority；
- “accept” 绕过 Qualification/Applicability；
- review rate 降低被当成 false-safe 证明。

**解锁**

- **Gate A**；
- first commercial applicability/escalation proof。

---

## Gate A — Applicability / Agronomist Escalation Proof

**完成条件**

```text
Gate K
+ MTL-A01..A08
+ MTL-A10
+ MTL-A11
+ MTL-A09 only when governed-transform path is claimed
```

其中 MTL-A05/A06 使用 minimal RuntimeProfile/Deployment；不要求未使用的 Model/Policy/Implementation/Calibration authority。

**证明**

```text
Exact company agronomy
→ exact DecisionProblem
→ immutable ContextManifest
→ replayable retrieval
→ source→target applicability
→ explainable agronomist escalation
```

**允许的产品结论**

- 哪些知识在当前 target/use 下直接适用；
- 哪些需要 governed transform；
- 哪些需要 calibration；
- 哪些 unknown/conflict/not relevant；
- 哪些对象需要专家查看。

**禁止的结论**

```text
RUNTIME_ELIGIBLE
ACT
WAIT
agronomic effectiveness
causal benefit
```

---

# 7. Specification / Conformance / Calibration Parallel Track

## MTL-S01 — Transformation / Model / Policy Specification Authority

**目标**

独立 version/govern Transformation、Model、Policy specification，不绑定 mutable executor availability。

**对应 Capability**

- C10

**Hard predecessors**

- Gate F；
- context semantic contract 至少达到 MTL-A02 的语义基础。

**主要交付物**

- QualifiedTransformation spec；
- Model spec；
- Policy spec；
- input/output semantic contract；
- parameter/action semantics；
- applicability/limitations。

**Positive acceptance**

- spec identity 与 implementation identity 分开；
- Model 版本变化由语义/计算 contract 变化触发；
- Policy 只拥有 decision logic，不吞并 Knowledge。

**Forbidden / nonclaim acceptance**

- endpoint URL 进入 Model semantic identity；
- commercial preference 伪装成 scientific knowledge；
- model output 自动被当成 observation。

**解锁**

- MTL-S02；
- MTL-A09；
- Gate R/D 对应路径。

---

## MTL-S02 — Implementation Registry

**目标**

注册 internal/external implementations，但不因注册成功获得 specification conformance。

**对应 Capability**

- C11 Implementation 部分。

**Hard predecessors**

- MTL-S01。

**主要交付物**

- Implementation identity/version；
- provider type（internal/http/customer/geox/wasm/batch 等）；
- endpoint/artifact/runtime metadata；
- operational constraints。

**Positive acceptance**

- Implementation 独立 version；
- 新 executor 不要求修改 Model specification；
- 同一 Model 可有多个 Implementation candidates。

**Forbidden / nonclaim acceptance**

- endpoint health = model conformance；
- Implementation 修改 scientific spec；
- executor owner 获得 qualification authority。

**解锁**

- MTL-S03。

---

## MTL-S03 — ImplementationConformance Qualification

**目标**

证明某 Implementation@version 合法实现某 Specification@version。

**对应 Capability**

- C11 ImplementationConformance。

**Hard predecessors**

- MTL-S01；
- MTL-S02。

**主要交付物**

- ImplementationConformance object；
- compatibility tests；
- qualified input/output semantics；
- conformance scope/limitations；
- supersede/revoke lifecycle。

**Positive acceptance**

- Model M@5 可同时绑定 IC-1→I1@7 与 IC-2→I2@3；
- executor 更新只需要新 Implementation/Conformance，不要求 Model spec 伪变化；
- failed conformance implementation 不能进入 RuntimeBinding。

**Forbidden / nonclaim acceptance**

- “返回 200”作为 conformance；
- schema shape 相同就视为 scientific equivalence；
- implementation owner 自我认证 bypass reviewer policy。

**解锁**

- Runtime execution path；
- MTL-S04 的 calibration implementation（如需要）。

---

## MTL-S04 — CalibrationArtifact Authority

**目标**

为 model/transform/runtime parameter calibration 建立独立 authority，关闭 `CALIBRATION_REQUIRED` 而不污染 DerivedKnowledge。

**对应 Capability**

- C12

**Hard predecessors**

- Gate F；
- MTL-S01。

**Conditional predecessors**

- MTL-S03，当 calibration process 通过具体 executor 运行并需要 conformance authority；
- MTL-A04，当 calibration scope/evidence 使用 ADR context semantics。

**主要交付物**

- CalibrationArtifact；
- method/evidence/scope/validity/diagnostics；
- calibrated spec refs；
- CalibrationProposal distinction；
- expire/supersede rules。

**Positive acceptance**

- exact target/program/field scope 可验证；
- expired calibration 不影响历史 Binding replay；
- Evaluation 只能提 proposal，不能直接发布 qualified CalibrationArtifact。

**Forbidden / nonclaim acceptance**

- runtime assumption 满足 calibration authority；
- model fit score 自动 production-qualified；
- local field calibration 自动成为 global DerivedKnowledge。

**解锁**

- calibration-required Gate R/D paths。

---

# 8. Runtime Legality Track — Gate R

## MTL-R01 — Runtime Compiler / RuntimePlan DAG IR

**目标**

把 DecisionProblem + ContextManifest + Deployment/RuntimeProfile + retrieved/applicable candidates 编译成 explicit solving DAG。

**对应 Capability**

- C14

**Hard predecessors**

- Gate A；
- MTL-S01 only for specification paths actually represented。

**Conditional predecessors**

- MTL-S03，当 executable implementation candidates 被纳入；
- MTL-S04，当 calibrated paths 被纳入。

**主要交付物**

- RuntimeCandidates；
- RuntimePlan DAG；
- node semantic I/O contracts；
- authority refs；
- alternative branches；
- unresolved requirement edges；
- cycle detection。

**Positive acceptance**

- frozen authority inputs + compiler version 得到 deterministic plan semantics；
- multiple legal alternatives 不被提前 collapse；
- unresolved input 明确留在 DAG；
- current-binding circular dependency 被拒绝。

**Forbidden / nonclaim acceptance**

- RuntimePlan = RuntimeBinding；
- plan 用同一 binding 的未来 output 证明当前 binding 合法；
- compiler 发明 missing evidence；
- compiler self-qualify Knowledge/Calibration。

**解锁**

- MTL-R02。

---

## MTL-R02 — InformationRequirement / Acquisition Planning

**目标**

把 runtime plan 中未满足的 decision-material requirements 明确化，并可描述最低成本获取路径而不把 option 当 evidence。

**对应 Capability**

- C15 InformationRequirement 部分。

**Hard predecessors**

- MTL-R01。

**主要交付物**

- InformationRequirement；
- status lifecycle；
- acceptable semantic/epistemic classes；
- deadline/materiality；
- InformationAcquisitionOption（如实现）；
- provider capability/cost/latency/quality descriptors。

**Positive acceptance**

- requirement 可为 OPEN/SATISFIED/UNSATISFIABLE/NO_LONGER_DECISION_MATERIAL；
- acquisition option 能区分 existing data / derived state / remote sensing / customer API / user question / scouting / lab / sensor 等；
- requirement satisfied 后通过新的 context/compile world 前进。

**Forbidden / nonclaim acceptance**

- acquisition option 自身被当成 evidence；
- UNKNOWN 被 scalar confidence 吞掉；
- current ContextManifest 原地补字段。

**解锁**

- MTL-R03。

---

## MTL-R03 — RuntimeEligibility

**目标**

在行动之前独立判断是否存在合法 runtime world。

**对应 Capability**

- C15 RuntimeEligibility。

**Hard predecessors**

- MTL-R01；
- MTL-R02。

**Conditional predecessors**

- MTL-S03，当 implementation conformance 是合法 runtime 的必需条件；
- MTL-S04，当 calibration 是合法 runtime 的必需条件。

**主要交付物**

RuntimeEligibility exact values：

```text
RUNTIME_ELIGIBLE
RUNTIME_ELIGIBLE_WITH_LIMITATIONS
INFORMATION_REQUIRED
NO_LEGAL_RUNTIME
```

以及 governed reason codes。

**Positive acceptance**

- unauthorized knowledge/prohibited transform/no compatible model/dependency cycle/replay failure 等可明确形成 NO_LEGAL_RUNTIME；
- open decision-material requirement 形成 INFORMATION_REQUIRED；
- limitation 被结构化保留。

**Forbidden / nonclaim acceptance**

- RuntimeEligibility 输出 ACT/WAIT；
- `RUNTIME_ELIGIBLE` 解释为 agronomically correct；
- 为减少 blocked rate 自动忽略 requirement。

**解锁**

- **Gate R**；
- MTL-D01。

---

## Gate R — Runtime Legality Proof

**完成条件**

```text
Gate A
+ MTL-R01 + MTL-R02 + MTL-R03
+ MTL-S01/S03/S04 only as exercised
```

**证明**

ADR 能回答：

> 在当前 exact Knowledge/Context/Problem/Profile 下，是否存在一个合法可执行或可解释的 runtime world？

**不证明**

- 应采取哪一个 action；
- action 在 plausible worlds 下是否 robust；
- agronomic outcome 会更好。

---

# 9. Decision Runtime Track — Gate D

## MTL-D01 — Immutable RuntimeBinding

**目标**

从已裁决的 legal runtime world 冻结一个 exact computational world。

**对应 Capability**

- C16

**Hard predecessors**

- Gate R。

**Conditional predecessors**

- MTL-S03，当 executable spec 被绑定；
- MTL-S04，当 calibration material。

**主要交付物**

- RuntimeBinding；
- exact DecisionProblem/Deployment/Profile/KnowledgeRelease/ContextManifest refs；
- exact Knowledge/Transformation/Model/Policy refs；
- exact Implementation/Conformance refs；
- CalibrationArtifact refs；
- cutoffs/assumptions/limitations。

**Positive acceptance**

- 每个 material authority version/hash 被冻结；
- unresolved alternative 不进入单一 Binding；
- 新版本发布后旧 Binding 仍 exact replay-addressable。

**Forbidden / nonclaim acceptance**

- execution 时动态取 latest model/knowledge；
- ContextManifest mid-run replacement；
- unresolved requirement 伪装 assumption；
- Binding 被称为 scientific truth。

**解锁**

- MTL-D02。

---

## MTL-D02 — Runtime Execution Broker

**目标**

执行或 broker exact bound runtime node，同时保持 ImplementationConformance 和 input authority。

**对应 Capability**

- C17 execution path。

**Hard predecessors**

- MTL-D01；
- MTL-S03（被执行 specification）。

**主要交付物**

- internal/external execution dispatch；
- exact input hash envelope；
- execution idempotency identity；
- timeout/error taxonomy；
- implementation/conformance enforcement。

**Positive acceptance**

- 只能 dispatch conformant implementation；
- external/internal execution 产生同类 normalized result envelope；
- retry 不生成语义重复 authority result。

**Forbidden / nonclaim acceptance**

- HTTP 200 = semantically valid；
- broker 改 Model/Policy semantics；
- fallback 到 unqualified implementation 而不显式失败。

**解锁**

- MTL-D03。

---

## MTL-D03 — RuntimeResult / RuntimeDatum Semantic Envelope

**目标**

防止 rich input semantics 经模型后退化成 bare number。

**对应 Capability**

- C17 RuntimeResult/RuntimeDatum。

**Hard predecessors**

- MTL-D02。

**主要交付物**

- RuntimeResult；
- RuntimeDatum；
- semantic ID/value/unit；
- epistemic/provenance class；
- valid/effective/forecast time；
- support/uncertainty；
- binding/node/implementation/conformance refs。

**Positive acceptance**

- state estimate、forecast、derived parameter 等保持正确 epistemic identity；
- RuntimeDatum 以后只能通过正常 Context Resolution 进入未来 ContextManifest；
- exact output semantics 可 hash/replay。

**Forbidden / nonclaim acceptance**

- RuntimeDatum = ContextDatum；
- runtime output 反向授权当前 Binding；
- model output 被 relabel OBSERVATION；
- output 丢 uncertainty/time/support。

**解锁**

- MTL-D04。

---

## MTL-D04 — RuntimeAlternativeSet / Coverage Authority

**目标**

冻结 robustness 所比较的合法世界 universe/coverage，解决“只跑方便的三个世界”问题。

**对应 Capability**

- C18 RuntimeAlternativeSet。

**Hard predecessors**

- MTL-R01；
- MTL-D01；
- MTL-D03。

**主要交付物**

- RuntimeAlternativeSet；
- included bindings；
- excluded candidates + reason codes；
- material uncertainty dimensions；
- generation method；
- completeness class：`EXHAUSTIVE_ENUMERATION / BOUNDED_ENVELOPE / GOVERNED_COVERAGE / INCOMPLETE`。

**Positive acceptance**

- exact coverage 被审计；
- excluded world 必须有 governed reason；
- `INCOMPLETE` 被显式传播到 robustness。

**Forbidden / nonclaim acceptance**

- convenient subset 伪装 complete；
- probability score 隐藏 uncovered alternative；
- conflict 平均掉后制造一致性。

**解锁**

- MTL-D05。

---

## MTL-D05 — DecisionRobustness / MaterialActionSignature

**目标**

判断多个合法 plausible worlds 是否产生 materially equivalent decision。

**对应 Capability**

- C18 DecisionRobustness。

**Hard predecessors**

- MTL-D04。

**主要交付物**

- MaterialActionSignature；
- robustness comparison；
- ROBUST/SENSITIVE/UNRESOLVED semantics；
- action-changing uncertainty diagnostics。

**Positive acceptance**

- `IRRIGATE 10 mm` 与 `IRRIGATE 30 mm` 被判 materially different；
- only sufficient coverage 可产生 ROBUST；
- SENSITIVE/UNRESOLVED 可触发 ASK/ABSTAIN path。

**Forbidden / nonclaim acceptance**

- 只比较 ACT/WAIT label；
- INCOMPLETE coverage 输出 ROBUST；
- confidence scalar 替代 alternative coverage reasoning。

**解锁**

- MTL-D06。

---

## MTL-D06 — DecisionResult

**目标**

在 authority mode 允许时生成 immutable structured DecisionResult，彻底区分 disposition 与 action semantics。

**对应 Capability**

- C19

**Hard predecessors**

- MTL-D05；
- MTL-A01；
- MTL-S01 Policy authority when ADR/external policy owns decision。

**主要交付物**

- DecisionDisposition；
- DecisionResult；
- structured action contract；
- ASK→InformationRequirement refs；
- WAIT reevaluation semantics；
- ABSTAIN reason authority；
- robustness/policy/runtime refs。

**Positive acceptance**

- `ACT` 必须带 material action semantics；
- `WAIT` 说明 reevaluation conditions；
- `ASK` 指向 exact information need；
- `RUNTIME_ONLY` 不产生 ADR DecisionResult。

**Forbidden / nonclaim acceptance**

- RuntimeEligibility→ACT；
- SENSITIVE robustness 仍输出确定性 ACT；
- ACT 无 amount/timing/constraints；
- ADR DecisionResult 被当作 human approval/machine execution authority。

**解锁**

- **Gate D**；
- MTL-E01；
- full decision workbench。

---

## Gate D — Decision Runtime Proof

**完成条件**

```text
Gate R
+ MTL-D01..D06
+ MTL-S01/S03/S04 as exercised
```

**证明**

```text
legal runtime world
→ exact RuntimeBinding
→ conformant execution
→ semantically preserved RuntimeDatum
→ governed alternative coverage
→ decision robustness
→ structured DecisionResult
```

**不证明**

- downstream approval/execution 成功；
- agronomic effectiveness；
- causal benefit。

---

# 10. Evaluation Track — Gate E

## MTL-E01 — Outcome Ingress

**目标**

把 external decision/execution/outcome 事实接回 ADR，同时保持 epistemic/provenance semantics。

**对应 Capability**

- C20 Outcome ingress。

**Hard predecessors**

- Gate F；
- MTL-A02 context semantic foundation；
- MTL-D01 for ADR-bound runtime evaluation。

**Conditional predecessors**

- MTL-D06，当评估 ADR DecisionResult；
- 可支持 external decision/runtime-only integration 无 C19 path。

**主要交付物**

- Outcome；
- outcome semantic envelope；
- decision/execution/runtime refs；
- temporal/provenance identity；
- duplicate/idempotency handling。

**Positive acceptance**

- outcome 可明确说明 observed/asserted/derived source；
- external execution 与 ADR runtime 被正确关联而非混为一体。

**Forbidden / nonclaim acceptance**

- Outcome = causal effect；
- favorable outcome 自动提高 knowledge authority。

**解锁**

- MTL-E02。

---

## MTL-E02 — OutcomeEvaluation 多维评价

**目标**

分离 Knowledge、Transport、Model、Policy、Execution、Commercial evaluation，不把差结果归咎到一个对象。

**对应 Capability**

- C20 OutcomeEvaluation。

**Hard predecessors**

- MTL-E01。

**主要交付物**

- OutcomeEvaluation；
- dimensioned diagnostics；
- evidence/limitations refs；
- replayable evaluation method identity。

**Positive acceptance**

- 同一 outcome 可以得到“model error evidence stronger than knowledge-false evidence”等分离结论；
- descriptive/associational evaluation 明确不声称 causal effect。

**Forbidden / nonclaim acceptance**

- yield↓ ⇒ Knowledge false；
- yield↑ ⇒ ADR effective；
- execution failure 被记成 model failure。

**解锁**

- MTL-E03/E04。

---

## MTL-E03 — EffectAttributionAssessment

**目标**

只有存在明确 evaluation design/counterfactual basis 时才允许 causal/effect claim。

**对应 Capability**

- C20 Effect Attribution。

**Hard predecessors**

- MTL-E02。

**主要交付物**

- EffectAttributionAssessment；
- attribution class；
- evaluation design；
- counterfactual basis；
- confounders；
- limitations；
- attribution authority。

**Positive acceptance**

- descriptive、associational、causal 类别可区分；
- causal claim 可追到设计与 counterfactual basis。

**Forbidden / nonclaim acceptance**

- correlation→causation；
- before/after 单田对比自动叫 treatment effect；
- vendor-reported benefit 被平台升级为 causal proof。

**解锁**

- stronger commercial/scientific evaluation path。

---

## MTL-E04 — Revision Proposal → Control Review Loop

**目标**

允许 Evaluation 产生 proposal，但所有新 authority 必须重新经过 Control review。

**对应 Capability**

- C20 proposal loop。

**Hard predecessors**

- MTL-E02。

**Conditional predecessors**

- MTL-E03，当 proposal 依赖 effect attribution claim。

**主要交付物**

- CalibrationProposal；
- KnowledgeRequalificationProposal；
- TransformationRevisionProposal；
- ModelRevisionProposal；
- PolicyRevisionProposal；
- handback-to-Control workflow。

**Positive acceptance**

- proposal 不能直接成为 qualified object；
- approved revision 产生新 authority version；
- rejected proposal 保持可审计。

**Forbidden / nonclaim acceptance**

- Evaluation 直接 UPDATE QualifiedKnowledge/Model/Policy/Calibration；
- self-learning runtime 静默改变 production behavior；
- Outcome 直接改变 current binding semantics。

**解锁**

- **Gate E**。

---

## Gate E — Evaluation / Learning Loop

**完成条件**

```text
MTL-E01 + MTL-E02 + MTL-E04
+ MTL-E03 when causal/effect claims are made
```

**证明**

ADR 可以从现实 outcome 学到“应该提出什么修改建议”，但不能 self-authorize 下一版 scientific/runtime authority。

---

# 11. Cross-Cutting Productization Track — Gate P

## MTL-P01 — Public API / OpenAPI Authority Surface

**目标**

把已经实现的 domain authority 暴露为稳定公共 contract，而不是黑盒 `/recommend`。

**对应 Capability**

- C21

**Hard predecessors**

- Gate F；
- MTL-A01/A02；
- 被暴露的对应 domain Task。

**主要交付物**

- resource-oriented public API；
- OpenAPI；
- hash/version/authorization semantics；
- idempotency contract；
- no-authority-bypass checks。

**Positive acceptance**

- external client 不知道 ADR DB schema 也能使用；
- Context/Decision/Binding/Outcome resource 保留 authority-critical fields；
- API 无法直接 mutation RuntimeBinding/qualified objects 绕过 workflow。

**Forbidden / nonclaim acceptance**

- `/recommend` shortcut 绕过 ContextManifest/Applicability/Binding；
- customer field name 进入 core semantic ID；
- convenience DTO 丢 hash/provenance/uncertainty。

**解锁**

- MTL-P02/P03/P04；
- enterprise integrations。

---

## MTL-P02 — SDK + Generic Integration Contracts

**目标**

把 ContextProvider、ModelExecutor、OutcomeProvider、ResultSink 等标准角色变成平台中立 SDK/integration contracts。

**对应 Capability**

- C21

**Hard predecessors**

- MTL-P01。

**主要交付物**

- TypeScript/Python/OpenAPI SDK surface（具体语言可在版本切片时裁决）；
- generic REST/webhook/batch contract；
- adapter mapping rules；
- service principal auth。

**Positive acceptance**

- adapter 只负责 schema/protocol mapping；
- SDK round-trip 不丢 semantic authority；
- external executor 路径能携带 exact ImplementationConformance 与 result binding。

**Forbidden / nonclaim acceptance**

- SDK 内置 hidden agronomic transforms；
- adapter 获得 scientific transport authority；
- external system 被迫采用 ADR internal DB model。

**解锁**

- MTL-P03/P04。

---

## MTL-P03 — Non-GEOX Reference Integration Acceptance

**目标**

用一个非 GEOX reference consumer/providor 证明产品独立性不是口号。

**对应 Capability**

- C00；
- C21。

**Hard predecessors**

- MTL-P02；
- 至少 Gate A 对应产品 surface。

**主要交付物**

- generic/customer-like reference adapter；
- ContextProvider integration；
- applicability result consumption；
- standalone end-to-end acceptance。

**Positive acceptance**

- 完全没有 GEOX runtime 仍能完成 Gate A end-to-end；
- 删除 GEOX adapter 后 reference integration 不受影响。

**Forbidden / nonclaim acceptance**

- 通过模拟 GEOX schema 的“generic adapter”冒充独立客户；
- reference integration 成功被解释为 agronomic validity。

**解锁**

- 独立商业 pilot readiness。

---

## MTL-P04 — GEOX First-Party Adapter

**目标**

把 GEOX 作为 first-party reference consumer/provider 接入 ADR，但保持完全下游依赖方向。

**对应 Capability**

- C21；
- C00 independence regression。

**Hard predecessors**

- MTL-P02；
- MTL-P03 应优先完成，防止 GEOX-first coupling。

**主要交付物**

- GEOX TargetContextProvider mapping；
- State/Forecast/Outcome/ResultSink mapping as applicable；
- semantic translation audit；
- no-core-dependency regression。

**Positive acceptance**

- ADR core 不理解 MCFT/CAP/KBS/T3R1；
- GEOX-specific semantics 只存在 adapter；
- GEOX adapter 删除后 core + non-GEOX acceptance 仍全通过。

**Forbidden / nonclaim acceptance**

- GEOX schema 变成 ADR public contract authority；
- adapter 将 10cm VWC 静默提升为 root-zone state；
- GEOX first-party 身份获得特殊 scientific authority。

**解锁**

- GEOX field-validation substrate 使用。

---

## MTL-P05 — Workbench Full Decision / Evaluation Surface

**目标**

在 Gate A Workbench 基础上扩展 RuntimePlan、InformationRequirement、Robustness、Decision、Outcome/Evaluation surfaces。

**对应 Capability**

- C22 full surface。

**Hard predecessors**

- MTL-A11；
- 对应 Gate R/D/E capabilities。

**主要交付物**

- runtime legality inspector；
- information acquisition queue；
- robustness alternatives inspector；
- Decision review；
- Outcome review；
- proposal review。

**Positive acceptance**

- UI 所有 action 调用相同 backend authority path；
- Why chain 可以跨 Control→Runtime→Evaluation；
- human approval/review actions 留完整 audit。

**Forbidden / nonclaim acceptance**

- UI 变成第二套 business logic；
- manual override 无 reason/audit；
- hidden admin shortcut 修改 immutable objects。

**解锁**

- enterprise user operations。

---

## MTL-P06 — Async Jobs / Idempotency / Operational Observability

**目标**

保证 compiler、resolution、evaluation 等异步过程在 retry/failure 下不破坏 authority semantics。

**对应 Capability**

- C23

**Hard predecessors**

- Gate F；
- 被运营的至少一个 async capability。

**主要交付物**

- job/run identity；
- idempotency keys；
- retry-safe authority creation；
- failure taxonomy；
- tenant-aware traces/metrics；
- exact authority refs in observability。

**Positive acceptance**

- retry 不 duplicate/mutate immutable authority；
- provider failure 与 scientific ineligibility 分开；
- trace 能回答哪个 Release/Profile/Manifest/Binding 产生事件。

**Forbidden / nonclaim acceptance**

- retry 覆盖历史失败记录；
- monitoring state 变成 agronomic evidence；
- logs 泄露 cross-tenant proprietary knowledge。

**解锁**

- production operation。

---

## MTL-P07 — Security / Secrets / Retention / Audit Export

**目标**

形成 enterprise knowledge-IP 与长期 replay 所需安全运营能力。

**对应 Capability**

- C23；
- C02 reinforcement。

**Hard predecessors**

- MTL-P06；
- Gate F。

**主要交付物**

- secret/connection isolation；
- tenant-aware retention；
- rights-aware artifact retention；
- audit export；
- security event logging；
- deletion/legal hold rules。

**Positive acceptance**

- tenant secret/data scope 隔离；
- audit export 可形成完整 authority chain；
- retention 不破坏 declared replay class；
- license/right constraints 可被执行。

**Forbidden / nonclaim acceptance**

- audit export 暴露其他 tenant knowledge；
- data deletion 默默破坏“EXACT replay”却不降级 replay status；
- customer knowledge 默认进入 cross-tenant training/inference。

**解锁**

- enterprise contract readiness。

---

## MTL-P08 — Production Recovery / Rollback / SLO / Incident Replay

**目标**

保证生产故障、rollout rollback 和 provider outage 下历史 authority 不被污染。

**对应 Capability**

- C23

**Hard predecessors**

- MTL-P06；
- MTL-P07；
- 目标 production slice 的 core capabilities。

**主要交付物**

- backup/restore；
- deployment suspend/rollback；
- incident replay；
- SLO/latency/error budgets；
- rate/quota/cost attribution；
- disaster recovery acceptance。

**Positive acceptance**

- rollback 不删除/改写历史 Binding/Decision；
- incident 可回溯 exact authority refs；
- provider outage、runtime failure、ABSTAIN 被正确分类；
- restore 后 semantic hashes/lineage 一致。

**Forbidden / nonclaim acceptance**

- rollback = database rewind 丢失历史 authority；
- ABSTAIN 作为 generic 500 error；
- feature flag 静默改变 Model/Policy/Knowledge semantics。

**解锁**

- **Gate P**。

---

## Gate P — Enterprise Productization

Gate P 不是要求所有 C00–C23 必须同时在第一个商业版本出现，而是：

> 对目标 commercial slice 所依赖的 core gate，C21/C22/C23 对应产品化任务必须同时闭合。

典型 Gate A commercial product 至少需要：

```text
Gate A
+ MTL-P01/P02
+ MTL-P03
+ MTL-A11
+ production-targeted subset of MTL-P06/P07/P08
```

完整 Decision/Evaluation enterprise product 再追加 Gate D/E 与 MTL-P05。

---

# 12. Task Dependency Matrix

| Task | 主要 Capability | Hard predecessor | 条件前置 | 主要 Gate |
|---|---|---|---|---|
| MTL-F01 | C00 | Architecture/Capability Map | — | F |
| MTL-F02 | C01 | F01 | — | F |
| MTL-F03 | C02 | F02 | — | F |
| MTL-K01 | C03 | Gate F | — | K |
| MTL-K02 | C03 | K01 | — | K |
| MTL-K03 | C04 | K02 | — | K |
| MTL-K04 | C04 | K03 | — | K |
| MTL-K05 | C05 | K04 | — | K |
| MTL-K06 | C05 | K05 | — | K |
| MTL-A01 | C07 | Gate F | — | A |
| MTL-A02 | C06 | Gate F | — | A |
| MTL-A03 | C06 | A02 | — | A |
| MTL-A04 | C06 | A01,A02,A03 | — | A |
| MTL-A05 | C13 | Gate K | S01/S03/S04 as used | A |
| MTL-A06 | C13 | A05 | — | A |
| MTL-A07 | C08 | Gate K,A01,A05,A06 | A04 if retrieval uses target context | A |
| MTL-A08 | C09 | Gate K,A01,A04,A07 | S01/S04 as used | A |
| MTL-A09 | C09/C10 | A08,S01 | — | A conditional |
| MTL-A10 | C22 | A08,A06 | — | A |
| MTL-A11 | C22 | K03-K06,A04,A07,A08,A10 | — | A |
| MTL-S01 | C10 | Gate F,A02 semantic basis | — | R/D parallel |
| MTL-S02 | C11 | S01 | — | D parallel |
| MTL-S03 | C11 | S01,S02 | — | D parallel |
| MTL-S04 | C12 | Gate F,S01 | S03/A04 as used | R/D parallel |
| MTL-R01 | C14 | Gate A | S01/S03/S04 as used | R |
| MTL-R02 | C15 | R01 | — | R |
| MTL-R03 | C15 | R01,R02 | S03/S04 as used | R |
| MTL-D01 | C16 | Gate R | S03/S04 as used | D |
| MTL-D02 | C17 | D01,S03 | — | D |
| MTL-D03 | C17 | D02 | — | D |
| MTL-D04 | C18 | R01,D01,D03 | — | D |
| MTL-D05 | C18 | D04 | — | D |
| MTL-D06 | C19 | D05,A01 | S01 Policy as used | D |
| MTL-E01 | C20 | F,A02,D01 when ADR-bound | D06 if ADR decision | E |
| MTL-E02 | C20 | E01 | — | E |
| MTL-E03 | C20 | E02 | — | E conditional causal |
| MTL-E04 | C20 | E02 | E03 if causal claim | E |
| MTL-P01 | C21 | Gate F + exposed domain task | — | P |
| MTL-P02 | C21 | P01 | — | P |
| MTL-P03 | C00/C21 | P02 + Gate A surface | — | P |
| MTL-P04 | C21 | P02,P03 | — | P/GEOX |
| MTL-P05 | C22 | A11 + relevant R/D/E | — | P |
| MTL-P06 | C23 | Gate F + operated capability | — | P |
| MTL-P07 | C23/C02 | P06 | — | P |
| MTL-P08 | C23 | P06,P07 + production slice | — | P |

---

# 13. 可并行实施波次

本节只说明依赖允许的并行度，不是版本切片。

## Wave 0 — Repository/Authority Foundation

```text
MTL-F01 → F02 → F03
```

这条链应最先闭合，因为所有 B2B scientific authority 都依赖它。

## Wave 1 — 三条并行 Authority Track

Gate F 后可以并行：

```text
Knowledge:
K01 → K02 → K03 → K04 → K05 → K06

Context/Problem:
A01
A02 → A03
A01 + A02 + A03 → A04

Specifications:
S01 → S02 → S03
S01 → S04 (按需要)
```

其中 A04 complete acceptance 必须等待 A01，符合 `ContextManifest requires exact DecisionProblem`。

## Wave 2 — First Commercial Applicability Closure

Gate K 与 A01/A04 后：

```text
A05 → A06
K06 + A01 + A06 → A07
A04 + A07 → A08
A08 → A10 → A11
A09 only if governed-transform claim is included
```

闭合 **Gate A**。

## Wave 3 — Runtime Legality

```text
Gate A
→ R01
→ R02
→ R03
```

按 exercised path 注入 S01/S03/S04，闭合 **Gate R**。

## Wave 4 — Decision Runtime

```text
Gate R
→ D01
→ D02
→ D03
→ D04
→ D05
→ D06
```

闭合 **Gate D**。

## Wave 5 — Evaluation

```text
E01 → E02 → E04
             └→ E03 when causal attribution is claimed
```

闭合 **Gate E**。

## Wave P — Productization（贯穿推进）

P01/P02 可以在 public domain contract 稳定后逐步展开；P03 必须在 P04 之前优先完成，以证明非 GEOX independence；P06–P08 随目标 commercial slice 深化，不应等所有 domain capabilities 完成后才开始。

---

# 14. Gate A 的商业验证边界

Master Task Line 明确把第一条 commercial proof 放在 Gate A，而不是 Gate D。

Gate A 可被真实客户验证的价值是：

```text
Company Agronomy
       +
Thousands of Target Contexts
       ↓
ADR Applicability
       ↓
No-review candidate flow
Review-required flow
Unknown / Conflict / Calibration-required flow
       ↓
Agronomist Workbench
```

商业测量允许包含：

```text
manual review rate
minutes / target
fields or cases / agronomist / day
acres / agronomist
escalation precision
false-safe rate
knowledge-conflict resolution time
```

这些 KPI 的**阈值**不属于本 Master Task Line；它们必须在后续 Version Slicing / Commercial Gate 文档中按具体 pilot 冻结。

永久区分：

```text
Capability PASS
≠ Commercial KPI PASS
≠ Scientific validity
```

如果 Gate A 技术闭合但不能显著减少 routine agronomist workload，产品商业假设可以失败，而 Architecture 不因此自动错误。

---

# 15. 每个 Implementation Task 的 PR 验收模板

后续从本 Master Task Line 派生实际 implementation PR 时，每个 PR/Task acceptance 至少回答：

```text
Task ID:
Capability closure:
Exact main baseline:
Authority objects touched:
Hard predecessors satisfied:
Conditional predecessors exercised:
Positive acceptance evidence:
Forbidden/nonclaim acceptance evidence:
Replay/idempotency evidence where applicable:
Tenant/IP evidence where applicable:
Known limitations:
What this task explicitly does NOT prove:
```

禁止使用：

```text
“tests pass”
“build green”
“API returns 200”
“demo looks correct”
```

作为单独 capability closure 证据。

---

# 16. Master Task Line 完整性检查

当前任务线已覆盖 Capability Map C00–C23：

```text
C00 → F01 / P03 independence regression
C01 → F02
C02 → F03 / P07 reinforcement
C03 → K01/K02
C04 → K03/K04
C05 → K05/K06
C06 → A02/A03/A04
C07 → A01
C08 → A07
C09 → A08/A09
C10 → S01
C11 → S02/S03
C12 → S04
C13 → A05/A06
C14 → R01
C15 → R02/R03
C16 → D01
C17 → D02/D03
C18 → D04/D05
C19 → D06
C20 → E01/E02/E03/E04
C21 → P01/P02/P03/P04
C22 → A10/A11/P05
C23 → P06/P07/P08
```

Final Planning Adjudication 的三项关键 separation 也在 Task Line 中保持：

```text
Gate A: Applicability / Agronomist Escalation
Gate R: Runtime Legality
Gate D: Decision Runtime
```

以及：

```text
Detect CALIBRATION_REQUIRED ≠ Satisfy CALIBRATION_REQUIRED
Context contract implementation may precede DecisionProblem,
but complete ContextManifest capability may not
Minimal RuntimeProfile does not force unexercised Model/Policy/Implementation/Calibration authority
```

没有发现需要重新打开 Architecture v1.0 的 dependency contradiction。

---

# 17. 本文明确不做 Version Slicing

本文故意不定义：

```text
v0.1
v0.2
MVP
Beta
GA
```

也不决定：

- 第一个版本是否实现全部 Gate F/K/A；
- 哪些 Task 合并到一个 milestone；
- 哪些 package/service/database 先创建；
- 第一个客户 pilot 的 KPI 阈值；
- 首发云部署/区域/定价。

这些属于下一阶段：

```text
ADR-VERSION-SLICING-01
```

Version Slicing 必须以“闭合用户价值 + capability gate + commercial proof”为单位，而不是按 Task 数量平均切。

---

# 18. 下一 Frontier

当本 Master Task Line 被审查并冻结后，下一 planning frontier 为：

```text
ADR-VERSION-SLICING-01
```

版本切分时应优先回答：

1. 哪个最小 slice 能第一次真实证明 `Agronomy Applicability / Agronomist Escalation` 商业价值；
2. 哪些 Foundation/Knowledge/Context capabilities 必须 production-grade，哪些可以受限 fixture/pilot-grade；
3. Gate A pilot 如何定义 false-safe、review workload、explainability 与 customer integration acceptance；
4. Gate R/D/E 哪些延后而不制造架构债务；
5. 第一个版本需要什么程度的 C21/C22/C23 产品化能力。

在 Version Slicing 冻结之前，不应从本文件机械创建几十个并行 implementation PR。首先冻结“第一个要证明的用户价值闭环”，再选择本 Master Task Line 中实际进入该版本的 Task 集合。
