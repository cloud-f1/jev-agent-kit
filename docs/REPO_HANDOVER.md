# Jev × Claude Code：Repo 研究與實作交接

研究日期：2026-10-09（Asia/Taipei）
狀態：可交給 repo coding agent 的研究、架構決策與實作規格；不是已驗證可安裝的成品。

## 1. 目標與決策

目標是降低每個成功任務的總成本，同時維持首次通過率、最終成功率與合理的 P95 完成時間。不可把 Jev 的低單價、壓縮比例或 GitHub 星數當作整體效益證明。

建議產品名稱：`jev-agent-kit`。

採「可安裝 Claude Code plugin／mod + 隨附操作 skill + 可攜核心」；不要只複製 SKILL.md 到每個專案。

| 層 | 職責 | 升級方式 |
|---|---|---|
| Core | 型別、問題、輸出驗證、策略、快取鍵、Log 抽取與循環判斷 | 同一來源與版本化 release |
| Claude Code Mod | 接收事件、调用 API、選子 Agent 模型、修改工具結果、顯示狀態 | plugin marketplace |
| Classic Hook adapter | 不支援 Mod 時的部分功能後備 | 同一 plugin，與 Mod 互斥啟用 |
| 操作 Skill | 設定、診斷、解釋決策、評估指引 | 隨 plugin 升級 |
| CLI | doctor、mock demo、live smoke、config validation、benchmark | 第二條分發路徑，後續 npm 發布 |
| Consumer repo config | 專案功能開關、路徑與閾值 | 每個 repo Git 管理 |

「install」是分發方式，「skill」是操作指引；兩者不是互斥選項。Skill 不保證每次事件執行，也不應是 runtime 的必要前提。

目前沒有目標 repo URL、checkout、使用者 Claude Code 版本或 Jev key。本文件中的目錄、設定及指令除明確標示官方用法外，都是待實作契約。不得宣稱已安裝、已跑通或已節省成本。

## 2. 前文已確認與必須修正的內容

- Jev 官方 endpoint：`POST https://api.typesafe.ai/v1/systemone`。
- Request 使用 `state`、`model`、`questions`；不是 `/jev/classify`、`/jev/boolean`。
- `choice` 回傳選項與機率分布；`noul` 回傳 yes 機率；`score` 依有序 rubric 回傳加權尺度值。
- `score` 不保證在 0–1；confidence、風險與答對率不可混用。
- Jev 不生成自由文字；分類失敗原因後的建議由本地固定模板提供，摘要需要抽取原文或另用生成模型。
- 查證時官方模型為 `jev-1.13.0`，input 為 US$0.042／百萬 tokens、output 免費。部署前重新查價格、版本、限制。
- 官方表示英文能力最佳，中文需求與英文 code 混合必須單獨評估。
- Classic PreToolUse matcher 使用工具名 `Bash`，不是 `tool == 'Bash'`。
- Classic Hook 原稿的 stderr + exit 1 不阻擋；阻擋需 exit 2 或有效 deny JSON。
- Context 注入使用事件對應的 `hookSpecificOutput`，不能沿用原稿頂層 JSON。
- 工具名稱使用 `Read`、`Grep`、`Glob`；模型用帳號可用 alias／ID，不能假定舊 Haiku ID 可用。
- 新版 PostToolUse 有 `updatedToolOutput`；替換須符合工具輸出 schema，僅 additionalContext 不會刪掉原輸出。
- 子 Agent frontmatter 不是不可覆寫的強制模型策略；檢查實際 resolved model。
- 40–60% API 節省、70% KV cache 降幅、0.2–0.3 秒保證皆無本專案實測支持，刪除這些保證。

官方來源：

- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/models
- https://docs.typesafe.ai/confidence
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/prompt-caching

## 3. GitHub 研究：支持可行性，不等於效果已證明

研究深度：已讀專案首頁 README／目錄，另讀 fast-jev-compaction 的 hooks/README。未 clone、未執行第三方測試、未完成源碼或 license audit；部分 source 檔抓取失敗。下表是專案描述與設計啟發，不是獨立復現结果。

