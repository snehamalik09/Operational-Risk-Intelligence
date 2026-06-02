# Product Requirements Document
## Operational Risk Intelligence (ORI)
**Version:** 1.1 — Architecture Revision
**Date:** 2026-06-02
**Status:** Approved for development

**Change log:**
- v1.1: Replaced structural clustering with semantic pattern detection; introduced incident risk scoring; revised deduplication, noise filtering, and problem creation logic (Architecture Revision Notes, 2026-06-02). Note: Change 5 from the revision notes was not received and is not reflected here.

---

## 1. Problem Statement

Organizations repeatedly experience incidents caused by the same underlying issue. Problem Management is reactive — Problem records are created only after multiple incidents have already occurred and often only after a manager manually notices a pattern. No systematic mechanism exists to surface recurring operational risk before it escalates.

**The gap:** Incident data contains the signal. No one is reading it at scale.

---

## 2. Goals

- Automatically detect recurring incident patterns using AI semantic analysis
- Surface those patterns as human-reviewed recommendations before Problem records are created
- Reduce the time between a pattern emerging and a Problem record being opened
- Give Problem Managers structured, evidence-backed input rather than relying on intuition

## 3. Non-Goals (MVP)

- Real-time alerting (Phase 2)
- Change record correlation
- Automated Problem resolution
- Embedding-based vector clustering
- Custom UI or Workspace views (use native list/form)
- Integration with third-party ITSM tools

---

## 4. User Personas

### Problem Manager
Reviews AI-generated recommendations, edits the proposed Problem statement if needed, and approves or rejects. Does not configure the system.

### ORI Administrator
Configures noise filters, scoring weights, the Claude API credential, and the reviewer group. Monitors monthly analysis run records.

### ITSM Process Owner (observer)
Reads analysis run summaries and approval rate metrics to assess system value. No direct interaction with the tool.

---

## 5. Functional Requirements

### FR-1: Monthly Analysis Run
The system shall execute a monthly analysis job that processes all resolved and closed incidents from the last 30 days (configurable). The analysis window and run schedule shall be configurable by an administrator without code changes.

### FR-2: Noise Filtering
Before analysis, the system shall exclude incidents that represent routine service desk activity rather than operational risk. Exclusion shall operate on two layers:

**Layer 1 — Category/Subcategory exclusion (applied at query time):**
Configurable lists of excluded categories and subcategories. Examples: Password Reset, Access Request, VPN Access, Mailbox Request, Printer Request, Software Installation.

**Layer 2 — Keyword exclusion (applied per record):**
Configurable list of keywords checked against the short description. Examples: reset password, unlock account, access required, distribution list, email access.

Both lists shall be administrator-configurable via sys_properties without code changes.

The Analysis Run record shall capture:
- **Total incidents reviewed** — all resolved/closed incidents in the analysis window before filtering
- **Total incidents excluded** — removed by noise rules
- **Total incidents analyzed** — sent to Claude (= reviewed minus excluded)

### FR-3: Incident Risk Scoring
The system shall calculate a deterministic risk score for each qualifying incident before sending it to Claude. The score is informational — it is included in the payload Claude receives and is used to prioritise the incident pool when truncation is required. Incidents shall NOT be filtered solely because of a low risk score.

**Scoring inputs and point values:**

| Factor | Value | Points |
|---|---|---|
| Priority | P1 — Critical | 30 |
| Priority | P2 — High | 20 |
| Priority | P3 — Moderate | 10 |
| Priority | P4 — Low | 0 |
| Impact | 1 — High | 20 |
| Impact | 2 — Medium | 10 |
| Impact | 3 — Low | 0 |
| Urgency | 1 — High | 20 |
| Urgency | 2 — Medium | 10 |
| Urgency | 3 — Low | 0 |
| Major Incident | true | 50 |
| Major Incident | false | 0 |

**Category weighting (additive bonus):**
Operational categories (Database, Application, Performance, Network, Infrastructure) receive a configurable bonus (default +15). Service-request-style categories (Access, Password, Distribution List, Mailbox) receive no bonus.

**Keyword weighting (additive bonus):**
Each occurrence of an operational risk keyword in the short description or description field adds a configurable bonus (default +10 per keyword). Example keywords: timeout, latency, outage, memory leak, deadlock, service unavailable, connection failure, crash, disk full, high CPU.

The calculated score is a non-negative integer. It is included in the incident payload sent to Claude.

### FR-4: Semantic Pattern Detection
The system shall send the full pool of scored, filtered incidents to Claude in a single API call. Claude is responsible for identifying patterns semantically — grouping incidents that share a common operational root cause regardless of their CI, category, or assignment group.

**Pool truncation:** If the incident pool exceeds the configurable maximum (`x_ori.max_incidents_per_call`, default 200), the pool shall be sorted by risk score descending and truncated. The highest-risk incidents are always analysed; lower-risk incidents are deferred to future runs.

