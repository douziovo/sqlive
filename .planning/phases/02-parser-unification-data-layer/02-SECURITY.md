---
phase: 02
slug: parser-unification-data-layer
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-30
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client→API | Unvalidated dbName from user crosses HttpRequest boundary | dbName string (1-64 chars, now strictly validated) |
| backend→frontend | canonicalStatements from API response enters frontend SQL parsing logic | `{start, end}` integer pairs per statement |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Spoofing | SqlRequest.dbName @Pattern | mitigate | Strict whitelist regex `^[a-zA-Z0-9_-]{1,64}$` rejects injection at DTO validation layer; matches DatabasePoolManager.DB_NAME_PATTERN exactly | closed |
| T-02-02 | Tampering | clearDatabase() FK cycle | accept | Circular FK is an application-level design error. log.warn with involved table names + arbitrary-order DROP is acceptable degradation | closed |
| T-02-03 | Tampering | canonicalStatements from API response | mitigate | Frontend validates array shape via TypeScript compile-time checks; runtime `code.value.substring(cs.start, cs.end)` naturally throws on out-of-bounds, caught by existing error handling | closed |
| T-02-04 | Information Disclosure | canonicalStatements in response | accept | Statement boundaries are derived from user-submitted SQL — no secret data exposed | closed |
| T-02-SC | Tampering | Supply chain (dependencies) | accept | No new dependencies introduced in either plan; no npm/pip/cargo install step | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-02 | Circular FK dependencies indicate an application-level schema design error. log.warn provides observability; arbitrary-order DROP ensures all tables are still cleaned up. | Plan 02-01 threat model | 2026-05-30 |
| R-02-02 | T-02-04 | canonicalStatements contain character offsets computed from user-submitted SQL text. No PII, credentials, or internal system data crosses this boundary. | Plan 02-02 threat model | 2026-05-30 |
| R-02-03 | T-02-SC | Both plans modify existing files only. No new libraries, frameworks, or tools introduced. Supply chain attack surface unchanged. | Plans 02-01, 02-02 | 2026-05-30 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-30 | 5 | 5 | 0 | Claude (gsd-security-auditor) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-30
