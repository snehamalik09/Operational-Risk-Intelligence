# ORI Future Enhancements

These are explicitly out of MVP scope. Each item has a prerequisite: the approval rate metric from at least two production runs should be ≥ 70% before Phase 2 is started. Building on an unvalidated AI foundation is expensive.

---

## Phase 2 — Real-Time Pattern Detection

**What:** Instead of (or in addition to) monthly batch analysis, monitor incidents continuously. When N incidents from the same CI/category arrive within a rolling window (e.g., 3 incidents in 7 days), trigger an immediate analysis.

**Why it matters:** The monthly batch is still reactive — a pattern that emerges in week 1 waits 3 weeks to be surfaced. A threshold trigger is genuinely proactive.

**What it requires:**
- A Business Rule on the `incident` table (on insert/update to resolved state)
- A rolling-window counter, likely using a separate tracking table or GlideCache
- Deduplication logic to avoid firing the analysis multiple times for the same emerging pattern
- Rate-limiting to prevent overwhelming the Claude API during incident storms

**Risk:** If the AI quality is not yet proven, real-time noise will overwhelm Problem Managers. Validate batch quality first.

---

## Phase 2 — Cross-Cluster Synthesis

**What:** After all per-cluster analyses complete, run a second Claude call that receives all cluster summaries for the run and asks: "Do any of these clusters suggest a shared underlying theme?"

**Why it matters:** Some root causes span multiple CIs or assignment groups. A storage firmware bug might cause incidents across 12 different CIs, none of which individually meets the cluster threshold.

**What it requires:**
- A second prompt template for synthesis analysis
- A new recommendation type (cross-cluster) on `x_ori_ai_recommendation`
- Token budget management — synthesis prompts grow with cluster count

**Risk:** High token cost. Should be opt-in via a sys_property.

---

## Phase 2 — Change Record Correlation

**What:** When clustering incidents, check whether a recent change (within a configurable pre/post window, e.g., ±3 days) touched the same CI. Include change context in the Claude prompt.

**Why it matters:** A significant portion of recurring incidents are caused by change-related regressions. Claude reasoning about "these 4 incidents followed a change to PRD-DB01" produces more actionable root cause hypotheses.

**What it requires:**
- A query against `change_request` and `task_ci` to find changes affecting the cluster's CI
- Change data added to the cluster_data JSON
- Prompt template updated to include change context section
- Careful scoping — correlation is not causation, and Claude must be instructed accordingly

---

## Phase 3 — Recommendation Workspace

**What:** A dedicated ServiceNow Now Experience UI Builder workspace where Problem Managers review all pending recommendations in a single view, with filters by severity, confidence, assignment group, and business service.

**Why it matters:** The native list/form view works but is not optimised for the review workflow. A workspace can show the related incidents inline, highlight the AI confidence visually, and enable bulk approve/reject.

**What it requires:**
- UI Builder experience and page design
- UX design for the recommendation card (pattern, severity, confidence, incident count)
- Role-scoped visibility

---

## Phase 3 — Approval Analytics Dashboard

**What:** A Performance Analytics or Reporting dashboard showing:
- Approval rate over time
- False positive rate by assignment group
- Top recurring CIs (most frequently surfaced in recommendations)
- Time-to-Problem-creation trend
- Incident recurrence rate on Problems created by ORI vs. manual Problems

**Why it matters:** Without measurement, there is no signal to improve the AI or tune thresholds. The dashboard is what makes ORI a continuous improvement tool, not just a one-time feature.

---

## Phase 3 — Configurable Admin UI

**What:** A form-based configuration screen inside ServiceNow where administrators can manage noise keywords, excluded categories, and thresholds without navigating to System Properties.

**Why it matters:** sys_properties require admin navigation and are easy to misconfigure. A purpose-built UI can validate inputs (e.g., prevent setting confidence threshold above 1.0), show current effective configuration, and provide a reset-to-defaults option.

---

## Phase 3 — Credential Store Migration

**What:** Move the Claude API key from a private sys_property to the ServiceNow Credential Store (`discovery_credentials`), referenced by name.

**Why it matters:** The sys_property approach is acceptable on a PDI but not appropriate for production. The Credential Store provides audit logging, rotation support, and finer-grained access control.

**What it requires:** A one-line change in `ORIClaudeClient` — replace `gs.getProperty('x_ori.claude_api_key')` with a Credential Store lookup. The credential name remains stored as a sys_property.

---

## Deferred Investigations (Not Yet Scoped)

These are ideas worth exploring but not yet defined enough to plan:

- **Semantic clustering:** Use embeddings to group incidents by meaning rather than structure. Would catch patterns across CIs that share the same failure mode described differently. Requires an embedding provider (Claude does not expose embeddings directly).

- **Incident quality scoring:** Before clustering, score each incident's data quality (are resolution notes populated? Is the CI set?). Surface low-quality incidents to their assignment group so the data improves over time.

- **Problem effectiveness tracking:** After a Problem is resolved, automatically check whether linked incidents recurred within 90 days. Feed this back as a "did this recommendation actually help?" metric.
