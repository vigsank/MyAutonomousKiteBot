#!/bin/sh
# Relaunch run3 with flash ensemble + sentiment hard-timeout fix.
cd /Users/i312327/SAPDevelop/MyAutonomousKiteBot
mkdir -p test/backtest/results/run3
osascript <<'APPLESCRIPT'
tell application "Terminal"
  activate
  do script "cd /Users/i312327/SAPDevelop/MyAutonomousKiteBot && ENV_FILE=.env.test RUN_NAME=run3 LLM_ENSEMBLE_MODELS=deepseek-v4-flash:preview,gpt-oss:20b,gemma4:31b npx ts-node test/backtest/run_all_cases.ts 2>&1 | tee test/backtest/results/run3/run.log"
end tell
APPLESCRIPT
echo "relaunched run3 (flash ensemble + sentiment timeout)"
