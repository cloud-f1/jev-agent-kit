---
name: warning-heavy-log
tags: [bash-output, paired]
runs: 1
max_turns: 6
timeout_seconds: 180
allowed_tools: [Bash, Read]
model: haiku
---
Run the command below with the Bash tool and then answer in one line: what is the one real error, and which step produced it?

```
node -e "for(let i=0;i<500;i++)console.log('WARNING: deprecated call #'+i+' at step '+(i*7)); console.log('ERROR build_step_9: missing symbol parse_header'); for(let i=0;i<100;i++)console.log('WARNING: deprecated call #'+i+' at step '+(i*3))"
```
