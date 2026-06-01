# Operational Risk Intelligence (ORI) — Design Spec
**Date:** 2026-06-01  
**Scope:** `x_ori` scoped application, ServiceNow PDI  
**AI Integration:** Claude API (Anthropic) via Scripted REST  
**Status:** Approved for implementation

---

## 1. Problem Statement

Organizations repeatedly experience incidents caused by the same underlying issue. Problem Management is reactive — Problem records are created only after multiple incidents have already occurred. No systematic mechanism exists to detect recurring patterns and surface them to Problem Managers before they escalate.

---

## 2. Solution Overview

A scoped ServiceNow application that runs monthly, analyzes incidents from the last 30 days using Claude AI, identifies recurring operational risk patterns, generates recommendations for Problem Managers, and upon human approval, creates Problem records and associates all related incidents.

**Phase 1 (this spec):** Monthly batch analysis, single-approver workflow.  
**Phase 2 (future):** Rolling-window trigger-based analysis, cross-cluster synthesis.

---

## 3. Architecture

### Pipeline Flow

```
Scheduled Job (1st of month)
        │
        ▼
ORIAnalysisEngine.runMonthlyAnalysis()
        │
        ├─► Create x_ori_analysis_run record (status: running)
        │
        ├─► [Stage 0] ORINoiseFilter
        │       Layer 1: Category/subcategory exclusion at GlideRecord query time
        │       Layer 2: Keyword pattern exclusion on fetched incidents
        │       Log excluded count to Analysis Run
        │
        ├─► [Stage 1] ORIClusterBuilder
        │       Query 1: Group by (CI + category + assignment_group)
        │       Query 2: Group by (business_service + category)
        │       Discard clusters below min_incidents threshold
        │       Deduplicate by cluster_key (hash of grouping dimensions)
        │       Persist x_ori_incident_cluster records
        │
        ├─► [Stage 2] ORIClaudeClient — per cluster
        │       Build sanitized prompt (B-subset fields only)
        │       POST to Claude API
        │       Parse structured JSON response
        │       If is_pattern=true AND confidence >= threshold:
        │           Create x_ori_ai_recommendation record
        │           Populate x_ori_recommendation_incident (M2M)
        │       Else: mark cluster skipped
        │
        └─► Update x_ori_analysis_run (status: completed / completed_with_errors / failed)
                Send summary notification to reviewer group

Problem Manager reviews Recommendation record
        │
        ├─► Approve → Business Rule → ORIProblemCreator
        │       Duplicate Problem guard (check open Problem for same CI + category)
        │       If duplicate: link to existing Problem, state = linked_to_existing
        │       Else: create Problem record, populate problem_incident M2M,
        │             write problem reference back, update incident.problem_id
        │
        └─► Reject → capture rejection_reason, state = rejected
```

---

## 4. Table Design

### 4.1 `x_ori_analysis_run`
One record per monthly execution.

| Field | Type | Notes |
|---|---|---|
| `number` | Auto-number | ORI0001001 |
| `run_date` | Date | Month being analyzed |
| `status` | Choice | pending, running, completed, completed_with_errors, failed |
| `incidents_analyzed` | Integer | After noise filtering |
| `incidents_excluded` | Integer | Filtered by noise rules |
| `noise_filter_summary` | String | e.g. "148 excluded: 92 category, 56 keyword" |
| `clusters_found` | Integer | |
| `recommendations_generated` | Integer | |
| `error_log` | Journal | Per-cluster failure details |
| `triggered_by` | Reference → sys_user | |

### 4.2 `x_ori_incident_cluster`
One record per structural group per run.

| Field | Type | Notes |
|---|---|---|
| `analysis_run` | Reference → x_ori_analysis_run | |
| `cluster_key` | String | MD5 hash of grouping dimensions |
| `ci` | Reference → cmdb_ci | Nullable (service-centric clusters) |
| `assignment_group` | Reference → sys_user_group | |
| `business_service` | Reference → cmdb_ci | Nullable (CI-centric clusters) |
| `category` | String | |
| `incident_count` | Integer | |
| `cluster_data` | Long text | Serialized B-subset incident JSON sent to Claude |
| `status` | Choice | pending, analyzed, skipped, failed |

