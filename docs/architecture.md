# 葫芦兄弟 Multi-Agent 架构设计

## 1. 世界观与核心隐喻

| 隐喻 | 系统概念 | 说明 |
|------|---------|------|
| 爷爷 | 外部调用方 / Orchestrator | 发起任务、审批决策、不在 agent 进程内部 |
| 葫芦兄弟 | Agent（能力模块） | 各有 persona + skills + model，独立运行 |
| 葫芦山 | Runtime（调度层） | 注册兄弟、路由任务、管理生命周期 |
| 炼丹炉 | LLM Adapter | 统一的模型调用层，支持多模型路由 |
| 如意 | MessageBus | 兄弟间异步通信管道 |
| 宝葫芦 | StateStore | 跨 run 持久化状态 |

---

## 2. 总体架构图

```
                          ┌─────────────┐
                          │   爷爷       │
                          │ (外部调用方)  │
                          └──────┬──────┘
                                 │  CLI / API / Cron
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                        葫芦山 · Runtime                          │
│                                                                  │
│  ┌────────────┐   ┌─────────────────────────────────────────┐   │
│  │ Dispatcher  │──▶│          Brother Registry               │   │
│  │ (任务路由)   │   │                                         │   │
│  └─────┬──────┘   │  erwa   sanwa   siwa   wuwa  liuwa qiwa│   │
│        │          └──┬──────┬──────┬──────┬──────┬─────┬────┘   │
│        │             │      │      │      │      │     │        │
│        ▼             ▼      ▼      ▼      ▼      ▼     ▼        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    MessageBus (如意)                       │  │
│  │          兄弟间异步通信 · 事件发布/订阅                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│        │                                                        │
│        ▼                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ LLM      │  │ State    │  │ Infra    │  │ Skill         │  │
│  │ Adapter  │  │ Store    │  │ (retry,  │  │ Registry      │  │
│  │ (炼丹炉) │  │ (宝葫芦) │  │  env…)   │  │ (能力注册表)   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
│        │                                                        │
│        ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Model Router                                             │   │
│  │  erwa → haiku (快+省)    siwa → sonnet (精准执行)          │   │
│  │  sanwa → sonnet (安全审计) wuwa → haiku (批量处理)          │   │
│  │  qiwa → sonnet (知识推理)                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
         │              │               │
         ▼              ▼               ▼
   ┌──────────┐  ┌───────────┐  ┌───────────┐
   │  Gmail   │  │  Slack    │  │  Calendar  │
   │  API     │  │  API      │  │  API       │
   └──────────┘  └───────────┘  └───────────┘
```

---

## 3. 兄弟档案

### 3.1 全员一览

| 兄弟 | 代号 | 能力隐喻 | Agent 职责 | 默认模型 | 状态 |
|------|------|---------|-----------|---------|------|
| 大娃 | `dawa` | 力大无穷 | 总协调员：跨兄弟任务编排与冲突仲裁 | opus | 规划中 |
| 二娃 | `erwa` | 千里眼顺风耳 | 信息采集与汇报（Gmail, Slack, RSS…） | haiku | **已实现** |
| 三娃 | `sanwa` | 铜头铁臂 | 安全守卫：隐私过滤、内容脱敏、合规审查 | sonnet | 规划中 |
| 四娃 | `siwa` | 喷火 | 主动执行：发草稿、打标签、归档、回复 | sonnet | 规划中 |
| 五娃 | `wuwa` | 吸水喷水 | 数据净化：摘要、翻译、格式化、去重 | haiku | 规划中 |
| 六娃 | `liuwa` | 隐身 | 后台调度：定时任务、静默监控、触发器 | — (无 LLM) | 规划中 |
| 七娃 | `qiwa` | 宝葫芦 | 知识存储：归档、检索、跨 run 记忆、RAG | sonnet | 规划中 |

### 3.2 模型选择原则

```
任务复杂度低 + 吞吐量大  →  haiku   (二娃采集、五娃批量处理)
任务需精确判断 + 有副作用  →  sonnet  (三娃安全、四娃执行、七娃知识)
跨兄弟编排 + 高层推理     →  opus    (大娃协调)
纯调度 / 无需推理        →  不调 LLM (六娃)
```