**Data sent to Claude (sanitized payload):**

| Field | Source | Notes |
|---|---|---|
| Incident number | `number` | Identifier — allows Claude to reference specific incidents |
| Short description | `short_description` | Primary semantic signal |
| Description | `description` | Full problem description |
| Resolution notes | `close_notes` | How the incident was resolved |
| Priority | `priority` (display value) | Context for severity |
| Impact | `impact` (display value) | Blast radius context |
| Urgency | `urgency` (display value) | Time-sensitivity context |
| Category | `category` | Operational context |
| Subcategory | `subcategory` | Additional context |
| CI name | `cmdb_ci.name` | Display name only — no sys_id |
| Assignment group name | `assignment_group.name` | Display name only |
| Risk score | Calculated (FR-3) | Deterministic signal |
| Major incident flag | `major_incident_state` | Boolean |

**Explicitly excluded from payload:** caller name, assigned_to, work_notes, opened_by, resolved_by, email addresses, attachments, sys_ids.

**Claude output — required JSON schema:**
```json
{
  "patterns": [
    {
      "pattern_name": "string (concise name for this recurring risk)",
      "pattern_summary": "string (one sentence)",
      "root_cause_hypothesis": "string (one paragraph)",
      "confidence": "number 0.0–1.0",
      "trend_direction": "increasing | stable | decreasing",
      "affected_incidents": ["INC0001234", "INC0001256"],
      "recommended_action": "string (specific Problem Management action)",
      "problem_statement": "string (draft Problem short description, ≤160 chars)",
      "primary_ci": "string (display name of primary CI involved)"
    }
  ]
}
```

If no patterns are identified, Claude shall return `{ "patterns": [] }`.

The system shall treat any pattern with confidence below 0.6 as not actionable and skip recommendation creation.

### FR-5: Recommendation Records
For each pattern returned by Claude with confidence ≥ 0.6, the system shall create an AI Recommendation record. Before creating, the system shall check for a duplicate recommendation in the current analysis period (see FR-4a below).

**Record fields:**

| Field | Description |
|---|---|
| Pattern name | Claude-generated concise name for the recurring risk |
| Pattern summary | One-sentence description |
| Root cause hypothesis | Claude's reasoning |
| Recommendation text | Proposed Problem Management action |
| Problem statement | Draft Problem short description (editable by reviewer) |
| Severity | high / medium / low |
| Confidence score | 0.0–1.0 from Claude |
| Trend direction | increasing / stable / decreasing |
| Primary CI | Display name of the primary CI from Claude |
| Dedup key | pattern_name + '\|' + primary_ci (used for deduplication) |
| Linked incidents | JSON array of `{number, sys_id}` pairs — the incidents Claude identified as part of this pattern |
| State | pending / approved / rejected / linked_to_existing |
| Rejection reason | Captured when rejected |
| Approved by | Set on approval |
| Approval date | Set on approval |
| Problem | Reference to Problem record created on approval |

### FR-4a: Recommendation Deduplication
Before creating a recommendation, the system shall check whether an active recommendation (state ≠ rejected) with the same `dedup_key` already exists for the current analysis period (current calendar month). If found, the duplicate recommendation shall not be created.

Recommendations in **Rejected** state are excluded from this check — a previously rejected recommendation does not block a new one from being created on a subsequent run.

### FR-6: Human Approval Gate
A Problem Manager shall review each recommendation via a standard ServiceNow form. They may edit the proposed Problem statement before acting. Two actions shall be available:
- **Approve** — creates a Problem record and associates all linked incidents
- **Reject** — captures a mandatory rejection reason and closes the recommendation

### FR-7: Problem Creation
Upon approval, the system shall:

1. **Duplicate guard:** Query for open Problem records where the CI matches `primary_ci` AND the short description starts with the first 40 characters of `pattern_name`. If a matching open Problem is found, link the recommendation to the existing Problem (`state = linked_to_existing`) rather than creating a new one.

2. **Create new Problem** if no duplicate found: set `short_description` from the approved `problem_statement`, `description` from root cause hypothesis and recommendation text, and `assignment_group` from the primary CI's primary support group if available.

3. **Associate incidents:** For each incident in `linked_incidents`, set `incident.problem_id` to the new (or existing) Problem's sys_id.

### FR-8: Observability
Each monthly run shall produce an Analysis Run record showing:
- Total incidents reviewed, excluded, and analyzed
- Patterns identified by Claude
- Recommendations generated (may be lower than patterns due to deduplication)
- Error log for any failures during the run

A notification shall be sent to a configurable reviewer group summarising the run outcome after each run completes.

### FR-9: Kill-Switch
The system shall check a single system property (`x_ori.active`) before executing any analysis. If false, the run exits immediately with no API calls made.