### 4.3 `x_ori_ai_recommendation`
Claude's output — the approval target for Problem Managers.

| Field | Type | Notes |
|---|---|---|
| `number` | Auto-number | REC0001001 |
| `analysis_run` | Reference → x_ori_analysis_run | |
| `cluster` | Reference → x_ori_incident_cluster | |
| `pattern_summary` | String (255) | One-line pattern description |
| `root_cause_hypothesis` | Long text | Claude's reasoning |
| `recommendation_text` | Long text | Proposed Problem Management action |
| `problem_statement` | String (255) | Editable draft Problem short description |
| `severity` | Choice | high, medium, low |
| `confidence_score` | Decimal | 0.0–1.0 from Claude |
| `state` | Choice | pending, approved, rejected, linked_to_existing (linked to pre-existing open Problem) |
| `rejection_reason` | String | Captured on reject |
| `approved_by` | Reference → sys_user | |
| `approval_date` | Date/Time | |
| `problem` | Reference → problem | Populated after approval |

### 4.4 `x_ori_recommendation_incident`
M2M junction — links recommendations to incidents before and after Problem creation.

| Field | Type | Notes |
|---|---|---|
| `recommendation` | Reference → x_ori_ai_recommendation | |
| `incident` | Reference → incident | |

### 4.5 Platform Tables (no schema changes)
- `incident` — read-only source
- `problem` — written on approval
- `problem_incident` — written on approval (native M2M)
- `cmdb_ci`, `sys_user_group` — read for display names

---

## 5. Configuration (sys_properties)

All under the `x_ori` namespace. Managed via System > Properties.

| Property | Default | Purpose |
|---|---|---|
| `x_ori.active` | true | Master kill-switch |
| `x_ori.lookback_days` | 30 | Incident analysis window |
| `x_ori.min_incidents_per_cluster` | 3 | Minimum incidents to form a cluster |
| `x_ori.min_confidence_threshold` | 0.6 | Claude confidence below this = skipped |
| `x_ori.excluded_categories` | Service Request,Access Management,User Administration | Comma-separated |
| `x_ori.excluded_subcategories` | Password Reset,Account Unlock,New User Setup,Duplicate | Comma-separated |
| `x_ori.noise_keywords` | password reset,access request,unlock account,duplicate,new user,vpn access,user creation,permission request,onboarding | Comma-separated |
| `x_ori.claude_model` | claude-opus-4-8 | Claude model ID |
| `x_ori.claude_max_tokens` | 1024 | Max response tokens |
| `x_ori.claude_credential` | _(set at deploy time)_ | Credential Store record name (e.g. `ori_claude_api_key`) |
| `x_ori.reviewer_group` | — | sys_user_group sys_id for notifications |

**API credential** stored in ServiceNow Credential Store (`discovery_credentials`), referenced by name. Never hardcoded.

---

## 6. Script Includes

| Name | Responsibility |
|---|---|
| `ORIAnalysisEngine` | Orchestrates full pipeline, owns Analysis Run lifecycle |
| `ORINoiseFilter` | Stage 0: category/subcategory + keyword exclusion |
| `ORIClusterBuilder` | Stage 1: GlideRecord aggregate grouping, cluster persistence |
| `ORIClaudeClient` | Stage 2: prompt construction, Claude API call, JSON parsing |
| `ORIProblemCreator` | Problem creation, duplicate guard, incident association |

---

## 7. Claude Prompt Design

```
You are an ITSM Problem Management analyst.

Analyze the following group of incidents and determine whether they share
a recurring operational risk pattern that warrants a Problem record.

Cluster Context:
- Configuration Item: {ci_name}
- Assignment Group: {group_name}
- Business Service: {service_name}
- Category / Subcategory: {category} / {subcategory}
- Period: {start_date} to {end_date}
- Incident Count: {n}

Incidents:
{number} | {short_description} | {resolution_notes} | {priority}

Respond ONLY in this JSON format:
{
  "is_pattern": true | false,
  "confidence": 0.0–1.0,
  "pattern_summary": "One sentence.",
  "root_cause_hypothesis": "One paragraph.",
  "recommendation": "Specific action for Problem Management.",
  "severity": "high" | "medium" | "low",
  "problem_statement": "Draft Problem short description (≤160 chars)."
}

If no genuine recurring pattern exists, return {"is_pattern": false} only.
```

