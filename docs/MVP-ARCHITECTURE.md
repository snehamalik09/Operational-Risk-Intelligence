# ORI MVP Architecture
**Version:** 1.1 — Architecture Revision (2026-06-02)

**Key change from v1.0:** Structural clustering (CI + Category + Assignment Group grouping) removed as primary analysis mechanism. Claude now performs semantic pattern detection across a scored incident pool. ServiceNow handles filtering, scoring, orchestration, approvals, and governance.

---

## Responsibility Split

| Layer | Responsibility |
|---|---|
| ServiceNow | Deterministic filtering, risk scoring, payload preparation, pipeline orchestration, approval workflow, Problem creation, governance |
| Claude | Semantic pattern detection, incident grouping, root cause hypothesis, trend assessment |
| Problem Manager | Final approval authority — no recommendation becomes a Problem without human sign-off |

---

## Data Flow

```
ServiceNow Scheduler (1st of month, 02:00)
│
▼
ORIAnalysisEngine.runMonthlyAnalysis()
│
├── Create Analysis Run record (status: running)
│
├── [Stage 1] Noise Filtering
│     Query incident table: resolved/closed, within lookback window
│     Layer 1: category/subcategory NOT IN exclusion lists (at query time)
│     Layer 2: keyword check on short_description (per record)
│     Track: total_incidents_reviewed, incidents_excluded, incidents_analyzed
│
├── [Stage 2] Incident Risk Scoring  ← ORIIncidentScorer
│     For each qualifying incident, calculate deterministic score:
│       Priority points + Impact points + Urgency points
│       + Major Incident bonus
│       + Category weight bonus (operational categories)
│       + Keyword weight bonus (risk keywords in description)
│     Score is ADDITIVE and INFORMATIONAL — not a filter
│
├── [Stage 3] Pool Preparation
│     Sort pool by risk score descending
│     Truncate to x_ori.max_incidents_per_call if pool exceeds limit
│     Sanitize each incident (include: number, short_description, description,
│       close_notes, priority, impact, urgency, category, subcategory,
│       ci_name, assignment_group_name, risk_score, is_major_incident)
│     Build incident number → sys_id lookup map (for post-Claude resolution)
│
├── [Stage 4] Claude Semantic Analysis  ← ORIClaudeClient
│     Single API call with full incident pool
│     Claude identifies patterns semantically — groups incidents by root cause
│       regardless of CI, category, or assignment group boundaries
│     Claude returns: array of patterns, each with:
│       pattern_name, pattern_summary, root_cause_hypothesis,
│       confidence, trend_direction, affected_incidents[],
│       recommended_action, problem_statement, primary_ci
│
├── [Stage 5] Dedup Check & Recommendation Creation
│     For each pattern (confidence ≥ 0.6):
│       dedup_key = pattern_name + '|' + primary_ci
│       Check: active recommendation with same dedup_key exists this month?
│         (Rejected recommendations excluded from check)
│       If duplicate: skip
│       If new: create x_ori_ai_recommendation
│               Resolve affected_incidents (numbers → sys_ids via lookup map)
│               Store linked_incidents as JSON [{number, sys_id}, ...]
│
└── Update Analysis Run
      status: completed | completed_with_errors | failed
      patterns_identified, recommendations_generated, error_log
      Fire event: x_ori.analysis.complete → run summary notification

─────────────────────────────────────────────────────────────

Problem Manager opens x_ori_ai_recommendation form
│
├── Reviews: pattern_name, pattern_summary, root_cause_hypothesis,
│            confidence_score, trend_direction, primary_ci,
│            recommendation_text, linked incident count
│
├── (Optional) Edits problem_statement field
│
├── Clicks Approve
│     UI Action sets state = approved
│     Calls ORIProblemCreator directly
│     │
│     ├── Duplicate guard:
│     │     Open Problem where CI = primary_ci
│     │       AND short_description STARTS WITH first 40 chars of pattern_name?
│     │     Yes → link to existing, state = linked_to_existing
│     │     No  → create Problem record
│     │
│     └── For each incident in linked_incidents:
│           Set incident.problem_id = new/existing Problem sys_id
│
└── Clicks Reject
      UI Action prompts for rejection_reason
      Sets state = rejected
```

---

## Component Map

```
Trigger layer
  sys_trigger (Scheduled Job) → ORIAnalysisEngine.runMonthlyAnalysis()

Analysis layer
  ORIAnalysisEngine     orchestrates all 5 stages; owns Analysis Run lifecycle;
                        handles noise filtering inline; fires completion event
  ORIIncidentScorer     stage 2: deterministic risk score per incident
  ORIClaudeClient       stages 3–4: payload preparation, single API call,
                        multi-pattern response parser

Action layer
  ORIProblemCreator     duplicate guard (pattern_name + CI); Problem creation;
                        incident association via linked_incidents JSON
  UI Actions (×2)       Approve and Reject buttons on recommendation form

Notification layer
  Notification (event)  run summary after analysis completes (x_ori.analysis.complete)
```

---

## Custom Tables

### `x_ori_analysis_run`
One record per monthly execution.

| Field | Type | Notes |
|---|---|---|
| number | Auto-number (ORI) | |
| run_date | Date | Month analysed |
| status | Choice | pending, running, completed, completed_with_errors, failed |
| total_incidents_reviewed | Integer | Before filtering |
| incidents_excluded | Integer | Removed by noise rules |
| incidents_analyzed | Integer | Sent to Claude |
| patterns_identified | Integer | Patterns returned by Claude |
| recommendations_generated | Integer | Created after dedup check |
| error_log | Journal | API failures, parsing errors |
| triggered_by | Reference → sys_user | |

