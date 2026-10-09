# Jev Agent Kit v0.1.0

可執行的 Python 3.10+、零第三方依賴核心，包含 Claude Code **classic hook fallback**、Log 精簡／原文讀回、循環觀察、API smoke、offline/live Log 對照與真實任務配對報告。原生 Mod／模型分流留待目標 Claude Code 版本驗證後實作；不把 classic Hook 當作已完成 Mod。

## 從 marketplace 安裝（repo 推上 GitHub 後才有效）

```
/plugin marketplace add cloud-f1/jev-agent-kit
/plugin install jev-agent-kit --marketplace cloud-f1/jev-agent-kit
```

Plugin 預設 `defaultEnabled: false`：安裝後要明確啟用（`/plugin` 或 `claude plugin enable jev-agent-kit`），而且每個專案要有 `.claude/jev-agent-kit.json` 且 `enabled: true` 才會處理輸出。本機開發：`claude --plugin-dir /absolute/path/to/jev-agent-kit`。Plugin 與下方 `install` 指令二選一，不可同時用。授權：MIT。

## 先跑不用 key 的驗證

在解壓後的 `jev-agent-kit` 目錄執行：

```bash
python3 jev.py doctor
python3 -m unittest discover -s tests -v
python3 jev.py bench-logs --outdir results/offline
```

Windows 可將 `python3` 改成 `python`。Log demo 用 5 個合成 fixtures，mock Jev 是測試替身，**不證明真實 Agent 成功率、Jev 能力或帳單節省**。

## 放入你的 Jev API key

1. 複製 `.env.example` 為 `.env.local`。
2. 在本機編輯 `TYPESAFE_API_KEY=REPLACE_ME`，替換為你的 key。
3. 不要把 key 貼到 Claude 對話，也不要提交 `.env.local`。

```bash
python3 jev.py --env-file .env.local smoke
python3 jev.py --env-file .env.local bench-logs --live --outdir results/live-logs
```

`smoke` 只送合成文字；live Log benchmark 也只送合成 fixtures。缺 key／API 失敗 exit 3，不能當成功。Core 使用固定官方 HTTPS endpoint、不跟隨 redirect、不接受 repo 改 endpoint。輸出只記錄安全類別，不輸出 key 或 HTTP body。

## 接入一個專案

先用 rules backend observe，確認可運作；installer 合併既有 `.claude/settings.json`，保留其他 hooks，並建立備份。

```bash
python3 jev.py install --project /absolute/path/to/your-repo --backend rules --mode observe
python3 jev.py check-config --project /absolute/path/to/your-repo
```

接著修改該 repo `.claude/jev-agent-kit.json`：`backend` 改成 `jev`，先保持 `mode=observe`。observe 不替換輸出，但**會發 API request、外送篩選後的 Log、產生 API 費用**。enabled=false 才完全停用此 adapter。合成測試通過後再選 assist。

要讓 Claude session 的 hook 讀 key，在啟動 Claude 的 shell 設定 **可信全域環境變數**：

```bash
export JEV_ENV_FILE=/absolute/path/to/jev-agent-kit/.env.local
claude
```

PowerShell：

```powershell
$env:JEV_ENV_FILE = 'C:\absolute\path\jev-agent-kit\.env.local'
claude
```

亦可在 shell 直接設定 TYPESAFE_API_KEY。`JEV_ENV_FILE` 不放進 repo config。CLI 的 `--env-file` 只影響該 CLI 執行，不會自動讓另開的 Claude session 擁有 key。

Claude 啟動後用 `/hooks` 確認事件；以安全的長測試輸出試用。Host 必須支援 `updatedToolOutput`，否則先 observe 並交給 SESSION.md 驗證。此環境沒有 Claude CLI，僅驗證模擬 Hook schema，未驗證 host load。

## 讀回與觀察

```bash
python3 jev.py status --project /absolute/path/to/your-repo
python3 jev.py readback ARTIFACT_ID --project /absolute/path/to/your-repo
```

替換輸出末尾會提示 artifact ID。原始 Log 留本機受限檔案權限，預設儲存在 `~/.cache/jev-agent-kit/<project hash>/`；用 JEV_STATE_DIR 可改可信全域路徑。Windows 權限還需使用系統 ACL。原始 Log 可能含秘密；regex redaction 是 best effort，不保證移除所有敏感資料。TTL 清理由後續 Hook 執行觸發，不是背景服務。

循環功能僅記錄 hash 與 repeated_count，結合 git HEAD／tracked diff；不攔截、不重試、不切模型。Untracked／ignored 檔、環境與外部服務變化未完整涵蓋，不能拿此 count 當無進展證明。

## 真實 Agent 評估

讀 `docs/EVALUATION.md`。將真實完整任務記錄寫成 JSONL，不混入 log_proxy 或 mock 結果：

```bash
python3 jev.py report --manifest evals/agent-manifest.json --records results/agent-runs.jsonl --outdir results/agent-report
```

報告包含 baseline/local/jev、Jev 相對 local 的增量、任務 cluster bootstrap 95% CI、成功任務成本、首次通過率與 P95。缺任何預先登記 run 會回傳 INCOMPLETE；成本不完整不會產生 GO。

## 多專案与升級

將本套件放在一個穩定絕對路徑，對多個 repo 執行 install，每個 repo 僅保留 config 與 hook 設定，程式不複製。不要搬走套件後讓既有 hooks 指向不存在的路徑。保持固定路徑替換 release，或備份後明確更新各 repo hook 路徑。

Plugin manifest／hooks.json 已提供供後續 marketplace 打包，**不要同時用 installer 與 plugin-dir 啟動同一 adapter**。不提供假 marketplace URL 或未發布的 npm install 命令。

升級先跑測試、mock、Claude schema integration 與兩個 consumer repo；更改問題／模型需重跑對照。保留上一版本與 settings 備份供 rollback。完整研究背景見 docs/REPO_HANDOVER.md；下一個 Claude session 直接讀 SESSION.md。

## 目前驗證邊界

Core、CLI、mock與子程序 Hook 測試已執行；真實 Jev API、Claude host、native Mod、真實 Agent 任務成本與 marketplace 發布未執行。使用者需提供 key 與可用 Claude 環境。此 v0.1 是可測試的成本優化 fallback，不是安全 sandbox。urllib timeout 是 socket timeout，不是完整端到端 deadline；實際 Hook 另有15秒 host timeout，逾時須以 host 行為驗證。
