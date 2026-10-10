---
name: error-beyond-host-cap-regression
tags: [bash-output, paired]
runs: 1
max_turns: 6
timeout_seconds: 180
allowed_tools: [Bash]
model: haiku
---
Run the command below with the Bash tool and then answer in one line: what is the one real error, and which step produced it?

```
node -e "for(let i=0;i<1200;i++)console.log('WARNING: deprecated call #'+i+' at step '+(i*7)); console.log('ERROR build_step_9: missing symbol parse_header'); for(let i=0;i<300;i++)console.log('WARNING: deprecated call #'+i+' at step '+(i*3))"
```
