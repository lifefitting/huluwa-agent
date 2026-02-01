# huluwa-agent — Gmail 未读分拣器（TS）

## 背景 / Intro

“葫芦兄弟/爷爷”是一个多角色协作的世界观：爷爷负责协调与规则，兄弟们分工执行。当前实现主要是“二娃 erwa”，专注 Gmail 情报收集与未读邮件分拣/处置建议。

## 运行指南（单机）

### 1) 安装

```bash
cd ~/.repo/huluwa-agent
npm install
```

### 2) 配置（Gmail OAuth）

1. 在 Google Cloud Console 创建 OAuth Client（Desktop app）。
2. 下载 client JSON，放到本机配置目录：

```bash
mkdir -p ~/.config/huluwa-agent
cp ~/Downloads/client_secret_*.json ~/.config/huluwa-agent/credentials.json
```

可选环境变量（放 `~/.config/huluwa-agent/.env`）：
- `GMAIL_QUERY`
- `GMAIL_MAX_RESULTS`
- `IDEMPOTENCY`（默认 true）
- `STORE_RAW_FULL`（默认 false）
- `CLAUDE_MODEL`（可选）

### 3) 运行

```bash
cd ~/.repo/huluwa-agent
npm run demo:gmail
```

首次运行会打印授权链接；完成授权后会生成：
- `~/.config/huluwa-agent/token.json`

### 4) 产出（查看结果）

最新结果：
- `output/latest/unread.json`
- `output/latest/plan.json` / `output/latest/plan.md`
- `output/latest/refined-plan.json` / `output/latest/refined-plan.md`
- `output/latest/idempotency.md`（本次无新未读时）

历史记录：
- `output/runs/<run_id>/...`

状态：
- `output/state.json`（已处理消息 id）

## 运行逻辑（最小化说明）

- 读取 Gmail 未读元数据 → 生成计划 → 对 P0/P1 拉取更多证据 → 生成精炼计划。
- 默认开启“已处理跳过”（idempotency），避免重复分拣。

## Next

更多细节见 `docs/architecture.md`。