### FR-10: Error Isolation
If the Claude API call fails (HTTP error, timeout, malformed JSON response), the failure shall be logged to the Analysis Run error log and the run shall complete with status `completed_with_errors`. The run shall not abort — partial results are preserved.

---

## 6. Configuration Properties

All properties use the `x_ori.*` namespace and are managed via System > Properties.

| Property | Default | Description |
|---|---|---|
| `x_ori.active` | true | Master kill-switch |
| `x_ori.lookback_days` | 30 | Analysis window in days |
| `x_ori.max_incidents_per_call` | 200 | Pool size ceiling; excess truncated by risk score descending |
| `x_ori.excluded_categories` | Password Reset, Access Request, VPN Access, Mailbox Request, Printer Request, Software Installation | Comma-separated — excluded at query time |
| `x_ori.excluded_subcategories` | Account Unlock, New User Setup, Duplicate | Comma-separated — excluded at query time |
| `x_ori.noise_keywords` | reset password, unlock account, access required, distribution list, email access | Comma-separated — excluded per record |
| `x_ori.operational_categories` | Database, Application, Performance, Network, Infrastructure | Receive category score bonus |
| `x_ori.category_score_bonus` | 15 | Points added for operational category match |
| `x_ori.keyword_score_bonus` | 10 | Points added per operational risk keyword match |
| `x_ori.risk_keywords` | timeout, latency, outage, memory leak, deadlock, service unavailable, connection failure, crash, disk full, high cpu | Operational risk keywords for scoring |
| `x_ori.claude_model` | claude-opus-4-8 | Claude model ID |
| `x_ori.claude_max_tokens` | 4096 | Max tokens per analysis response (higher than before — Claude now analyses the full pool) |
| `x_ori.claude_api_key` | (private) | Anthropic API key |
| `x_ori.reviewer_group` | (required) | sys_user_group sys_id for notifications |

---

## 7. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Recommendation approval rate | ≥ 70% | approved ÷ (approved + rejected) per run |
| False positive rate | ≤ 30% | rejected ÷ total recommendations |
| Repeat incident reduction | ≥ 20% after 3 months | Incidents on Problems resolved by ORI vs. baseline |
| Time to Problem creation | < 35 days from first incident | problem.sys_created_on minus first linked incident.opened_at |
| Noise filter accuracy | < 5% legitimate incidents excluded | Manual audit of a random excluded sample |
| Cross-CI pattern detection | ≥ 1 cross-CI pattern per quarter | Recommendations where affected incidents span > 1 CI |

Approval rate and false positive rate should be reviewed after the first two runs and thresholds recalibrated before treating them as KPIs.

---

## 8. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Incident data quality is poor (blank descriptions or close_notes) | High | Risk score penalises thin data; Claude returns low confidence on sparse incidents; confidence threshold filters these out |
| Claude API unavailable or rate-limited | Medium | 429 retry once after 30 seconds; failure logged to run error_log; run completes with completed_with_errors |
| Token limit exceeded for large incident pools | Medium | Pool truncated at x_ori.max_incidents_per_call by risk score; highest-risk incidents always included |
| Problem Managers overwhelmed by recommendations | Medium | Confidence threshold (0.6) and dedup key filter weak and repeated patterns |
| PII in incident descriptions sent to Claude | Low | Sanitized field list excludes user-identifying fields; description and close_notes reviewed for PII risk pre-deployment |
| Duplicate Problem records created | Low | Duplicate guard checks open Problems by CI + pattern_name prefix before creating new one |
| Claude groups unrelated incidents together | Low | Problem Manager approval gate catches misclassification before Problem is created; rejection reason feeds tuning |

---

## 9. Acceptance Criteria

- [ ] Monthly scheduled job completes with status `completed` or `completed_with_errors`
- [ ] Analysis Run record accurately reflects total_incidents_reviewed, incidents_excluded, incidents_analyzed, patterns_identified, and recommendations_generated
- [ ] Risk score is calculated for each incident and included in the Claude payload
- [ ] Pool is truncated to max_incidents_per_call when exceeded, sorted by risk score descending
- [ ] Claude receives a single call with the full incident pool (not one call per cluster)
- [ ] Claude returns patterns grouping incidents across different CIs where semantically related
- [ ] At least one recommendation created from seeded test data with confidence ≥ 0.6
- [ ] Dedup key prevents duplicate recommendations for the same pattern in the same month
- [ ] Rejected recommendations do not block new recommendations from being created on subsequent runs
- [ ] Approving a recommendation creates a Problem record with correct short_description
- [ ] All linked incidents have `problem_id` populated after approval
- [ ] Rejecting a recommendation captures rejection_reason and sets state to rejected
- [ ] Duplicate Problem guard checks by CI + pattern_name prefix, not by CI + category
- [ ] Kill-switch (x_ori.active=false) prevents any Claude API calls
- [ ] Claude API failure does not abort the run; error is logged to the Analysis Run record
