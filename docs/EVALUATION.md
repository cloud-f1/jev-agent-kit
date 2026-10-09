# 可比較指標與評估機制

## 1. 分開兩種結論

Log proxy：縮短多少字元、固定證據是否保留、Jev request latency／usage。這些不等於任務變好，也不等於省了同等百分比帳單。

Agent task：整個修復／開發任務通過獨立驗收的結果與費用。只用這層判定是否採用。

## 2. 必須比較的實驗組

| Arm | 功能 | 問題 |
|---|---|---|
| baseline | kit disabled | 原始 agent 表現如何？ |
| local | enabled、assist、backend=rules | 本地規則已能改善多少？ |
| jev | enabled、assist、backend=jev | Jev 相對 local 有額外價值嗎？ |

固定相同實際模型、provider、effort、初始化 repo、獨立 verifier、工具與權限。先隔離評估 Log 功能，避免便宜模型的效果歸因 Jev。若以後測模型分流，另開 experiment 並顯式 allow_model_variation=true，增加 fixed-cheap 組。

同一 task 的各組使用新的獨立 worktree／copy。每次從同一 seed commit 開始。隨機輪替組別順序，至少重跑 3 次，保留 ordering seed 與時間。不要在同一長 session 逐組切換。各組使用相同冷／暖 cache 條件，記錄 cache read/write。不共用修改後的 code。

## 3. 指標、來源與判定

| 指標 | 定義 | 資料來源 | 使用方式 |
|---|---|---|---|
| 最終成功率 | 通過獨立驗收的任務 / 全部登記任務 | 固定 tests＋必要人工 rubric | 品質護欄 |
| 首次通過率 | 未進入修復迭代就過驗收 / 全部任務 | 第一次外部驗收 | 區分多次修正才成功 |
| 成功任務成本 | 所有成功／失敗／重试費用之和 / 成功數 | CLI cost＋Jev usage＋账單校核 | 主要成本指標 |
| P50／P95 完成時間 | 包含 hook、API、重试与验收的 wall time | monotonic clock | 使用者等待與長尾 |
| 重試／升級 | 同一任務的修復次數、模型升級次数 | Agent transcript／控制器 | 解釋改善或退化 |
| 證據保留率 | 必需原文項保留數 / gold evidence 數 | 人工標註 fixtures | 避免壓縮丟診斷線索 |
| 錯誤原文保留 | critical error 全文是否保留 | 完整原文比對 | 有一項漏失即 veto |
| read-back rate | 需要恢復原文的任務／事件比例 | read-back 記錄，当前 CLI 尚需额外收集 | 檢查省下的 context 是否又讀回 |
| API 有效比例 | validated verdict / attempted request | kit decisions | 區分 Jev 判断與 fallback |
| API latency | 每 request P50/P95 | monotonic clock | 包含網路，不能引用廠商保證 |
| cache read/write | provider 報告的各类 input tokens | Claude JSON／usage | 分开冷啟動與快取費用 |
| 人為 override | 改正 kit 决策的比例 | 人工 review log | 可用性与错误成本 |

v0.1 自动提供 Log proxy 与 imported task 指標。Read-back rate、override、模型升级等補充欄位由 Claude session 收集；不要把未收集值填 0。

## 4. 收集真實任務資料

先更新 evals/agent-manifest.json 的 experiment_id、task_ids、repeats、arms。預先登記所有任務；例中的 2 個 task 只是 schema 範例，不足以 GO。

每個 run 用 CLI `-p --output-format json` 取得 model usage／cost；實際 flags 先用 installed CLI --help 確認。獨立 verifier 在 agent 完成後對 worktree 執行，agent 自述「完成」不算通過。验收脚本来源在 seed repo 外或驗證 checksum，不能讓 agent 改 verifier 取得假成功。人工品質 rubric 在開始前固定。

记录 `evals/agent-record.example.json` 的全部欄位。repeat 从 0 开始。JSONL 每行一個 run。成本包括主／子 Agent、output、cached read/write、API retry。CLI 顯示的 cost 是估計，最終与 provider 帳單 reconcile。

timeout／被中止的 run 仍記錄；若無法取得已消耗費用，记录已觀測下界且 cost_complete=false。不能把 timeout 當免費，不能刪掉失敗 run。穩定外部環境故障可按預先登記規則整個 paired block 重做，保留原紀錄與排除原因，不單獨排除表現差的組別。

Jev API malformed/timeout 可能已被计费；current hook no-verdict 成本无法完整推定，對應任務 cost_complete=false，待帳單校核。只送过一次、no retry，不代表一定免費。

## 5. 自動統計與 Gate

report 按 task cluster 做 2,000 次 paired bootstrap，保留每個 task 的全部 repeats；不要把同一 task 的多次 run 当獨立樣本。報告 cost-per-success ratio 与 pass-rate delta 的 95% CI。

| 狀態 | 意義 |
|---|---|
| INCOMPLETE | 缺預先登記的 run，不接受選擇性資料 |
| UNKNOWN_COST | 存在未完整量測費用，不能作成本結論 |
| INSUFFICIENT_EVIDENCE | 少於 100 unique tasks 或 3 repeats，不能 GO |
| NO_GO_EVIDENCE_LOSS | 必需證據丟失，即使省錢也拒絕 |
| GO | 費用 CI 與品質非劣性符合 gate，P95 也過關 |
| NO_GO | 成本目標／品質／延遲明确未過關 |
| INCONCLUSIVE | 信賴區間跨過邊界，需要更多資料或改策略 |

預設 GO：成本比率 95% CI 上界 ≤ 0.90；成功率差異 CI 下界 ≥ -0.02；P95 比率 ≤ 1.10；成本完整且證據全部通過。比較 jev_vs_local 才能判斷增量价值。若 jev 對 baseline 好、對 local 沒优势，採用 local。

100×3 是產品起始门槛，不是 power analysis；2 個百分点的非劣性可能需要更多樣本。P95 gate 只有點估計，未做 CI；release 前補 tail bootstrap。需要同時報平均、分層與離群案例，別用總體平均掩蓋中文／大型 repo 子群退化。

## 6. 下一個 session 的最低實驗

先跑 5 synthetic Log fixtures、22+ unit tests；live 後比較錯誤與額外 business context。接著取 10–20 代表 task 跑三组 smoke；结果只允许不足證據状态。確認 live API、host schema、成本字段与独立驗收均可用後，才擴大到正式樣本。

不自動批次啟動數百個付費 session。Claude session 先估計總預算、設定每 run budget 與總预算，依用户授权範圍執行。budget cap 是工具估計而非硬账单上限，需留餘量。
