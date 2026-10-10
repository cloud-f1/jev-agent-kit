---
name: error-line-in-long-log
tags: [bash-output, paired]
runs: 1
max_turns: 6
timeout_seconds: 180
allowed_tools: [Bash]
model: haiku
---
Run the command below with the Bash tool and then answer in one line: which test failed, and what were the expected and actual values?

```
node -e "for(let i=0;i<400;i++)console.log('step '+i+' compiled ok'); console.log('FAIL test_checkout: expected 42 got 41'); for(let i=400;i<800;i++)console.log('step '+i+' compiled ok')"
```
