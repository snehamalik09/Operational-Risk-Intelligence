# ORI MVP Architecture

## Overview

The application is a scoped ServiceNow app (`x_ori`) composed of five Script Includes, one Business Rule, two UI Actions, one Scheduled Job, and four custom tables. There are no external dependencies beyond the Anthropic Claude API.

---

## Data Flow

```
ServiceNow Scheduler (1st of month, 02:00)
│
▼
ORIAnalysisEngine
│
├── Creates Analysis Run record (status: running)
│
├── ORINoiseFilter
│     Reads sys_properties: excluded_categories, excluded_subcategories, noise_keywords
│     Produces: query filter conditions + per-record isNoise() check
│
├── ORIClusterBuilder
│     Input:  incident table (resolved/closed, last 30 days, post-filter)
│     Output: x_ori_incident_cluster records with serialized incident JSON
│     Method: GlideAggregate grouping × 2 strategies (CI-centric, service-centric)
│
├── ORIClaudeClient  [called once per cluster]
│     Input:  cluster_data JSON (sanitized B-subset fields)
│     Output: { is_pattern, confidence, pattern_summary, root_cause_hypothesis,
│               recommendation, severity, problem_statement }
│     Method: RESTMessageV2 POST to api.anthropic.com/v1/messages
│
├── ORIAnalysisEngine._createRecommendation
│     Creates: x_ori_ai_recommendation + x_ori_recommendation_incident rows
│
└── Updates Analysis Run (status: completed / completed_with_errors / failed)
      Fires event: x_ori.analysis.complete → run summary notification

─────────────────────────────────────────────

Problem Manager opens x_ori_ai_recommendation form
│
├── Reviews: pattern_summary, root_cause_hypothesis, recommendation_text,
│            confidence_score, related incidents (related list)
│
├── (Optional) Edits problem_statement field
│
├── Clicks Approve
│     UI Action sets state = approved
│     Business Rule fires ORIProblemCreator
│     │
│     ├── Duplicate guard: open Problem for same CI+category?
│     │     Yes → link to existing, state = linked_to_existing
│     │     No  → create Problem record
│     │
│     └── _associateIncidents: sets incident.problem_id for each linked incident
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
  ORIAnalysisEngine        orchestrates pipeline, owns Analysis Run record
  ORIClusterBuilder        stage 1: noise filtering + groups incidents into structural clusters
  ORIClaudeClient          stage 2: calls Claude API, parses response

Action layer
  ORIProblemCreator        creates Problem, guards duplicates, links incidents
  Business Rule            triggers ORIProblemCreator on approval state change
  UI Actions (×2)          Approve and Reject buttons on recommendation form

Notification layer
  Notification (event)     sends run summary after analysis completes (x_ori.analysis.complete)
```

---

## Custom Table Relationships

```
x_ori_analysis_run  (1)
  │
  ├── (many) x_ori_incident_cluster
  │              │
  │              └── (many) x_ori_ai_recommendation
  │                              │
  │                              ├── (many) x_ori_recommendation_incident
  │                              │              └── → incident (native)
  │                              │
  │                              └── → problem (native, set on approval)
  │
  └── [triggered_by] → sys_user (native)
```

---

## Security Model

| Role | Tables | Operations |
|---|---|---|
| `x_ori_admin` | All ORI tables | Read, write, delete |
| `x_ori_analyst` | `x_ori_ai_recommendation` | Read, write (approve/reject) |
| `x_ori_analyst` | `x_ori_analysis_run`, `x_ori_incident_cluster` | Read |
| `itil` | All ORI tables | Read |

---

## Configuration Touchpoints

All configuration is runtime-adjustable via System Properties. No code changes required to:
- Pause the system (`x_ori.active = false`)
- Change analysis window (30 → 60 days)
- Add noise keywords or excluded categories
- Switch Claude model
- Change minimum cluster size or confidence threshold

---

## API Contract (Claude)

**Request:** POST `https://api.anthropic.com/v1/messages`

Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`

Body schema:
```
model:      x_ori.claude_model (e.g. claude-opus-4-8)
max_tokens: x_ori.claude_max_tokens (default 1024)
messages:   [ { role: user, content: <prompt> } ]
```

**Response shape Claude must return:**
```json
{
  "is_pattern": true,
  "confidence": 0.0–1.0,
  "pattern_summary": "string",
  "root_cause_hypothesis": "string",
  "recommendation": "string",
  "severity": "high|medium|low",
  "problem_statement": "string (≤160 chars)"
}
```
If no pattern: `{ "is_pattern": false }`

**Error handling:**
- HTTP 429: retry once after 30 seconds
- Any other non-200: log and mark cluster failed, continue run
- Invalid/non-JSON response: log and mark cluster failed, continue run
- Confidence below threshold: mark cluster skipped (not an error)

---

## Constraints and Assumptions

- ServiceNow instance must permit outbound HTTPS calls to `api.anthropic.com`
- Claude API key is stored as a private sys_property (PDI) — production deployments should use the ServiceNow Credential Store
- The `incident` table must have `cmdb_ci`, `business_service`, `category`, `assignment_group`, and `close_notes` fields populated for clustering to be meaningful
- ServiceNow scripting engine is Rhino/ES5 — no ES6+ syntax
- GlideDigest is used for cluster key hashing (MD5 Base64)