每个 Brother 的 `modelId` 可在配置中覆盖，运行时由 Model Router 解析。

---

## 4. 核心接口定义

### 4.1 Brother 接口

```typescript
interface Brother {
  name: string;              // "erwa"
  displayName: string;       // "二娃·千里眼顺风耳"
  persona: string;           // System Prompt 人设文本
  modelId?: string;          // 覆盖默认模型，如 "claude-haiku-4-..."
  skills: Skill[];           // 该兄弟具备的技能列表
  run(ctx: RunContext): Promise<BrotherResult>;
}
```

### 4.2 Skill 接口

```typescript
interface Skill {
  name: string;              // "gmail:fetch", "privacy:redact"
  description: string;       // 人类可读描述
  inputSchema: ZodSchema;    // Zod 校验入参
  outputSchema: ZodSchema;   // Zod 校验出参
  execute(input: unknown, ctx: SkillContext): Promise<unknown>;
}
```

### 4.3 RunContext（运行上下文）

```typescript
interface RunContext {
  runId: string;
  callerArgs: string[];
  bus: MessageBus;           // 兄弟间通信
  state: StateStore;         // 持久化状态
  llm: LLMAdapter;           // 已绑定该兄弟 model 的 LLM 客户端
  outputDir: string;         // 本次 run 的输出目录
}
```

### 4.4 MessageBus（如意·通信管道）

```typescript
interface MessageBus {
  // 发布消息给指定兄弟（或广播）
  emit(event: BusEvent): void;

  // 订阅特定事件类型
  on(eventType: string, handler: (event: BusEvent) => void): void;

  // 请求-响应模式：发消息并等待目标兄弟返回
  request(target: string, payload: unknown): Promise<unknown>;
}

interface BusEvent {
  source: string;            // 发送方兄弟 name
  target: string | "*";      // 接收方，"*" = 广播
  type: string;              // 事件类型，如 "data:ready", "review:request"
  payload: unknown;
  timestamp: string;
}
```

---

## 5. Skill 注册表

每个兄弟携带独立的 Skill 集合，Skill 是最小可执行单元。

### 5.1 二娃 Skills（信息采集）

| Skill 名 | 说明 | 外部依赖 |
|----------|------|---------|
| `gmail:list-unread` | 拉取 Gmail 未读邮件元信息 | Gmail API |
| `gmail:fetch-full` | 获取单封邮件全文 | Gmail API |
| `gmail:fetch-thread` | 获取邮件线程 | Gmail API |
| `intel:plan` | 基于元信息生成处理计划 | LLM |
| `intel:refine` | 结合全文细化计划 | LLM |

### 5.2 三娃 Skills（安全守卫）

| Skill 名 | 说明 | 外部依赖 |
|----------|------|---------|
| `privacy:redact` | PII 脱敏（邮箱、手机号、身份证…） | 正则 + LLM |
| `privacy:classify` | 内容敏感度分级（公开/内部/机密） | LLM |
| `compliance:check` | 合规审查（是否可转发/存储） | LLM + 规则引擎 |

### 5.3 四娃 Skills（主动执行）

| Skill 名 | 说明 | 外部依赖 |
|----------|------|---------|
| `gmail:draft` | 创建邮件草稿 | Gmail API |
| `gmail:reply` | 回复邮件（需确认） | Gmail API |
| `gmail:label` | 打标签 / 归档 / 标记已读 | Gmail API |
| `gmail:archive` | 批量归档 | Gmail API |

### 5.4 五娃 Skills（数据净化）

| Skill 名 | 说明 | 外部依赖 |
|----------|------|---------|
| `transform:summarize` | 邮件/文档摘要 | LLM |
| `transform:translate` | 多语言翻译 | LLM |
| `transform:format` | 格式转换（JSON→Markdown 等） | — |
| `transform:dedup` | 去重（跨线程/跨源） | LLM + 哈希 |

### 5.5 六娃 Skills（后台调度）

| Skill 名 | 说明 | 外部依赖 |
|----------|------|---------|
| `scheduler:cron` | 定时触发任务 | node-cron |
| `scheduler:watch` | 文件/API 变更监听 | fs.watch / polling |
| `scheduler:trigger` | 条件触发（满足规则时唤醒指定兄弟） | MessageBus |

