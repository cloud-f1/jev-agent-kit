# 真實專案測試與回報（v0.8.0，繁體中文）

目的：在**你自己的專案**上試用 jev-agent-kit，一週後留下一份可以比對、可以重現的回報。這份不是效益證明：單看 `/jev savings` 的字元數無法說明成本或成功率有沒有改善（見 [README](../README.md) 的 "Is it worth it?"）。

先跑完 [TESTING.md](TESTING.md) 的丟棄式資料夾流程，再做這份。兩者的差別：TESTING.md 驗證機制，這份回報你的實際使用。

## 安全規則（先看）

- `rules` 後端不會外送任何資料。`jev` 後端會把**脫敏後**的日誌片段、一行目標說明和金鑰送到 `https://api.typesafe.ai`，脫敏只是盡力而為。
- **公司或客戶的專案，沒有確認可以外送之前，只用 `backend: rules`。**
- 回報裡**不要貼真實的日誌內容、路徑中的客戶名稱、金鑰、公司內部網址**。要引用就改寫成假資料，或只寫行數與類型。
- `/jev doctor` 與 `/jev status` 的輸出不含金鑰，但仍請先看過再貼。

## 階段

### 階段 0：安裝與確認版本（5 分鐘）

1. 更新到 0.8.0：`claude plugin marketplace update jev-agent-kit && claude plugin update jev-agent-kit@jev-agent-kit`，然後重啟 Claude Code 或 `/reload-plugins`。
2. `/jev doctor`，第一行應是 `Jev Agent Kit 0.8.0`。
3. 確認沒有同名的第二個副本（`claude plugin list` 只出現一次 `jev-agent-kit`）。

### 階段 1：只觀察，不改輸出（約 1 週，免費）

在每個要試的專案：

1. `/jev preset observe-local`，再 `/jev doctor` 確認 `enabled=true (project file)`、`mode=observe`、`backend=rules`。
2. 照常工作。這個階段你看到的輸出**完全沒被改**。
3. 每天結束或每個任務結束，記一次 `/jev status` 和 `/jev savings`。

這一階段回答：長輸出出現得多不多、`status` 裡有哪些退回原因。

### 階段 2：真的縮短（約 3 到 5 個真實任務）

1. 刪掉 `.claude/jev-agent-kit.json`，`/jev preset prune-local`。
2. 做真實任務。每個任務結束後記下：
   - 模型有沒有因為缺資訊而去讀原始檔（receipt 裡的 `...artifacts/<id>.log`），或你自己用了 `/jev readback`。
   - 任務最後有沒有成功，和沒裝這個 plugin 時的做法相比有沒有多繞路。
3. 讀回之後這個專案的縮短會暫停到重啟 Claude Code，這是設計；請在回報裡註明。

### 階段 3（選用，會花錢）：Jev 後端

只在階段 1、2 沒有異常，**而且確認專案資料可以外送**之後。

1. 金鑰：`claude plugin configure jev-agent-kit`，不要貼進對話或提交進 repo。
2. `/jev doctor --verify`：只送一句合成句子，應顯示 `valid`。
3. `/jev preset shadow-jev`：詢問 Jev 並記錄它會保留什麼，**不改輸出**。看幾天的 `/jev status`。
4. 再考慮 `prune-jev`。

## 要收集的資料

每個專案、每個階段各收一次，貼進下面的範本：

| 來源 | 內容 |
|---|---|
| `claude --version` | Claude Code 版本 |
| `/jev doctor` | 完整輸出（版本、生效設定、來源、目標） |
| `/jev status` | 最近 10 筆決策與退回原因代碼 |
| `/jev savings` | 計算過的字元數、Jev 實際回答了幾份日誌 |

怎麼讀 0.8.0 的新欄位：

- `/jev status` 會顯示 `Jev kept K of A blocks it was asked about` 與延遲（毫秒）。`K` 遠小於 `A` 代表 Jev 很挑；`A` 為 0 代表 Jev 沒被問到。
- 縮短後的輸出裡，`[omitted N lines; ...]` 的 `N` 是被省略的行數，這是檢查「少了多少」最快的方式。
- 原因代碼不是 `ok` 時，那就是原輸出被原樣放行的理由，例如 `missing_key`、`http_429`、`timeout`、`budget_fallback_original`（日誌太長，超過 4 次請求）、`host_truncated_output`（Claude Code 自己已在 30,000 字元截斷）。
- 紀錄只含固定代碼與數字，不含日誌內容；`blocks_withheld` 是被本機擋下、沒有送給 Jev 的區塊數。

## 回報範本

複製下面整段，每個專案填一份。不確定的欄位寫「不確定」，不要猜。

```markdown
## 測試回報：<專案代稱，不要寫客戶名稱>

- 日期區間：
- Claude Code 版本：
- jev-agent-kit 版本：（/jev doctor 第一行）
- 作業系統：
- 專案類型：（例如 Node 網站、Python 服務、Terraform；測試輸出大概多長）
- mode / backend：（observe|assist）/（rules|jev）
- 是否另有啟用 fast-jev-compaction：是 / 否

### 數字
- /jev savings：
- /jev status（最近 10 筆，必要時改寫掉敏感字）：
- 長日誌出現次數（約）：
- 最常見的退回原因代碼：

### 使用感受
- 模型是否因為縮短而讀了原始檔：（次數 / 在什麼情況）
- 有沒有遺失關鍵資訊：（有 / 沒有；若有，是哪一類，例如「一行非錯誤的設定值」）
- 任務結果：（成功 / 失敗 / 比平常多繞路）
- 讓你意外的事：

### 問題（每個問題一段）
- 哪一步 / 看到什麼 / 預期什麼：
- 可重現嗎：
- 附上：/jev doctor 的輸出

### 我的判斷（不要寫成省錢結論）
- 這一週有感覺到幫助嗎：（有 / 沒有 / 看不出來）
- 會繼續開著嗎：（是 / 否，為什麼）
```

## 回報時請誠實

- 「看起來有用」和「省了錢」是兩件事。沒有同一批任務、同樣驗收標準的有無對照，就只寫「感覺」，不要寫百分比。
- `/jev savings` 的字元數不是 token 數，也不是金額。
- 單一專案、單一模型、少量任務，不能代表一般情況。

## 已知還沒有人親眼驗證的部分

回報時如果碰到這些，請特別標出來，它們是目前最缺資料的地方：

- `backend: jev` 在**互動畫面**裡的實際表現（目前只在無頭模式驗證過）。
- 升級後已存的 plugin 設定是否保留。
- Windows。
- 與 fast-jev-compaction 同時啟用時，真實 compaction 的行為。
- 窄螢幕下的側欄、啟用時的金鑰輸入提示。
- Jev 保留「非錯誤」線索的能力：在合成測試裡 12 個線索只保留 5 個（見 [CHANGELOG](../CHANGELOG.md) 0.8.0）。真實案例裡若模型因此漏了資訊，請描述類型。

## 送回哪裡

把填好的範本貼給維護者（或貼進對應的 Jira 票）。維護者會把共通的問題收進下一個批次，依 release skill 的節奏決定要不要發版；安全或隱私問題不受節奏限制，會立刻處理。
