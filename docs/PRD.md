# Product Requirements Document
## Operational Risk Intelligence (ORI)
**Version:** 1.0 — MVP
**Date:** 2026-06-02
**Status:** Approved for development

---

## 1. Problem Statement

Organizations repeatedly experience incidents caused by the same underlying issue. Problem Management is reactive — Problem records are created only after multiple incidents have already occurred and often only after a manager manually notices a pattern. No systematic mechanism exists to surface recurring operational risk before it escalates.

**The gap:** Incident data contains the signal. No one is reading it at scale.

---

## 2. Goals

- Automatically detect recurring incident patterns using AI analysis
- Surface those patterns as human-reviewed recommendations before Problem records are created
- Reduce the time between a pattern emerging and a Problem record being opened
- Give Problem Managers structured, evidence-backed input rather than relying on intuition

## 3. Non-Goals (MVP)

- Real-time alerting (Phase 2)
- Change record correlation
- Automated Problem resolution
- Embedding-based or semantic clustering
- Cross-cluster pattern synthesis
- Custom UI or Workspace views (use native list/form)
- Integration with third-party ITSM tools

---

## 4. User Personas

### Problem Manager
Reviews AI-generated recommendations, edits the proposed Problem statement if needed, and approves or rejects. Does not configure the system.

### ORI Administrator
Configures noise filters, thresholds, the Claude API credential, and the reviewer group. Monitors monthly analysis run records.

### ITSM Process Owner (observer)
Reads analysis run summaries and approval rate metrics to assess system value. No direct interaction with the tool.

---

## 5. Functional Requirements

### FR-1: Monthly Analysis Run
The system shall execute a monthly analysis job that processes all resolved and closed incidents from the last 30 days (configurable). The analysis window and run schedule shall be configurable by an administrator without code changes.

### FR-2: Noise Filtering
Before analysis, the system shall exclude incidents that represent routine service desk activity rather than operational risk. Exclusion shall operate on two layers:
- Category and subcategory values (configurable list, applied at query time)
- Keywords in the short description (configurable list, applied per record)

The run record shall report how many incidents were excluded.

### FR-3: Structural Clustering
The system shall group qualifying incidents into clusters using two grouping strategies:
- **CI-centric:** group by Configuration Item + Category + Assignment Group
- **Service-centric:** group by Business Service + Category

Clusters with fewer incidents than a configurable minimum threshold shall be discarded. Clusters that were already processed in the current calendar month shall be skipped.

### FR-4: AI Pattern Analysis
For each qualifying cluster, the system shall call the Claude API with a sanitized subset of incident data and ask Claude to determine whether a recurring operational risk pattern exists.

The data sent to Claude shall be limited to: incident number, short description, resolution notes (close_notes), priority, category, subcategory, CI display name, assignment group name. User names, work notes, and email addresses shall not be sent.

Claude shall return a structured JSON response. The system shall treat any response with confidence below a configurable threshold as "no pattern found."

### FR-5: Recommendation Records
When Claude identifies a pattern with sufficient confidence, the system shall create an AI Recommendation record containing:
- Pattern summary (one sentence)
- Root cause hypothesis
- Recommended Problem Management action
- Proposed Problem record short description (editable by the reviewer)
- Severity (high/medium/low) and confidence score
- Links to all related incidents

### FR-6: Human Approval Gate
A Problem Manager shall review each recommendation via a standard ServiceNow form. They may edit the proposed Problem statement before acting. Two actions shall be available:
- **Approve** — creates a Problem record and associates all linked incidents
- **Reject** — captures a mandatory rejection reason and closes the recommendation

### FR-7: Problem Creation
Upon approval, the system shall:
1. Check whether an open Problem already exists for the same CI and category. If so, link the recommendation to the existing Problem instead of creating a duplicate.
2. Otherwise, create a new Problem record with the approved short description, a description derived from the root cause hypothesis and recommendation, and the assignment group from the cluster.
3. Set `problem_id` on each linked incident.

### FR-8: Observability
Each monthly run shall produce an Analysis Run record showing: incidents analyzed, incidents excluded, clusters found, recommendations generated, per-cluster status (analyzed / skipped / failed), and a full error log. A notification shall be sent to a configurable reviewer group summarising the run outcome.