### 5.6 七娃 Skills（知识存储）

| Skill 名 | 说明 | 外部依赖 |
|----------|------|---------|
| `memory:store` | 存储结构化知识条目 | SQLite / JSON |
| `memory:search` | 语义检索历史记录 | Embedding + 向量库 |
| `memory:context` | 为其他兄弟组装上下文窗口 | StateStore |

---

## 6. 协同流程

### 6.1 协同模式总览

```
┌──────────────────────────────────────────────────────────┐
│                    协同模式 (Patterns)                     │
├──────────┬───────────────┬───────────────┬───────────────┤
│ Pipeline │   Fan-out     │  Gate         │ Event-driven  │
│ 顺序管道  │   扇出并行     │  审批门控      │  事件驱动      │
│          │               │               │               │
│ A → B → C│   A ──┬── B   │   A ──▶ 三娃   │  六娃 timer   │
│          │      ├── C   │      审批 ✓    │    ↓          │
│          │      └── D   │      ↓ B      │  emit event   │
│          │       ↓      │               │    ↓          │
│          │   aggregate  │               │  二娃 wakeup   │
└──────────┴───────────────┴───────────────┴───────────────┘
```

### 6.2 典型流程：Gmail 智能处理（Pipeline + Gate）

这是当前二娃流程的未来完整版本，加入三娃审查和四娃执行。

```
 爷爷 (CLI / Cron)
  │
  │  huluwa erwa:gmail
  ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 1 — 二娃采集                                            │
│                                                              │
│  gmail:list-unread  →  intel:plan  →  gmail:fetch-full      │
│       ↓                   ↓               ↓                 │
│  未读元信息            处理计划         全文内容               │
│                                           ↓                 │
│                                     intel:refine            │
│                                       ↓                     │
│                                   细化计划                   │
└───────────────────────┬─────────────────────────────────────┘
                        │ bus.emit("data:ready")
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 2 — 三娃审查 (Gate)                                     │
│                                                              │
│  privacy:redact  →  privacy:classify  →  compliance:check   │
│       ↓                  ↓                    ↓             │
│  脱敏后内容          敏感度标记            合规判定            │
│                                               │             │
│                                    ┌──────────┴──────────┐  │
│                                    │ 通过?               │  │
│                                    │ YES → 放行          │  │
│                                    │ NO  → 标记+通知爷爷  │  │
│                                    └─────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ bus.emit("review:passed")
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 3 — 五娃净化                                            │
│                                                              │
│  transform:summarize  →  transform:translate (可选)          │
│         ↓                       ↓                           │
│     中文摘要                  翻译版本                        │
└───────────────────────┬─────────────────────────────────────┘
                        │ bus.emit("content:clean")
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 4 — 四娃执行                                            │
│                                                              │
│  对 requires_confirmation=true 的 action:                    │
│    → 生成草稿 (gmail:draft)                                  │
│    → 等待爷爷确认                                             │
│    → 确认后执行 (gmail:reply / gmail:label / gmail:archive)  │
│                                                              │
│  对 requires_confirmation=false 的 action:                   │
│    → 直接执行 (gmail:label 等低风险操作)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │ bus.emit("actions:done")
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 5 — 七娃归档                                            │
│                                                              │
│  memory:store  →  更新 StateStore  →  生成 run 报告          │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 典型流程：定时巡检（Event-driven）

```
┌───────────┐    timer tick     ┌───────────┐   bus.emit    ┌───────────┐
│  六娃      │ ────────────────▶ │  二娃      │ ───────────▶ │  三娃      │
│ scheduler │  "每30分钟检查"    │  采集      │  data:ready  │  审查      │
│ :cron     │                   │  gmail     │              │  gate     │
└───────────┘                   └───────────┘              └─────┬─────┘
                                                                 │
                                                          review:passed
                                                                 │
                                       ┌─────────────────────────┘
                                       ▼
                                 ┌───────────┐
                                 │  七娃      │
                                 │  归档记录   │
                                 │  memory    │
                                 └───────────┘
```

### 6.4 典型流程：大娃跨兄弟编排（Orchestration）

当任务涉及多个兄弟且顺序不确定时，由大娃（opus 模型）动态规划。

```
 爷爷: "处理这周所有未读邮件，重要的翻译成英文并存档"
  │
  ▼