**Sanitized fields only (B-subset):** `number`, `short_description`, `resolution_notes`, `priority`, `category`, `subcategory`, CI sys_id resolved to display name, assignment group resolved to name. No user names, no work notes, no emails.

---

## 8. Approval Workflow

1. Recommendation created → notification sent to `x_ori.reviewer_group`
2. Problem Manager opens recommendation form, reviews AI output and related incidents list
3. Problem Manager edits `problem_statement` if needed
4. **Approve** → `state = approved` → Business Rule fires `ORIProblemCreator`
5. **Reject** → prompt for `rejection_reason` → `state = rejected`

**Business Rule:** After update on `x_ori_ai_recommendation`, when `state` changes to `approved`, call `ORIProblemCreator.createProblem(current.sys_id)`.

---

## 9. Problem Creation Logic (`ORIProblemCreator`)

1. **Duplicate guard:** Query open Problems for same CI + category. If found, link recommendation to existing Problem (`state = linked_to_existing`). Stop.
2. Create `problem` record: `short_description` from `problem_statement`, `description` from root cause + recommendation text, `assignment_group` from cluster.
3. Iterate `x_ori_recommendation_incident` → insert rows into `problem_incident` (native M2M).
4. Write new Problem `sys_id` to recommendation's `problem` field.
5. Update `incident.problem_id` for each linked incident.

---

## 10. Error Handling

| Scenario | Behaviour |
|---|---|
| HTTP 429 (rate limit) | Retry once after 30s, then mark cluster failed |
| HTTP 500 / timeout | Mark cluster failed, log response body |
| Invalid JSON from Claude | Log raw response, mark cluster failed |
| `is_pattern: false` | Mark cluster skipped — not an error |
| Confidence < threshold | Mark cluster skipped — not an error |
| Stage 0/1 fatal error | Mark run failed, exit |
| Per-cluster failure | Log to error_log, continue remaining clusters |

**Run status:** `completed` → all clean. `completed_with_errors` → some clusters failed. `failed` → pipeline aborted before producing results.

**Kill-switch:** `ORIAnalysisEngine` checks `x_ori.active` as its first line. If false, logs skip and exits — no Claude API calls made.

---

## 11. Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| Recommendation approval rate | ≥ 70% | approved / (approved + rejected) per run |
| False positive rate | ≤ 30% | rejected / total recommendations |
| Repeat incident reduction | ≥ 20% reduction after 3 months | Incidents linked to resolved Problems vs. baseline |
| Time to Problem creation | < 35 days from first incident | `problem.sys_created_on` - first linked incident `opened_at` |
| Coverage | ≥ 15% of incidents associated with a Problem | incidents in x_ori_recommendation_incident / total incidents analyzed (15% is an initial target — recalibrate after first two runs) |
| Noise filter accuracy | < 5% legitimate incidents excluded | Manual audit sample of excluded incidents |

---

## 12. Minimum Viable Product Scope

**In MVP:**
- Monthly scheduled job
- Two-query structural clustering (CI-centric + service-centric)
- Stage 0 noise filtering (category + keyword)
- Claude API analysis per cluster
- Recommendation records with Approve/Reject
- Problem creation with incident association
- Duplicate Problem guard
- Analysis Run observability record
- Post-run summary notification

**Explicitly out of MVP:**
- Real-time / rolling-window trigger (Phase 2)
- Cross-cluster synthesis prompt (Phase 2)
- Admin configuration UI (use sys_properties directly)
- Service Portal or Workspace review UI (use native list/form)
- Change record correlation
- Embedding-based semantic clustering

---

## 13. Required Permissions (ACLs)

| Role | Access |
|---|---|
| `x_ori_admin` | Full access to all ORI tables + sys_properties |
| `x_ori_analyst` | Read/write on recommendations (approve/reject), read clusters and runs |
| `itil` | Read on recommendations (existing Problem Manager role) |

---
