#!/usr/bin/env bash
# Claude Code statusline (ANSI color + ASCII bar) - stable version

set -euo pipefail

input="$(cat)"

# Model (short)
model_full="$(echo "$input" | jq -r '.model.display_name // .model.id // "unknown"')"
model_short="$(echo "$model_full" | sed 's/Claude //I' | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"

# Context usage %
used_pct="$(echo "$input" | jq -r '.context_window.used_percentage // empty')"
if [[ -n "${used_pct:-}" ]]; then
  # round to int
  used_int="$(printf "%.0f" "$used_pct" 2>/dev/null || echo 0)"
  # clamp 0..100
  if (( used_int < 0 )); then used_int=0; fi
  if (( used_int > 100 )); then used_int=100; fi
  ctx_str="${used_int}%"
else
  used_int=0
  ctx_str="--"
fi

# Current dir
cwd="$(echo "$input" | jq -r '.cwd // .workspace.current_dir // ""')"
[[ -z "$cwd" ]] && cwd="$(pwd)"

# Git branch (avoid optional locks)
branch="$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null || true)"
if [[ -n "$branch" ]]; then
  dir_str="${cwd} [${branch}]"
else
  dir_str="${cwd}"
fi

# Time
time_str="$(date +%H:%M)"

# ANSI colors (more compatible than $'..' in some environments)
GREEN="$(printf '\033[32m')"
YELLOW="$(printf '\033[33m')"
RED="$(printf '\033[31m')"
CYAN="$(printf '\033[36m')"
RESET="$(printf '\033[0m')"

# Threshold-based color
if (( used_int >= 90 )); then
  C="$RED"
elif (( used_int >= 70 )); then
  C="$YELLOW"
else
  C="$GREEN"
fi

# 10-slot ASCII bar (Claude UI renders reliably)
filled=$(( used_int / 10 ))
empty=$(( 10 - filled ))
bar="$(printf "%${filled}s" | tr ' ' '#')$(printf "%${empty}s" | tr ' ' '.')"

# Output (2 lines is supported; keep compact)
printf "%s[%s]%s  %s  %s\n" "$CYAN" "$model_short" "$RESET" "$dir_str" "$time_str"
printf "%s[%s%s%s %s]%s\n" "$CYAN" "$C" "$bar" "$RESET" "$ctx_str" "$RESET"