┌──────────────────────────────────────────────────────┐
│  大娃 · 编排器                                        │
│                                                       │
│  1. 解析意图 → 拆分子任务                              │
│  2. 构建执行 DAG:                                     │
│                                                       │
│     二娃:gmail  ──┬──▶  三娃:审查  ──▶  五娃:翻译     │
│                  │                      ↓            │
│                  └──▶  五娃:摘要  ──▶  七娃:存档      │
│                                                       │
│  3. 按 DAG 调度执行                                    │
│  4. 聚合结果 → 汇报爷爷                                │
└──────────────────────────────────────────────────────┘
```

---

## 7. 运行机制

### 7.1 生命周期

```
                 register          dispatch           run
  ┌────────┐   ──────────▶  ┌──────────┐  ────────▶  ┌──────────┐
  │ 定义    │               │ 就绪      │             │ 运行中    │
  │ define │               │ ready    │             │ running  │
  └────────┘               └──────────┘             └────┬─────┘
                                                         │
                                          ┌──────────────┼──────────────┐
                                          ▼              ▼              ▼
                                    ┌──────────┐  ┌──────────┐  ┌──────────┐
                                    │ 完成      │  │ 等待确认  │  │ 失败      │
                                    │ done     │  │ waiting  │  │ failed   │
                                    └──────────┘  └─────┬────┘  └──────────┘
                                                        │ 爷爷确认
                                                        ▼
                                                  ┌──────────┐
                                                  │ 继续执行   │
                                                  │ resume   │
                                                  └──────────┘
```

### 7.2 单次运行流程（Run）

```typescript
// 伪代码：一次完整 run 的流程
async function executeRun(brotherName: string, args: string[]) {
  // 1. 查找兄弟
  const brother = registry.get(brotherName);

  // 2. 构建运行上下文
  const ctx: RunContext = {
    runId: makeRunId(),
    callerArgs: args,
    bus: createMessageBus(),
    state: loadState(),
    llm: createLLMAdapter({ model: brother.modelId }),
    outputDir: makeOutputDir(runId),
  };

  // 3. 注入 persona 到 LLM adapter
  ctx.llm.setSystemPrompt(brother.persona);

  // 4. 执行
  const result = await brother.run(ctx);

  // 5. 持久化
  saveState(ctx.state);
  writeOutput(ctx.outputDir, result);

  return result;
}
```

### 7.3 LLM Adapter（炼丹炉）

统一封装不同模型的调用，屏蔽底层差异。

```typescript
interface LLMAdapter {
  // 基础查询（当前已实现）
  query(prompt: string): Promise<string>;

  // 带 schema 约束的结构化输出
  queryStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T>;

  // 流式输出（后续）
  queryStream(prompt: string): AsyncIterable<string>;

  // 当前绑定的模型 ID
  readonly modelId: string;

  // 设置 system prompt（persona 注入点）
  setSystemPrompt(persona: string): void;
}
```

Model Router 根据 Brother 配置解析具体模型：

```typescript
// 配置示例
const MODEL_MAP: Record<string, string> = {
  dawa:  "claude-opus-4-...",      // 复杂编排
  erwa:  "claude-haiku-4-...",     // 快速采集
  sanwa: "claude-sonnet-4-...",    // 安全审计
  siwa:  "claude-sonnet-4-...",    // 精准执行
  wuwa:  "claude-haiku-4-...",     // 批量处理
  liuwa: "none",                   // 纯调度，不需要 LLM
  qiwa:  "claude-sonnet-4-...",    // 知识推理
};
```

### 7.4 StateStore（宝葫芦·跨 Run 状态）

```
output/
├── state.json                    # 全局状态（当前已实现）
├── latest/                       # 最近一次 run 的快照
├── runs/
│   └── <run_id>/                 # 每次 run 的完整输出
│       ├── plan.json
│       ├── refined-plan.json
│       ├── fetched.json
│       └── ...
└── memory/                       # 七娃的知识库（后续）
    ├── index.json                # 条目索引
    └── entries/                  # 知识条目