### `x_ori_ai_recommendation`
Claude's output for one identified pattern — the approval target.

| Field | Type | Notes |
|---|---|---|
| number | Auto-number (REC) | |
| analysis_run | Reference → x_ori_analysis_run | |
| pattern_name | String 255 | Claude-generated concise name |
| dedup_key | String 500 | pattern_name + '\|' + primary_ci |
| pattern_summary | String 255 | One-sentence description |
| root_cause_hypothesis | Long text | Claude's reasoning |
| recommendation_text | Long text | Proposed Problem Management action |
| problem_statement | String 255 | Editable draft Problem short description |
| severity | Choice | high, medium, low |
| confidence_score | Decimal | 0.0–1.0 |
| trend_direction | Choice | increasing, stable, decreasing |
| primary_ci | String 255 | Display name of primary CI (from Claude) |
| linked_incidents | Long text | JSON: [{number, sys_id}, ...] |
| state | Choice | pending, approved, rejected, linked_to_existing |
| rejection_reason | String 500 | |
| approved_by | Reference → sys_user | |
| approval_date | Date/Time | |
| problem | Reference → problem | Set on approval |

### Platform Tables (no schema changes)
- `incident` — source data (read) and updated on approval (`problem_id`)
- `problem` — created on approval
- `cmdb_ci`, `sys_user_group` — read for display name resolution

---

## Table Relationships

```
x_ori_analysis_run  (1)
  │
  └── (many) x_ori_ai_recommendation
                   └── → problem (native, set on approval)
                   └── [triggered_by] → sys_user (native)
```

No cluster table. No M2M incident junction table. Incident linkage stored as JSON in `linked_incidents` on the recommendation record.

---

## Security Model

| Role | Tables | Operations |
|---|---|---|
| `x_ori_admin` | All ORI tables | Read, write, delete |
| `x_ori_analyst` | `x_ori_ai_recommendation` | Read, write (approve/reject) |
| `x_ori_analyst` | `x_ori_analysis_run` | Read |
| `itil` | All ORI tables | Read |

---

## Configuration Touchpoints

All runtime-adjustable via System Properties. No code changes required to:
- Pause the system (`x_ori.active = false`)
- Change analysis window or pool size ceiling
- Add/remove noise keywords, excluded categories, or risk keywords
- Adjust scoring bonus values
- Switch Claude model or increase max_tokens

---

## Claude API Contract

**Request:** POST `https://api.anthropic.com/v1/messages`

Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`

```
model:      x_ori.claude_model
max_tokens: x_ori.claude_max_tokens (default 4096 — higher than before)
messages:   [
  { role: system, content: <system prompt> },
  { role: user,   content: <incident pool JSON> }
]
```

**System prompt (fixed):**
```
You are an ITSM Problem Management analyst. Your task is to identify
recurring operational risk patterns in the incident data provided.

Group incidents that share a common root cause, even if they involve
different configuration items, categories, or assignment groups.

Do not group incidents based on structural similarity alone. Group them
based on semantic similarity — shared failure modes, root causes, or
operational risk themes.

Return only patterns with genuine recurring risk. If you identify no
meaningful patterns, return an empty patterns array.
```

**Incident pool payload (user message):**
```json
{
  "analysis_context": {
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD",
    "total_incidents": N
  },
  "incidents": [
    {
      "number": "INC0001234",
      "short_description": "...",
      "description": "...",
      "resolution_notes": "...",
      "priority": "2 - High",
      "impact": "2 - Medium",
      "urgency": "2 - Medium",
      "category": "Application",
      "subcategory": "Performance",
      "ci_name": "APP-SERVER-01",
      "assignment_group": "Application Support",
      "risk_score": 75,
      "is_major_incident": false
    }
  ]
}
```

**Required response schema:**
```json
{
  "patterns": [
    {
      "pattern_name": "Java Memory Leak on APP-SERVER-01",
      "pattern_summary": "Recurring JVM heap exhaustion causing application restarts.",
      "root_cause_hypothesis": "...",
      "confidence": 0.87,
      "trend_direction": "increasing",
      "affected_incidents": ["INC0001234", "INC0001256", "INC0001289"],
      "recommended_action": "...",
      "problem_statement": "Recurring JVM memory exhaustion on APP-SERVER-01",
      "primary_ci": "APP-SERVER-01"
    }
  ]
}
```

**Error handling:**
- HTTP 429: retry once after 30 seconds; if retry fails, log and complete with errors
- Any other non-200: log to error_log, run completes with completed_with_errors
- Invalid JSON response: log raw response, run completes with completed_with_errors
- Empty patterns array: valid response — run completes with 0 recommendations
- Pattern confidence < 0.6: skip that pattern; do not create recommendation

---

## Constraints and Assumptions

- ServiceNow instance must permit outbound HTTPS calls to `api.anthropic.com`
- Claude API key is stored as a private sys_property (PDI); production deployments should use the ServiceNow Credential Store
- The `incident` table must have `description`, `close_notes`, `impact`, `urgency`, and `major_incident_state` fields populated for scoring and semantic analysis to be meaningful
- ServiceNow scripting engine is Rhino/ES5 — no ES6+ syntax
- One Claude API call per monthly run — token cost scales with incident pool size; pool is bounded by `x_ori.max_incidents_per_call`
- `max_tokens` set to 4096 (up from 1024) to accommodate multi-pattern responses
