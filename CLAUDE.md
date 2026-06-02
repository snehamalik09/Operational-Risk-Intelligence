# Operational Risk Intelligence (ORI)

## What This Project Is

A scoped ServiceNow application (`x_ori`) that analyzes resolved incidents monthly using Claude AI, detects recurring operational risk patterns, presents them as human-reviewed recommendations, and creates Problem records upon approval.

**The core loop:** Incidents → Noise filter → Risk score → Claude semantic analysis (full pool, one call) → Recommendations → Problem Manager approval → Problem record.

---

## Key Decisions (and Why)

**Monthly batch, not real-time.**
Trust in AI output needs to be earned first. A monthly batch gives a controlled feedback loop to tune prompts and thresholds. Real-time triggering is Phase 2.

**Semantic detection, not structural clustering.**
The original design grouped incidents by CI + Category + Assignment Group before sending them to Claude. This was rejected because incidents sharing the same CI and category can represent completely different problems (database timeout vs. memory leak vs. storage exhaustion), while incidents across different CIs can represent the same problem (JVM memory leak appearing on 4 app servers). Claude receives the full scored incident pool and groups by root cause semantically. ServiceNow handles filtering, scoring, and governance — Claude handles pattern recognition.

**One Claude call per run, not one per cluster.**
Token cost scales with pool size, bounded by `x_ori.max_incidents_per_call`. Pool is sorted by risk score and truncated if needed — highest-risk incidents always analysed first.

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

Two custom tables are required. Native ServiceNow tables were considered for each.

### `x_ori_analysis_run`
Tracks each monthly pipeline execution: run date, status, incident counts (reviewed / excluded / analyzed), patterns identified, recommendations generated, error log.

**Why custom:** `sys_trigger_history` tracks scheduler execution but is read-only platform metadata. It cannot hold domain-specific observability fields. No native "analysis run" concept exists in ServiceNow.

### `x_ori_ai_recommendation`
Claude's output for one identified pattern — pattern name, pattern summary, root cause hypothesis, recommendation, draft Problem statement, confidence score, trend direction, primary CI, linked incidents (JSON), dedup key, approval state.

**Why custom, not `problem`:** Creating a `problem` record for every AI suggestion defeats the purpose of the approval gate. Unvalidated AI output must not appear in the Problem backlog. The recommendation is a *pre-Problem* artifact.

**Why not extend `task`:** Extending `task` adds 80+ fields and portal visibility that is unnecessary for MVP. A custom table keeps scope tight.

**Incident linkage:** The `linked_incidents` Long Text field stores a JSON array of `{number, sys_id}` pairs identifying the incidents Claude grouped into this pattern. No separate M2M junction table is required — `ORIProblemCreator` parses this JSON directly when associating incidents with the created Problem.

---

## Pipeline Stages

```
Stage 1 — Noise Filtering (ORIAnalysisEngine)
  Layer 1: category/subcategory exclusion at query time (configurable lists)
  Layer 2: keyword exclusion per record (configurable list)
  Track: total_incidents_reviewed, incidents_excluded, incidents_analyzed

Stage 2 — Incident Risk Scoring (ORIIncidentScorer)
  Per incident: Priority + Impact + Urgency + Major Incident flag
               + Category bonus + Risk keyword bonus
  Score is informational — included in Claude payload, not used as filter

Stage 3 — Pool Preparation (ORIAnalysisEngine)
  Sort by risk score descending
  Truncate to x_ori.max_incidents_per_call if needed
  Sanitize: include description fields, exclude PII

Stage 4 — Claude Semantic Analysis (ORIClaudeClient)
  Single API call with full incident pool
  Claude groups incidents by root cause — crosses CI/category boundaries
  Returns: patterns[] each with affected_incidents[], confidence, trend_direction

Stage 5 — Dedup + Recommendation Creation (ORIAnalysisEngine)
  dedup_key = pattern_name + '|' + primary_ci
  Skip if active recommendation with same dedup_key exists this month
  Create x_ori_ai_recommendation; resolve incident numbers to sys_ids

Approval — Human Gate
  Problem Manager reviews Recommendation form
  Approve: UI Action calls ORIProblemCreator directly
  Reject: capture reason, state = rejected

Problem Creation (ORIProblemCreator)
  Duplicate guard: open Problem where CI = primary_ci
                   AND short_description STARTS WITH first 40 chars of pattern_name?
  If found: link to existing, state = linked_to_existing
  Else: create Problem, set incident.problem_id for all linked incidents
```

---

## Script Include Responsibilities

| Script Include | Owns |
|---|---|
| `ORIIncidentScorer` | Deterministic risk score calculation per incident (priority, impact, urgency, major incident, category bonus, keyword bonus) |
| `ORIClaudeClient` | Payload preparation; single pool-based API call; multi-pattern response parsing; confidence threshold filtering |
| `ORIProblemCreator` | Duplicate guard (pattern_name prefix + CI); Problem creation; incident association via linked_incidents JSON |
| `ORIAnalysisEngine` | Pipeline orchestration; noise filtering; pool truncation; dedup check; Analysis Run lifecycle; error isolation; event firing |

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
