# 測試清單（v0.6.1，繁體中文）

目的：用最安全的設定（只記錄、不傳資料）把 plugin 從安裝走到壓縮、讀回、側欄，確認每一步的結果。整份約 20 分鐘，不需要 Jev 金鑰。英文總覽見 [README](../README.md)，已驗證與未驗證的項目見 [compatibility.md](compatibility.md)。

## 開始前

- Claude Code **2.1.287 以上**（`claude --version`）。
- 乾淨狀態：`claude plugin list` 裡不應該有 `jev-agent-kit`。有的話先 `claude plugin uninstall jev-agent-kit@jev-agent-kit --scope <範圍>`；同名的兩個副本會互相衝突。
- 用一個**可以丟棄的資料夾**測試（例如 `mkdir ~/jev-try && cd ~/jev-try`），不要用正式專案。
- 想把測試資料與平常分開，可以先 `export JEV_STATE_DIR=$HOME/jev-try-state`（必須是絕對路徑）。

## 步驟

> 設定的優先序：**專案檔 > `/config` / `/jev mode`（使用者層級）> 預設值**。專案檔有寫的欄位，`/jev mode`、`/jev on` 改不動它；`/jev doctor` 會標明每個值來自哪裡。

| # | 做什麼 | 應該看到 | 通過 |
|---|---|---|---|
| 1 | 安裝：`/plugin marketplace add cloud-f1/jev-agent-kit`，再 `/plugin install jev-agent-kit --marketplace cloud-f1/jev-agent-kit`。終端機版：`claude plugin marketplace add cloud-f1/jev-agent-kit && claude plugin install jev-agent-kit@jev-agent-kit`。然後重啟 Claude Code | 安裝成功；會提示 `8 userConfig options not yet set`（全部選填，可忽略） | ☐ |
| 2 | `/jev doctor`（尚未啟用） | 第一行 `Jev Agent Kit 0.6.1`；有一行 `This project is NOT opted in` | ☐ |
| 3 | `/jev preset observe-local` | `Created .claude/jev-agent-kit.json`。再打一次 → `already exists; not changed` | ☐ |
| 4 | `/jev doctor` | `enabled=true (project file)`、`mode=observe`、`backend=rules` | ☐ |
| 5 | 請 Claude 執行：`node -e "for(let i=0;i<1500;i++){console.log('progress item '+i); if(i===700)console.log('ERROR demo: expected 1 got 2')}"`（約 27,000 字元） | 輸出**完整、沒有被改**（observe 只記錄） | ☐ |
| 6 | `/jev status`，再 `/jev savings` | status 有一筆 `prune · ok · 27xxx → 1xxx chars`；savings 的 `observe:` 顯示 `1 logs` 和 assist 會移除的字元數 | ☐ |
| 7 | 切換到 assist。**專案檔的設定優先於 `/jev mode`**，所以要換專案檔：先 `rm .claude/jev-agent-kit.json`（在終端機，或請 Claude 執行），再 `/jev preset prune-local` | `Created .claude/jev-agent-kit.json (enabled, mode=assist, backend=rules)`；`/jev doctor` 顯示 `mode=assist (project file)`。下一次 Bash 指令就會生效（不用重啟） | ☐ |
| 8 | 再請 Claude 執行**同一個**第 5 步的指令 | 輸出變短，`ERROR demo` 那行還在，結尾有一行說明：`pruned N -> M chars. The full original is in the file ...artifacts/<id>.log`；輸入框下方的狀態列可能顯示 `jev: 1/1 long logs pruned` | ☐ |
| 9 | 非錯誤線索（要在讀回**之前**做，因為讀回會暫停壓縮）：`node -e "for(let i=0;i<1500;i++){console.log('progress item '+i); if(i===700)console.log('NOTE tenant_region=eu-west-3 selected')}"`，請 Claude 回答 tenant_region 是什麼 | 這行不是錯誤，會被壓縮掉。Claude 看到說明後，應該自己去讀原始檔（可能多一兩個步驟）並答出 `eu-west-3` | ☐ |
| 10 | `/jev pane` | 側欄出現，內容有 `assist: N logs rewritten, ... chars removed net` 和最近的紀錄；`/jev pane close`（或 Esc）關閉 | ☐ |
| 11 | 讀回：請 Claude 用 Bash 執行 `cat <第 8 步說明裡的檔案路徑>`（用 Read 工具也能讀到內容，但**只有 Bash 指令或 `/jev readback <id>` 才算「讀回」**） | 讀到**完整原始輸出**（含被省略的 progress 行），而且這個 `cat` 的輸出本身**不會被再壓縮** | ☐ |
| 12 | 讀回之後，再執行第 5 步的指令 | 這次輸出**不再被壓縮**（讀回後 assist 對此專案暫停，直到重啟 Claude Code） | ☐ |
| 13 | **重啟 Claude Code**（解除暫停），再測超過上限的輸出：`node -e "for(let i=0;i<3000;i++)console.log('progress item '+i)"`（約 56,000 字元），然後 `/jev status` | Claude Code 自己會截斷並另存完整檔；plugin **不動它**；status 出現 `host_truncation · host_truncated_output` | ☐ |
| 14 | 清理：刪掉 `.claude/jev-agent-kit.json`，`claude plugin uninstall jev-agent-kit@jev-agent-kit`，移除測試資料夾和 `JEV_STATE_DIR` 資料夾 | 乾淨 | ☐ |

## 選用：Jev API（會花錢，會把脫敏後的日誌片段送到 TypeSafe）

先確認前面全部通過。在終端機執行 `claude plugin configure jev-agent-kit` 設定金鑰（不要貼到對話裡，也不要提交到 repo）。建議先 `/jev preset shadow-jev`（詢問 Jev 但不改輸出），看 `/jev status` 一陣子，再考慮 `prune-jev`。

## 回報問題時請附上

1. `claude --version` 和 `/jev doctor` 的完整輸出（不會顯示金鑰）。
2. 是哪一步、看到什麼、預期什麼。
3. 必要時：`claude --debug-file /tmp/f.log` 重現一次，再 `grep "jev-agent-kit" /tmp/f.log`。每次壓縮失敗退回原輸出時會跳一次提示，只含固定代碼（例如 `http_429`、`missing_key`），不含任何回應內容。

## 目前已知沒有親眼驗證的部分

- 啟用 plugin 時的金鑰輸入提示，以及 `/config` 畫面上的各項設定（我只看過畫面能開啟）。
- 狀態列（輸入框下方的 `jev: N/M ...`）的實際顯示；窄螢幕時的側欄。
- `backend: jev` 在真實長時間工作階段中的壓縮；Windows。
- **省錢或提高成功率的效果尚未證實。** 小型合成測試（4 個任務、一個便宜模型）兩邊都 32/32 通過，每次平均成本 $0.0031 對 $0.0040，只能當作冒煙測試，不能當成證據。
