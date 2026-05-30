# Phase 4: Security Hardening - Discussion Log

**Date:** 2026-05-30
**Status:** Complete

## Areas Discussed

### Area 1: 实现决策委派

**User selection:** 全部由 Claude 决定

User delegated all implementation decisions to Claude based on codebase analysis.

## Decisions Captured

| ID | Decision | Source |
|----|----------|--------|
| D-01 | Block ATTACH DATABASE and ATTACH statements via regex `(?i)^\s*ATTACH\s` | Claude's discretion |
| D-02 | Block ALL user-submitted PRAGMAs (not selective blacklist) | Claude's discretion |
| D-03 | Backend internal PRAGMAs unaffected (run outside statement loop) | Codebase analysis |
| D-04 | Block at SqlExecutionService.execute() line 51-52, before jdbc.execute() | Codebase analysis |
| D-05 | Return SqlResponse.error(message, s.startLine()) | Codebase analysis |
| D-06 | Error messages in English: "ATTACH DATABASE is not allowed..." / "PRAGMA statements are not allowed" | Claude's discretion |

## Claude's Discretion Areas

- Regex implementation details for keyword matching
- Whether to extract a private `isBlockedStatement()` helper method
- Test case design for unit tests
- Exact placement and formatting within SqlExecutionService.execute()

## Deferred Ideas

None.