```

---

## 8. 目录结构（完整愿景）

```
src/
├── brothers/                     # 兄弟注册表 + 公共类型
│   ├── index.ts                  # Brother / Skill 接口 + BrotherRegistry
│   ├── registry.ts               # 注册所有兄弟的入口
│   └── personas/                 # System Prompt 人设
│       ├── erwa.ts               # 二娃：谨慎细致（已实现）
│       ├── dawa.ts               # 大娃：沉稳全局
│       ├── sanwa.ts              # 三娃：铁面无私
│       ├── siwa.ts               # 四娃：雷厉风行
│       ├── wuwa.ts               # 五娃：化繁为简
│       └── qiwa.ts              # 七娃：博闻强记
│
├── erwa/                         # 二娃 — 千里眼顺风耳
│   ├── gmail/                    # Gmail 数据源
│   │   ├── client.ts
│   │   ├── unread.ts
│   │   ├── full.ts
│   │   ├── compact.ts
│   │   └── utils.ts
│   ├── skills/                   # 二娃的 Skill 实现
│   │   ├── gmail-list-unread.ts
│   │   ├── gmail-fetch-full.ts
│   │   ├── intel-plan.ts
│   │   └── intel-refine.ts
│   └── index.ts                  # 二娃 Brother 注册
│
├── sanwa/                        # 三娃 — 铜头铁臂
│   ├── skills/
│   │   ├── privacy-redact.ts
│   │   ├── privacy-classify.ts
│   │   └── compliance-check.ts
│   └── index.ts
│
├── siwa/                         # 四娃 — 喷火
│   ├── skills/
│   │   ├── gmail-draft.ts
│   │   ├── gmail-reply.ts
│   │   ├── gmail-label.ts
│   │   └── gmail-archive.ts
│   └── index.ts
│
├── wuwa/                         # 五娃 — 吸水喷水
│   ├── skills/
│   │   ├── summarize.ts
│   │   ├── translate.ts
│   │   ├── format.ts
│   │   └── dedup.ts
│   └── index.ts
│
├── liuwa/                        # 六娃 — 隐身
│   ├── scheduler/
│   │   ├── cron.ts
│   │   ├── watch.ts
│   │   └── trigger.ts
│   └── index.ts
│
├── qiwa/                         # 七娃 — 宝葫芦
│   ├── skills/
│   │   ├── memory-store.ts
│   │   ├── memory-search.ts
│   │   └── memory-context.ts
│   └── index.ts
│
├── dawa/                         # 大娃 — 力大无穷
│   ├── orchestrator.ts           # 跨兄弟 DAG 编排引擎
│   └── index.ts
│
├── bus/                          # MessageBus 实现
│   ├── index.ts                  # MessageBus 接口
│   ├── local.ts                  # 进程内 EventEmitter 实现
│   └── persistent.ts             # 持久化队列实现（后续）
│
├── llm/                          # 共享 LLM 适配层
│   ├── index.ts                  # 导出
│   ├── adapter.ts                # LLMAdapter 接口 + 工厂
│   ├── claude.ts                 # Claude SDK 实现（已有）
│   ├── json.ts                   # JSON 解析工具（已有）
│   └── router.ts                 # Model Router — 按兄弟分配模型
│
├── infra/                        # 共享基础设施
│   ├── env.ts
│   ├── retry.ts
│   └── runid.ts
│
├── state/                        # 共享状态管理
│   ├── store.ts
│   ├── idempotency.ts
│   ├── show.ts
│   └── reset.ts
│
├── types.ts                      # 共享类型
└── cli.ts                        # 主入口（Dispatcher — 按兄弟名分发）
```

---

## 9. CLI 与调度

### 9.1 命令格式

```bash
# 统一入口
huluwa <brother>:<skill> [options]

# 示例
huluwa erwa:gmail                # 二娃 Gmail 采集（当前）
huluwa erwa:gmail --max=50       # 带参数
huluwa sanwa:redact --input=...  # 三娃脱敏
huluwa siwa:draft --plan=...     # 四娃起草
huluwa run:pipeline gmail-full   # 执行预定义 pipeline