### FR-9: Kill-Switch
The system shall check a single system property (`x_ori.active`) before executing any analysis. If false, the run exits immediately with no API calls made.

### FR-10: Error Isolation
A failure to analyze one cluster (API error, malformed response, timeout) shall be logged and skipped. The run shall continue processing remaining clusters and complete with status `completed_with_errors` rather than aborting.

---

## 6. Data Requirements

### Incidents Sent to Claude (sanitized subset)
| Field | ServiceNow Column | Rationale |
|---|---|---|
| Incident number | `number` | Identification |
| Short description | `short_description` | Semantic signal |
| Resolution notes | `close_notes` | How it was resolved |
| Priority | `priority` (display value) | Severity context |
| Category | `category` | Structural grouping |
| Subcategory | `subcategory` | Additional context |
| CI name | `cmdb_ci.name` | Display name only, not sys_id |
| Assignment group name | `assignment_group.name` | Display name only |

**Explicitly excluded:** caller name, assigned_to, work_notes, description (body), opened_by, resolved_by, email addresses.

---

## 7. Configuration Properties

All properties use the `x_ori.*` namespace and are managed via System > Properties.

| Property | Default | Description |
|---|---|---|
| `x_ori.active` | true | Master kill-switch |
| `x_ori.lookback_days` | 30 | Analysis window |
| `x_ori.min_incidents_per_cluster` | 3 | Minimum cluster size |
| `x_ori.min_confidence_threshold` | 0.6 | Claude confidence floor |
| `x_ori.excluded_categories` | Service Request, Access Management, User Administration | Comma-separated |
| `x_ori.excluded_subcategories` | Password Reset, Account Unlock, New User Setup, Duplicate | Comma-separated |
| `x_ori.noise_keywords` | password reset, access request, duplicate, new user, vpn access, onboarding... | Comma-separated |
| `x_ori.claude_model` | claude-opus-4-8 | Claude model ID |
| `x_ori.claude_max_tokens` | 1024 | Max tokens per cluster response |
| `x_ori.claude_api_key` | (private) | Anthropic API key |
| `x_ori.reviewer_group` | (required) | sys_user_group sys_id for notifications |

---

## 8. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Recommendation approval rate | ≥ 70% | approved ÷ (approved + rejected) per run |
| False positive rate | ≤ 30% | rejected ÷ total recommendations |
| Repeat incident reduction | ≥ 20% after 3 months | Incidents on Problems resolved by ORI vs. baseline |
| Time to Problem creation | < 35 days from first incident | problem.sys_created_on minus first linked incident.opened_at |
| Noise filter accuracy | < 5% legitimate incidents excluded | Manual audit of a random excluded sample |

Approval rate and false positive rate should be reviewed after the first two runs and thresholds recalibrated before treating them as KPIs.

---

## 9. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Incident data quality is poor (blank resolution notes) | High | Claude skips clusters with no_incidents; confidence threshold rejects weak patterns |
| Claude API unavailable or rate-limited | Medium | 429 retry once; per-cluster failure isolation; run completes with partial results |
| Problem Managers overwhelmed by recommendations | Medium | Minimum cluster threshold filters small patterns; confidence threshold filters uncertain ones |
| PII in incident descriptions sent to Claude | Low | Sanitized field list excludes user-identifying fields; `close_notes` reviewed for PII risk pre-deployment |
| Duplicate Problem records created | Low | Duplicate guard checks open Problems for same CI + category before creating new one |

---

## 10. Acceptance Criteria

- [ ] Monthly scheduled job completes with status `completed` or `completed_with_errors`
- [ ] Analysis Run record accurately reflects incidents analyzed, excluded, clusters found, and recommendations generated
- [ ] At least one recommendation created from seeded test data with confidence ≥ 0.6
- [ ] Approving a recommendation creates a Problem record with correct short_description and assignment_group
- [ ] All linked incidents have `problem_id` populated after approval
- [ ] Rejecting a recommendation captures rejection_reason and sets state to rejected
- [ ] Duplicate guard prevents a second Problem being created for the same CI+category when an open Problem exists
- [ ] Kill-switch (x_ori.active=false) prevents any Claude API calls
- [ ] A cluster failure does not abort the remaining run
