#!/usr/bin/env bash
# 输出当前 phase + plan 状态，从 .planning/STATE.md 读取
# 引用方：CLAUDE.md "## 当前焦点" section
#
# 查找策略：先看 CWD/.planning/STATE.md，找不到则向上走目录树（适应 monorepo / worktree / 子目录调用）。

find_state_md() {
    local dir="$PWD"
    while [ "$dir" != "/" ] && [ -n "$dir" ]; do
        if [ -f "$dir/.planning/STATE.md" ]; then
            echo "$dir/.planning/STATE.md"
            return 0
        fi
        local parent
        parent=$(dirname "$dir")
        [ "$parent" = "$dir" ] && break
        dir="$parent"
    done
    return 1
}

STATE=$(find_state_md)
if [ -n "$STATE" ]; then
    grep -E "^current_phase:|^status:|^current_phase_name:" "$STATE" | head -3
else
    echo "STATE.md not found (searched upward from $PWD)" >&2
    exit 1
fi
