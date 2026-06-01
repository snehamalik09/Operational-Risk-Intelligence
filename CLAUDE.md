# Operational Risk Intelligence (ORI)

## What This Project Is

A scoped ServiceNow application (`x_ori`) that analyzes resolved incidents monthly using Claude AI, detects recurring operational risk patterns, presents them as human-reviewed recommendations, and creates Problem records upon approval.

**The core loop:** Incidents → Noise filter → Cluster by CI/service → Claude analysis → Recommendation → Problem Manager approval → Problem record.

---

## Key Decisions (and Why)

**Monthly batch, not real-time.**
Trust in AI output needs to be earned first. A monthly batch gives a controlled feedback loop to tune prompts and thresholds. Real-time triggering is Phase 2.

**Two-stage pipeline: structure first, AI second.**
ServiceNow-side grouping (GlideAggregate) is free. Claude is called once per cluster, not once per incident. This keeps token costs bounded and prompts focused.

**Human approval gate is mandatory.**
AI-generated Problem records without review would pollute the Problem backlog. The gate is a simple state field on the recommendation record — not a native ServiceNow approval engine.

**Sanitized data only sent to Claude.**
Short description, resolution notes, priority, category, CI name, group name. No user names, work notes, or email addresses. This is a governance constraint, not a technical one.

**Noise filtering is a first-class stage.**
Password resets and access requests are not operational risk. Without Stage 0, clusters will be dominated by routine service desk work and Claude will surface irrelevant patterns.

**sys_properties over a config table.**
All configuration lives in `x_ori.*` sys_properties, not a custom admin table. Simpler for a PDI and avoids scope creep. A config UI is a Phase 2 consideration.

---

## Application Scope

- **Scope prefix:** `x_ori`
- **Platform:** ServiceNow PDI (Personal Developer Instance)
- **AI provider:** Anthropic Claude API via `sn_ws.RESTMessageV2`
- **Claude model:** `claude-opus-4-8` (configurable via sys_property)

---

## Custom Tables and Justification

Four custom tables are required. Native ServiceNow tables were considered for each.

### `x_ori_analysis_run`
Tracks each monthly pipeline execution: run date, status, incident counts, cluster counts, recommendation counts, error log.

**Why custom:** `sys_trigger_history` tracks scheduler execution but is read-only platform metadata. It cannot hold domain-specific observability fields. No native "analysis run" concept exists in ServiceNow.

### `x_ori_incident_cluster`
Represents one structural group of incidents (e.g., all Application incidents on CI PRD-DB01 assigned to the DBA team). Holds the serialized incident data sent to Claude.

**Why custom:** There is no native ServiceNow concept of an analytical incident cluster. The nearest alternatives (`cmdb_rel_ci`, `sn_ml_*`) are either CI relationship tables or platform ML tables not designed for this use case.

### `x_ori_ai_recommendation`
Claude's output for one cluster — pattern summary, root cause hypothesis, recommendation, draft Problem statement, confidence score, approval state.

**Why custom, not `problem`:** Creating a `problem` record for every AI suggestion defeats the purpose of the approval gate. Unvalidated AI output must not appear in the Problem backlog. The recommendation is a *pre-Problem* artifact.

**Why not extend `task`:** Extending `task` would provide free assignment, SLAs, and notifications, but adds schema overhead and portal visibility that is unnecessary for MVP. A custom table keeps scope tight.

### `x_ori_recommendation_incident`
M2M junction linking each recommendation to its source incidents.

**Why custom, not `problem_incident`:** The native `problem_incident` table links Problems to Incidents. At recommendation time, no Problem exists yet. This junction must exist *before* the Problem is created so that the Problem Manager can see which incidents triggered the recommendation. After approval, `ORIProblemCreator` uses this table to populate `incident.problem_id`.

---

## Pipeline Stages

```
Stage 0 — Noise Filter
  Exclude known-routine categories/subcategories at query time.
  Exclude keyword-matched descriptions per record.

Stage 1 — Cluster Builder
  GlideAggregate query 1: group by (CI + category + assignment_group)
  GlideAggregate query 2: group by (business_service + category)
  Discard clusters below minimum incident threshold.
  Skip clusters already processed this calendar month (MD5 dedup).

Stage 2 — Claude Analysis (per cluster)
  Build sanitized prompt from cluster incident data.
  Call Claude API via RESTMessageV2.
  Parse JSON response.
  If is_pattern=true AND confidence >= threshold: create Recommendation.
  Else: mark cluster skipped.

Approval — Human Gate
  Problem Manager reviews Recommendation form.
  Approve: Business Rule triggers ORIProblemCreator.
  Reject: capture reason, close recommendation.

Problem Creation
  Duplicate guard: check for open Problem on same CI+category.
  If found: link recommendation to existing Problem.
  Else: create Problem, associate incidents, update incident.problem_id.
```

---

## Script Include Responsibilities

| Script Include | Owns |
|---|---|
| `ORINoiseFilter` | Category/subcategory exclusion queries; keyword matching; exclusion counters |
| `ORIClusterBuilder` | GlideAggregate grouping; cluster persistence; incident data serialization; deduplication |
| `ORIClaudeClient` | Prompt construction; API call; 429 retry; JSON parsing; confidence threshold |
| `ORIProblemCreator` | Duplicate guard; Problem creation; incident association |
| `ORIAnalysisEngine` | Pipeline orchestration; Analysis Run lifecycle; per-cluster error isolation; event firing |

---

## What is NOT in MVP

- Real-time / rolling-window pattern detection
- Cross-cluster synthesis (Claude reviewing all cluster summaries together)
- Change record correlation
- Embedding-based semantic clustering
- Admin configuration UI (use sys_properties directly)
- Service Portal or Workspace review UI (use native list/form)

---

## Testing Approach

Tests are ServiceNow background scripts (System > Background Scripts). There is no local test runner. Each Script Include has a corresponding test file in `tests/` that can be pasted directly into the background script console.

`tests/smoke-test.js` seeds 4 test incidents and runs the full pipeline end-to-end.

---

## Deployment Checklist

Before going live on a PDI:
- [ ] `x_ori.active` = true
- [ ] `x_ori.claude_api_key` set to a valid Anthropic API key (mark private)
- [ ] `x_ori.reviewer_group` set to a real sys_user_group sys_id
- [ ] Outbound calls to `api.anthropic.com` permitted from the instance
- [ ] At least one user has the `x_ori_analyst` role
- [ ] Scheduled job active and set to run on the 1st of each month