# NPM scripts（兼容现有）
npm run demo:gmail               # = huluwa erwa:gmail
npm run erwa:gmail               # 显式指定兄弟
```

### 9.2 Dispatcher 逻辑

```typescript
// src/cli.ts — 主入口
async function main() {
  const [target, ...rest] = process.argv.slice(2);
  const [brotherName, skillName] = target.split(":");

  const brother = registry.get(brotherName);
  if (!brother) {
    console.error(`未知的兄弟: ${brotherName}`);
    process.exit(1);
  }

  const ctx = buildRunContext(brother, rest);
  await brother.run(ctx);
}
```

---

## 10. 配置体系

```
~/.config/huluwa-agent/
├── .env                          # 全局环境变量
├── config.yaml                   # 全局配置（后续）
│
├── credentials.json              # Google OAuth 凭证（当前）
├── token.json                    # OAuth token（当前）
│
├── erwa/                         # 二娃专属
│   ├── gmail-credentials.json
│   └── gmail-token.json
│
├── siwa/                         # 四娃专属（后续）
│   └── gmail-credentials.json    # 四娃需要写权限的独立凭证
│
└── models.yaml                   # 模型路由配置（后续）
```

`models.yaml` 示例：

```yaml
defaults:
  provider: anthropic
  timeout: 120000
  retries: 2

brothers:
  dawa:
    model: claude-opus-4-20250514
    maxTurns: 10
    temperature: 0.3
  erwa:
    model: claude-haiku-4-20250414
    maxTurns: 1
    temperature: 0.2
  sanwa:
    model: claude-sonnet-4-20250514
    maxTurns: 1
    temperature: 0.1
  siwa:
    model: claude-sonnet-4-20250514
    maxTurns: 3
    temperature: 0.2
  wuwa:
    model: claude-haiku-4-20250414
    maxTurns: 1
    temperature: 0.3
  qiwa:
    model: claude-sonnet-4-20250514
    maxTurns: 2
    temperature: 0.2
```

---

## 11. 安全与确认机制

### 11.1 操作风险分级

| 级别 | 说明 | 自动执行? | 示例 |
|------|------|----------|------|
| READ | 只读操作 | 是 | 拉取邮件、查询日历 |
| TAG | 元数据修改 | 可配置 | 打标签、标记已读 |
| WRITE | 创建内容 | 需确认 | 发草稿、创建事件 |
| SEND | 对外发送 | 必须确认 | 发邮件、发消息 |
| DELETE | 删除操作 | 必须确认 | 删邮件、退订 |

### 11.2 确认流程

```
四娃准备执行 SEND 操作
  │
  ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ 生成预览     │────▶│ 等待爷爷确认  │────▶│ 执行         │
│ (草稿/摘要)  │     │ (CLI/通知)   │     │ (调用 API)   │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │ 拒绝
                           ▼
                    ┌──────────────┐
                    │ 取消 + 记录   │
                    └──────────────┘
```

---

## 12. 从现状到愿景的演进路线

### Phase 0 — 当前（已完成）

- [x] 二娃 Gmail 采集 pipeline（plan → fetch → refine）
- [x] 二娃 persona 注入
- [x] 单模型 LLM 调用
- [x] 幂等状态管理
- [x] `brothers/personas/` 目录骨架

### Phase 1 — Brother 骨架

- [ ] 定义 `Brother` / `Skill` 接口（`src/brothers/index.ts`）
- [ ] 重构二娃为标准 Brother 实现
- [ ] 提取 LLM Adapter 接口，支持 `modelId` 路由
- [ ] CLI Dispatcher 支持 `brother:skill` 格式

### Phase 2 — MessageBus + 三娃

- [ ] 实现进程内 MessageBus（EventEmitter 方式）
- [ ] 实现三娃 `privacy:redact` skill
- [ ] 二娃 → 三娃 Pipeline 联通

### Phase 3 — 五娃 + 四娃

- [ ] 五娃 `transform:summarize` / `transform:translate`
- [ ] 四娃 `gmail:draft` + 确认机制
- [ ] 完整 Gmail Pipeline: 采集 → 审查 → 净化 → 执行

### Phase 4 — 六娃 + 七娃

- [ ] 六娃 cron 调度器
- [ ] 七娃 knowledge store + 语义检索
- [ ] 跨 run 记忆能力

### Phase 5 — 大娃编排

- [ ] 大娃 orchestrator（基于 opus 的动态 DAG 规划）
- [ ] 自然语言 → 子任务拆分 → 多兄弟协同
