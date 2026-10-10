> Historical (v0.1). The Python tooling these commands use was removed in 0.5.0; use `node cli/jev.ts` and `node scripts/release-check.ts` instead. See README.md.

# 貼到 Claude session 的執行上下文

請在目前 repo 讀取此套件 README.md、docs/REPO_HANDOVER.md、docs/EVALUATION.md。先讀 repo AGENTS.md／CLAUDE.md，保留未提交內容。

1. 先執行 doctor、unit tests、offline bench-logs。這些不用 API key、不送外部資料。
2. 使用者會在本機 `.env.local` 放 TYPESAFE_API_KEY。只檢查 key 是否存在，不讀給對話、不把值印出、不提交檔案。不用要求使用者把 key 貼給你。
3. 如果 key 已配置，執行 synthetic smoke 与 synthetic live Log benchmark。API 失败保留诊断类别，不能说跑通。沒有 key 繼續其他工作，明確列出 live skipped。
4. 此套件目前是已測 pure Python core／classic fallback，不是原生 Mod。檢查 installed Claude Code version、hook output schema、plugin validate；以安全长測試輸出做一次实际 host integration，再决定安装到目标项目。
5. 建議先 installer observe／rules，之后 observe／jev，確認数据流与decision后才 assist。保留既有 settings，防止 plugin+installer 双重注册。用户已经要求接入与评估，继续可逆工作，不停在提出计划。
6. 在目标支持 Mod 時，按实际生成的 types 建薄 TS Mod adapter。Core 不接收 $；Mod I/O 用官方 API。将相同决策契约与 fixtures 对齐；不假定旧 compaction API。Native Mod 未完成不得写成已完成。
7. 构建三组 baseline/local/jev 的 paired smoke，固定模型／provider／权限／verifier／seed，每次独立 worktree。先10–20个task，事先登记manifest。记录成功和失败run、成本完整性、实际model、环境、时间。对付费大样本先给具体预算；本交付没有自动批准无限费用。
8. 用 report 输出对比；必须看 jev_vs_local，不能将便宜模型收益算成Jev贡献。log_proxy不填到agent_task。样本不足、缺run、unknown cost均不能声称更好。
9. 加入关键证据金标、read-back计数、cache token、人工override收集，并对指标源码与统计机制做独立审查；修复后重跑相关测试。不要降低gate让结果变绿。
10. 完成后报告变更文件、实际命令结果、live／host未验证项、指标比较与判定。保存结果与真实运行版本；不自动publish、部署、push或修改其他生产项目。

开始命令（在套件目录，Windows可用python）：

```bash
python3 jev.py doctor
python3 -m unittest discover -s tests -v
python3 jev.py bench-logs --outdir results/offline
python3 jev.py --env-file .env.local smoke
python3 jev.py --env-file .env.local bench-logs --live --outdir results/live-logs
```

目標是「有完整資料可比較的可用 package」，不是演示數字漂亮。