| 專案與來源 | 已讀內容支持的方向 | 本專案採用的啟發 | 證據限制 |
|---|---|---|---|
| [typesafe-ai/typesafe-sdk-js](https://github.com/typesafe-ai/typesafe-sdk-js) | 官方 TypeScript SDK、typed requests／answers | CLI 可優先用官方 SDK；Mod 用獨立注入 transport | 官方 client 不證明 coding 收益；SDK 更新需契約測試 |
| [typesafe-ai/skills](https://github.com/typesafe-ai/skills) | 官方 agent skill 分發 | 將 API 知識与運作程式分開 | Skill 教 agent 使用 API，不是自動路由器 |
| [dr-dimitru/claude-jev-plugin](https://github.com/dr-dimitru/claude-jev-plugin) | Classic Hook gate、失敗分類、shadow、global/project config、cache | 固定本地建議、批次原子問題、no-verdict 不當 clear、禁止 project 改 endpoint | semantic guardrail 非 sandbox；README 的預設門檻不移植為已校正門檻 |
| [NiazMorshed2007/jev-review](https://github.com/NiazMorshed2007/jev-review) | 本地 MCP、多維品質訊號、主 agent 負責改 code | 聚焦一個工具；用 focused diff；比較前後變化 | 分數沒有自由文字原因；不能用高分替代測試或安全審查 |
| [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | Jev 選保留項、原文保存、Mod adapter、失敗回到原 compaction | 原文優先、薄 adapter、輸出可恢復 | 使用較舊 2.1.274 function-hook 型別；目前 Mod reference 未承諾相同 compaction replacement schema，需版本驗證 |
| [TranBaVinhSon/jev-harness](https://github.com/TranBaVinhSon/jev-harness) | Agent SDK 工具排名、結果精簡、有限升級、shadow 與 benchmark 設計 | spill file、升級至多一次、分離便宜模型與 Jev 的增量收益 | Agent SDK hook 不是原生 Mod；README benchmark 流程不是已復現的改善結果 |
| [v-modal/awesome-jev-tools](https://github.com/v-modal/awesome-jev-tools) | 生態索引 | 持續發現新 adapter、eval 與 search 工具 | 索引僅 discovery，條目數與星數不作品質證据 |

本輪最直接支持的是「typed judgment + 本地策略 + 薄 integration adapter」。無足夠證據支持「全面接管 Claude Code 就必然省錢」。初期不直接 fork 整個第三方 plugin；優先借鑑設計，使用官方 wire contract。

補充研究：https://arxiv.org/abs/2609.37647 。分類 benchmark 可支持決策模型的研究價值，不能代替 coding benchmark。固定 0.5／0.7 門檻應在自己資料上校正。

## 4. 使用情境、優缺點與優先順序

| 情境 | 方法 | 收益機會 | 風險與限制 | 階段 |
|---|---|---|---|---|
| 長測試 Log | 本地去重、固定保留錯誤，Jev 評分其餘區塊，抽取原文 | 減少後續 input 與雜訊 | 重要證據被丟；需要 read-back | v0.1 MVP |
| 子 Agent 模型分流 | 工作標籤＋Jev 不確定分類，agent.spawn 選模型 | 主模型保持穩定、便宜任務減費 | 重做、覆寫、fallback 變貴 | v0.2 |
| 循環偵測 | 命令／輸出／repo 狀態指紋，Jev 判斷進展 | 減少重複失敗 | 合理驗證也可能重複 | v0.1 observe；v0.2 行動 |
| 主模型／effort 路由 | 只在任務階段選一次，最多一次升級 | 複雜任務保留能力 | cache 冷啟動、不同 provider 行為 | v0.3 |
| 候選 code／tool 排序 | rg／symbol／檢索先產生候選，Jev 重排 | 大 repo 降低無關 context | 漏掉依賴、額外 latency | v0.3 |
| PR 審查深度 | 本地強制敏感路徑，Jev 補充分流 | 昂貴審查集中重要變更 | 漏判、PR 脈絡不足 | v0.3，獨立 CI adapter |
| 命令風險 | 本地權限為底線，Jev 補充提示 | 取得語意風險訊號 | API 失敗、誤擋、mod chain 交互 | 後續選配 |
| 成本決策面板 | 使用量、latency、cache、read-back、override | 可觀察、可回復 | 估計不能冒充實際節省 | v0.1 CLI status；v0.2 UI |

## 5. 建議來源 repo 結構

以下為待建立結構，不代表目前交付包含程式。

```text
jev-agent-kit/
  .claude-plugin/
    plugin.json
    marketplace.json
  hooks/
    register.ts
    classic/                 # fallback adapter，與 Mod 互斥
  core/
    contracts.ts
    validation.ts
    questions.ts
    policy.ts
    log-pruning.ts
    loop-detector.ts
    cache.ts
  cli/
    doctor.ts
    smoke.ts
    demo.ts
  schemas/
    project-config.schema.json
  presets/
    node-web.json
    python-service.json
    sre-ci.json
  examples/
    consumer-project/.claude/jev-agent-kit.json
  tests/
    fixtures/
    core.test.ts
    mod.test.ts
  evals/
    tasks/
    run.ts
    report.ts
  docs/
    architecture.md
    privacy.md
    compatibility.md
    install.md
    sources.md
  skills/                   # 後續依 repo 的 skill 規範建立
    operate/
  package.json
  package-lock.json
  CHANGELOG.md
```

技能的實際 frontmatter、命名與安裝方式由 repo agent 依當前官方規範產生。本交接文件不假裝是可直接安裝的 SKILL.md。

## 6. Mod 相容性：先驗證再接線

- 記錄 `claude --version`、Node 版本、OS、模型 provider 與可用模型；缺 CLI 時 core mock 仍可執行。
- 建一個最小 Mod，用 `claude --plugin-dir ./jev-agent-kit` 載入；實際路徑由 checkout 決定。
- 用實際安裝版本生成的 `.claude-plugin/types/` 為型別依據，不猜工具結果 shape。
- 事件候選：`tool.call`、`agent.spawn`、`turn.step`、`session.measure`、`ui.render`。
- `turn.step` 是 async generator；遵循 streaming 回傳方式。
- Core 是純函式／一般資料，不知道 `$`。
- Mod 的網路呼叫使用 `$.http.fetch`，檔案使用 `$.fs`，timer 使用 `$.clock`。
- 不在 Mod 直接 import npm SDK、Node fs、process 或 global fetch；CLI 才使用 Node／官方 SDK。
- 呼叫 mods API 的程式留在 register module 的可靜態分析函式中。不要把 `$` 傳給 imported helper；可以把普通 request／response 資料交給 core。
- `on` event 使用字串 literal，mods API 用完整 namespace；adapter 靜態驗證可能禁止 alias／dynamic import。
- `tool.call` 前置判斷呼叫 next 之前；輸出精簡在 await next 之後。失敗回傳原結果，不能再執行有副作用的命令。
- classic hook 和 Mod 不同時處理同一事件，避免重複 API、雙重 rewrite、重複提示。
- 全歷史 compaction 改写暫不做。第三方舊型別與當前 reference 不一致時，以安裝版本型別與實際測試為準。

官方參考：

- https://code.claude.com/docs/en/plugins/mods/create
- https://code.claude.com/docs/en/plugins/mods/events
- https://code.claude.com/docs/en/plugins/mods/api
- https://code.claude.com/docs/en/plugins/mods/reference
- https://code.claude.com/docs/en/plugins/manifest-reference

## 7. 設定、多專案與升級契約

全域安裝共用 runtime；每個專案僅提交 `.claude/jev-agent-kit.json`。先完成單 package，功能成熟才拆 monorepo 或另發 core npm package。

設定 precedence：內建 defaults → 可信 user/global settings → 允許的 project settings → session override。組織禁止與最低安全要求不可被後層放寬。

Project config 範例（自訂契約，待 schema 實作）：

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "mode": "observe",
  "preset": "sre-ci",
  "features": {
    "logPruning": true,
    "loopDetection": true,
    "subagentRouting": false,
    "mainModelRouting": false,
    "semanticGuard": false
  },
  "logPruning": {
    "minimumChars": 8000,
    "maxStateChars": 16000,
    "preserveErrorBlocks": true,
    "preserveOriginal": true
  },
  "loopDetection": {
    "repeatedFingerprintCount": 3,
    "action": "observe"
  }
}
```

上述數值是實驗起點，不是校正結果。mode 語意：observe 只記錄；assist 允許輸出精簡等已驗證動作並顯示狀態；enforce 僅針對明確啟用的政策。observe 仍可能呼叫 API、送資料與付費；dry-run/mock 才是零外部請求。大 Log 超出 state 上限時先本地篩選，不任意只取開頭。

Project 不得指定 endpoint、API key、credential file、傳输授權、任意 shell command、取消敏感路徑保護；避免不可信 repo 改写憑證目的地。

全域 key：`TYPESAFE_API_KEY`。不要放入 project JSON、追蹤的 settings、CLI 參數或 logging。全域可固定模型 `jev-1.13.0`；更新需重新校正。

升級規則：

1. runtime 用 SemVer，保留 changelog；schemaVersion、questionVersion、policyVersion、modelVersion 分開記錄。
2. 固定 lockfile；升級 dependency 用 PR，跑契約與故障測試。
3. Dev／canary 先更新，兩個 consumer repos 驗證後推 stable；由官方支持的 marketplace source/tag 機制選固定版本，不杜撰 install version 語法。
4. schema migration 先 dry-run、備份，保留 project override；不默默覆寫使用者設定。
5. rollback 恢復上一 release 與相容 config，舊版問題快取不重用。
6. 支援版本寫入 compatibility.md；不支持 Mod 時清楚降級，只啟用可驗證的 classic 功能。
7. 更新說明區分「修 bug」「改問題」「改門檻」「改模型」「增加資料外送」；後四者可能改變行為，不能當普通 patch。

## 8. Decision 與資料契約

```text
DecisionRecord:
  requestId, projectIdHash, feature, mode
  pluginVersion, schemaVersion, questionVersion, policyVersion
  requestedModel, actualModel
  verdict: accepted | uncertain | no_verdict | skipped
  action, reasonCode, probabilities, confidence?, rubricScore?
  latencyMs, inputTokens?, outputTokens?, estimatedJevCostUsd?
  cacheHit, reductionChars?, originalArtifactId?, readBackCount?
```

紀錄不含原始 code、prompt、命令、完整 log、key 或 HTTP response body。project hash 使用 local salt；不可宣稱 hashing 完全匿名。原始 Log 留本地受限儲存，設 TTL 與容量上限；opaque ID 映射到 artifact，read-back 驗證路徑與 project 範圍。

Jev wire smoke payload：

```json
{
  "model": "jev-1.13.0",
  "state": {"output": "Test checkout_total failed: expected 100, got 90"},
  "questions": {
    "failure_class": {
      "type": "choice",
      "instructions": "Classify the observed failure. Choose unknown if the evidence is insufficient.",
      "criteria": {
        "environment": "Dependency or environment problem",
        "code_bug": "Assertion or application behavior mismatch",
        "transient": "Temporary network or service failure",
        "unknown": "Insufficient evidence"
      }
    }
  }
}
```

輸出須驗證 question ID、type、選項、finite probabilities、分布與範圍；unknown／timeout／缺 key 都不轉成低風險。請求與 API 回應 byte size 也要限制。

Cache key 包含精確 request hash、project boundary、resolved model、問題與政策版本、有效設定；TTL 與容量限制。no-verdict 不作成功結果快取。故障時記錄短 reasonCode，不印 exception 原文。

熱路徑 deadline 可先測 1.5 秒與 3 秒，no automatic retries；這是可調候選，不是 Jev 延遲保證。離線 batch 可用有限 backoff，遵守 429／529。因 API limit 變動，避免硬編固定 concurrency 上限。

## 9. MVP 驗收與實驗

v0.1 必須完成：doctor、mock demo、choice live smoke、長 Bash Log 的 observe／assist、原文 read-back、決策 JSONL、config validation。loop 只觀察。主模型切換、安全 allow、全歷史改写、跨專案自動部署不在 MVP。

三／四組實驗：A 原始 agent；B 本地規則；C 便宜模型＋本地規則；D C＋Jev。相同 initial commit、任務、工具、驗收條件。先 10–20 smoke 任務，再至少 100 個代表任務；多次重跑並報不確定性。中文需求需獨立分層。

指標：總模型費（含主／子 agent、cache read/write、Jev 與重試）、成功任務成本、首次通過率、最終通過率、P50/P95 時間、timeout、no-verdict、read-back、漏證據與人為 override。

候選 release gate（產品選擇，非研究已成立）：每成功任務成本改善至少 10%，最終成功率下降不超過 2 個百分點，P95 增幅不超過 10%，固定錯誤證據完整保留。樣本不足或結果模糊就擴樣，不能用 gate 小樣本通過宣稱普遍有效。

必測：missing key、401、429、529、timeout、malformed JSON、缺 question、超大輸出、Unicode 引號、path traversal、成功／失敗／deny 工具結果、stderr、interrupted、重複呼叫但檔案已改、禁用功能零 API request、關閉 Mod 回到 baseline、read-back 恢復原文。

升級必測：舊 schema migration、失敗不覆寫、兩個專案 isolation、快取不跨 repo、question／model 改版失效、重載不重複 register、classic/mod 互斥、rollback。

API 失敗時：pruning 回傳原結果；routing 保留原模型；審查深度回到既有審查；guard 保留原權限且不能回傳新增 allow。一般 handler 出錯可能被 host 跳過，gating 需明確 .catch，仍不能替代硬權限。

## 10. Repo agent 執行指令：直接貼給 Claude Code／Codex

> 讀取本文件，把它當成需求與研究背景，不把設計假設當成當前 SDK API。先讀本 repo 的 AGENTS.md／CLAUDE.md，確認 worktree 與未提交變更，保留使用者內容。
>
> 在本 repo 建立 jev-agent-kit 的來源 package；如果已有 plugin package，整合而不重建。先完成 v0.1：共享 pure core、Claude Code Mod 薄 adapter、doctor、mock demo、live smoke、Log observe/assist、read-back、configuration schema、decision records。預設 observe，其他功能保持關閉。
>
> 先查 installed Claude Code version 與生成型別；Mod API 不相容時報清楚限制並提供 classic fallback。不要從第三方舊型別推定 compaction contract。用官方 /v1/systemone；Mod 的 I/O 使用 mods API，不能直接引用 Node SDK；CLI 可以用官方 SDK。core 接收普通資料與 transport，不接收 $。
>
> 缺 TYPESAFE_API_KEY 時繼續完成 mock、型別、測試與打包，live smoke 顯示 skipped 且 non-success 狀態，不可假裝 API 成功。只有 key 已由使用者配置且專案允許外送時執行小量 synthetic live smoke；不傳 repo 原始碼作 smoke。
>
> 研究參考專案時先記錄實際 commit SHA、license、release、README 與相關 code/test；不能只讀 awesome list；複用 code 保留授權。查證 CLI 指令與 manifest，不虛構 marketplace、發布網址或 npm 名稱已可用。
>
> 完成測試、claude plugin validate --strict、支援版本的 claude plugin test、最小 sandbox integration demo；確認模型與 Log 各成功/失敗 fallback。不具備 Claude CLI 時明確標示未跑 integration，不使用純 core test 代替。
>
> 提供 README 中真的存在的命令：mock demo、doctor、live smoke、test、build、validate、local --plugin-dir 載入。實作後以實際 package scripts 為準。建立兩個 consumer fixtures 展示 user 安裝同一版本＋project overrides。
>
> 在 docs 記錄目標/非目標、升級/rollback、資料流、compatibility、8 個 use cases、實驗結果；最後列出變更檔案、執行命令與結果、未完成事項及下一步。不要自動 publish、推送、部署或修改其他專案；本輪先產生可檢查與本機可跑的 package。

## 11. 發布後的使用方式

開發期用官方 `claude --plugin-dir <實際本機路徑>`；之後建立私有 marketplace，使用 `claude plugin marketplace add <實際 owner/repo>`、安裝到 user scope 供多專案共用。正式 install/update 指令由 repo agent 查證當前 CLI 並將真實 identifiers 寫入 README。

每個 consumer repo 僅提交 project config；不要複製 core／Mod source。CI 可 project scope 固定版本，個人端可 user scope；確保同一 session 不雙重載入同名 plugin。

Skill 的任務是指引 agent 診斷與操作既有 runtime；設定查詢、mode 切換等固定工作可由 Mod 原生命令執行，避免為單純 status 再啟動昂貴 model turn。

## 12. 本交付確認

- 已完成：前文整合、官方介面來源、7 個 GitHub 參考、8 個情境比較、安裝／skill 決策、可攜核心、設定、升級／rollback、MVP 與驗收、repo agent 指令。
- 未完成：目標 repo 修改、第三方程式實測、本專案 runtime 實作、Claude Code load、Jev live API、benchmark、發布。
- 第一個成功標準：repo agent 依本文件建成可用 mock 啟動與 Log read-back 的 v0.1，再逐步證明 Jev 相對於本地規則的增量收益。

## 13. 更新：可下載執行包與評估機制

新增 `jev-agent-kit-v0.1.0.zip`，內含 Python 3.10+ stdlib core、classic Hook adapter、合併安裝器、Log pruning/read-back、循環觀察、API smoke、mock/live Log benchmark、真實任務配對報告器、測試與 SESSION.md。

實作先用可測的 classic fallback，尚未實作 native Mod、模型分流或 Agent 任務自動 runner；不能把它們標為已跑通。沒有 Claude CLI／Jev key，host 和 API integration 留待使用者 session。原規格的 TS Core 與完整分層 config 是後續架構方向；本版 Python runtime 的有效 config 以 README／core.config 為準。

新增兩層評估：log_proxy 衡量字元縮減、gold evidence／error 保留、分類 latency；agent_task 衡量獨立驗收、完整成功／失敗費用、first pass、P50/P95、retry。禁止把 log_proxy 混到 agent_task。

Agent task 預先登記 manifest，baseline/local/jev 每 task 多次重跑。報告以 task cluster bootstrap 產生 cost ratio 與 pass-rate delta 95% CI，並額外比較 jev_vs_local。缺run、模型／版本／verifier混雜、重複run、非有限數值都拒絕或標未完成。失敗成本保留；unknown費用不能GO；零成功成本無定義，不填0。

候選gate：至少100個unique tasks、3 repeats，成本CI上界≤0.90、成功率差CI下界≥-0.02、P95比≤1.10、關鍵證據全部通過。報告區分 GO／NO_GO／INCONCLUSIVE／INSUFFICIENT_EVIDENCE／UNKNOWN_COST／INCOMPLETE。數值是可修改產品政策，不是已證明的改善。

API key：套件提供 `.env.example`，複製為 `.env.local` 在本機填 TYPESAFE_API_KEY。CLI 顯式 `--env-file`；Hook session 用可信環境 JEV_ENV_FILE 或 TYPESAFE_API_KEY。不得把key貼進對話或提交repo。缺key smoke exit3，其他mock仍可跑。

下一個Claude session先讀套件SESSION.md，執行mock／tests／doctor，再用使用者key做synthetic live smoke，驗證host schema後接入目標repo與paired smoke。正式付費大樣本要先有具體預算。
