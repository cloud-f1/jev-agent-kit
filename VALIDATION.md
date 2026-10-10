> Historical (v0.1). The Python tooling these commands use was removed in 0.5.0; use `node cli/jev.ts` and `node scripts/release-check.ts` instead. See README.md.

# Validation — 2026-10-09

- Python 3.12.14；最低建議 Python 3.10。
- 26 unit／子程序 Hook 測試：全部通過。
- 5 fixtures × baseline/local/mock_jev：已執行，產生可檢查原文與 Log proxy 報告。
- Missing-key smoke：exit 3、no_verdict，已確認不誤報成功。
- Installer：保留既有設定、同路徑 idempotent、backup、保留已有project config，已測。
- Metrics：缺run、duplicate、unknown cost、zero-success、verifier/model drift、evidence veto、paired incremental gate，已測。
- 未測：真實 Jev API／帳單、Claude CLI load／native Mod、真實 Agent task benchmark。
- 離線結果不是 Jev 品質評估，也不是帳單節省證明。
