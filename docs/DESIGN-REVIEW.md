# ORI Design Self-Review
**Premise:** Challenge every decision. Propose the simplest MVP that still delivers value.

---

## Custom Tables — Verdict by Verdict

### `x_ori_incident_cluster` — ELIMINATE

**The challenge:** This table was justified as needed for deduplication, per-cluster observability, and as a link between the pipeline and the recommendation. None of these holds up under scrutiny.

**Dedup:** The scheduled job runs once a month. The dedup logic (MD5 hash + month-boundary check) was added to handle manual re-triggers. That is an edge case, not a core requirement. If an admin re-runs the job manually and gets duplicate recommendations, Problem Managers reject the duplicates. That is acceptable behavior for MVP. The dedup added a GlideRecord query per cluster, a GlideDigest hash, and a `cluster_key` field — all to solve a problem that may never occur.

**Per-cluster observability:** The Analysis Run record already tells you how many clusters were found, how many produced recommendations, and how many failed. Knowing *which specific cluster* failed is useful for debugging but is not required for the system to function. Problem Managers don't look at cluster records.

**The link:** If `x_ori_incident_cluster` is eliminated, its fields (CI, assignment_group, business_service, category, cluster_data) move directly onto `x_ori_ai_recommendation`. The recommendation becomes the single record that a Problem Manager opens, which is where that data belongs anyway.

**What is lost:** Per-cluster status tracking (analyzed / skipped / failed). The Analysis Run error_log can absorb this information as text entries, which is sufficient for MVP debugging.

**Net change:** Eliminate `x_ori_incident_cluster`. Add CI, assignment_group, business_service, category, incident_count, and cluster_data directly to `x_ori_ai_recommendation`. The recommendation record is the right home for this context — the Problem Manager needs it to make a decision.

---

### `x_ori_recommendation_incident` — ELIMINATE

**The challenge:** This M2M table was justified as needed for the related list on the recommendation form and for `_associateIncidents` to iterate over incidents when setting `problem_id`.

**On the related list:** The Problem Manager's decision is based on `pattern_summary`, `root_cause_hypothesis`, `confidence_score`, and `incident_count`. A list of 4–15 incident numbers is supporting evidence, not the deciding factor. For MVP, `incident_count` in the recommendation header and the incident sys_ids embedded in `cluster_data` JSON are sufficient.

**On `_associateIncidents`:** `cluster_data` already contains every incident's `sys_id`. Parsing that JSON to set `incident.problem_id` requires one extra `JSON.parse()` call. The M2M table was adding a second storage location for data that already existed.

**What is lost:** A native ServiceNow related list showing linked incidents on the recommendation form. This is a genuine UX loss. A Problem Manager who wants to open an individual incident to verify context cannot do so without navigating manually. This is a reasonable Phase 2 addition once the core workflow is validated.

**Net change:** Eliminate `x_ori_recommendation_incident`. `ORIProblemCreator._associateIncidents` parses `recommendation.cluster_data` JSON directly.

---

### `x_ori_analysis_run` — KEEP (reduced)

Legitimate. There is no native ServiceNow table that tracks a custom pipeline execution. Problem Managers and admins need to know whether the run completed, how many recommendations were generated, and what errors occurred. Keep — but eliminate the counter fields that were added for metrics (`incidents_analyzed`, `incidents_excluded`, `noise_filter_summary`, `clusters_found`). These are observability-nice-to-haves. The minimum viable run record needs only: `run_date`, `status`, `recommendations_generated`, `error_log`, `triggered_by`.

---

### `x_ori_ai_recommendation` — KEEP (expanded)

The core entity. Keep. With the cluster table eliminated, add: `ci`, `assignment_group`, `business_service`, `category`, `incident_count`, `cluster_data` to this table. The recommendation record becomes self-contained — everything the Problem Manager needs is on one form.

---

### Net table count: 4 → 2

| Table | Decision |
|---|---|
| `x_ori_analysis_run` | Keep, reduce to 6 fields |
| `x_ori_incident_cluster` | **Eliminate** — fields absorbed by recommendation |
| `x_ori_ai_recommendation` | Keep, absorbs cluster fields |
| `x_ori_recommendation_incident` | **Eliminate** — cluster_data JSON is sufficient |

---

## Script Includes — Verdict by Verdict

### `ORINoiseFilter` — FOLD INTO `ORIClusterBuilder`

**The challenge:** ORINoiseFilter is 60 lines that provide two methods (`applyQueryFilters`, `isNoise`) and load three sys_properties. It exists as a separate class for "single responsibility" and testability. Neither justification holds for MVP on a PDI.

Single responsibility at this scale is premature design. The noise filter is not independently reusable by any other component — only `ORIClusterBuilder` calls it. There is no future component that will need `ORINoiseFilter` without also using `ORIClusterBuilder`.

Testability: the two methods can be tested through `ORIClusterBuilder` tests just as easily.

**Net change:** Fold `applyQueryFilters()`, `isNoise()`, and the sys_property loading directly into `ORIClusterBuilder.initialize()` and use them as private helpers. Remove the `ORINoiseFilter` Script Include.

---

### `ORIClusterBuilder` — KEEP (simplified)

Legitimate separation. The clustering logic is the most complex part of the pipeline. Keep.

However, the **service-centric clustering query** (grouping by business_service + category) should be dropped from MVP. Reasons:

1. On a fresh PDI or early production instance, `business_service` is often empty on incidents. The query returns nothing.
2. Two aggregate queries double the complexity of the clustering stage without proven value.
3. The CI-centric query (`CI + category + assignment_group`) covers the primary use case. Service-centric is a broader view that belongs in Phase 2 once CI-centric is validated.

**Net change:** One GlideAggregate query, not two. Remove `_buildServiceClusters()`.

Also remove the **monthly dedup logic** (`_persistCluster` cluster_key check). As argued above, re-trigger deduplication is an edge case. Remove the GlideDigest dependency and the month-boundary query.

---

### `ORIClaudeClient` — KEEP (interface change)

Legitimate. API communication belongs in its own component.

One unnecessary complexity: `analyzeCluster(clusterSysId)` takes a sys_id and fetches the cluster record internally. This couples the API client to the ServiceNow data model. It should take `clusterData` (a plain object) instead, and the caller (`ORIAnalysisEngine`) should pass the data in. This makes `ORIClaudeClient` a pure API client with no GlideRecord dependencies — easier to test, easier to swap.

---

### `ORIProblemCreator` — KEEP

Legitimate. Problem creation logic is distinct from pipeline orchestration and belongs in its own class.

With the M2M table eliminated, `_associateIncidents` simplifies to parsing `cluster_data` JSON from the recommendation record.

---

### `ORIAnalysisEngine` — KEEP (simplified)

Legitimate. The orchestrator needs to exist. It becomes simpler because it no longer creates cluster records — it creates recommendations directly.

---

### Net Script Include count: 5 → 4

| Script Include | Decision |
|---|---|
| `ORINoiseFilter` | **Eliminated** — folded into ORIClusterBuilder |
| `ORIClusterBuilder` | Keep, remove service-centric query and dedup |
| `ORIClaudeClient` | Keep, take clusterData object instead of sys_id |
| `ORIProblemCreator` | Keep, simplify _associateIncidents |
| `ORIAnalysisEngine` | Keep, create recommendations directly (no cluster table) |

---

## Business Rule — ELIMINATE

**The challenge:** The Business Rule fires `ORIProblemCreator.createProblem()` when `recommendation.state` changes to `approved`. This was added for correctness — it ensures Problem creation fires regardless of how the state changes (UI, API, import set, another Business Rule).

For MVP, the only supported way to approve a recommendation is the UI Action. There is no API integration, no import set, no other automation. A Business Rule that handles programmatic state changes is defending against a scenario that does not exist in MVP.

**Net change:** Move the `ORIProblemCreator.createProblem()` call directly into the Approve UI Action server script. If a future integration needs to approve recommendations programmatically, add the Business Rule then.

---

## Other Unnecessary Complexity

### Two notification types
The design specified two notifications: one per recommendation (Inserted trigger) and one run summary (event-driven). For MVP, the run summary email is sufficient. Problem Managers don't need an email per recommendation — they should check the recommendations list periodically or after receiving the run summary. The per-recommendation notification increases email noise and adds setup complexity (event registry, recipient scripting).

**Simplification:** One notification (run summary). Problem Managers navigate to `x_ori_ai_recommendation.list` to review.

### Roles (x_ori_admin and x_ori_analyst)
Two custom roles were defined. For a PDI, `admin` covers configuration and `itil` covers Problem Manager access. Custom roles add setup steps without providing value on a personal development instance.

**Simplification:** On PDI, skip custom roles. Use `admin` for configuration and `itil` for recommendation review. Add custom roles when deploying to a shared or production instance.

### The confidence threshold as a filter in `_parseResponse`
The confidence threshold check is correct. But the threshold itself (0.6) was stated as a sys_property `x_ori.min_confidence_threshold`. This means the Claude API response is filtered by a number the admin sets without understanding how Claude calibrates its own confidence scores. For MVP, hardcode 0.6 and remove the sys_property. Tune it empirically after seeing real run data, then expose it as a configurable property.

---

## The Simplest MVP

Two tables. Four Script Includes. Zero Business Rules.

### Tables

**`x_ori_analysis_run`** (6 fields)
run_date, status (pending/running/completed/completed_with_errors/failed), recommendations_generated, error_log, triggered_by, number (auto)

**`x_ori_ai_recommendation`** (16 fields)
number (auto), analysis_run, ci, assignment_group, category, incident_count, cluster_data, pattern_summary, root_cause_hypothesis, recommendation_text, problem_statement (editable), severity, confidence_score, state (pending/approved/rejected/linked_to_existing), rejection_reason, problem

### Script Includes

**`ORIClusterBuilder`** — includes noise filtering; one CI-centric GlideAggregate query; serializes incident data; no dedup

**`ORIClaudeClient`** — takes clusterData object; builds prompt; calls API; parses response; handles 429 and errors

**`ORIProblemCreator`** — duplicate guard; creates Problem; parses cluster_data JSON to associate incidents

**`ORIAnalysisEngine`** — orchestrates pipeline; creates Analysis Run; calls ClusterBuilder, ClaudeClient, creates recommendations; handles per-cluster errors; updates run status

### Other artifacts

**UI Actions (×2):** Approve (sets state=approved, calls ORIProblemCreator directly), Reject (prompts for reason, sets state=rejected)

**Scheduled Job (×1):** Monthly, calls ORIAnalysisEngine.runMonthlyAnalysis()

**Notification (×1):** Run summary email on analysis.complete event

**sys_properties (×8):** active, lookback_days, min_incidents_per_cluster, excluded_categories, excluded_subcategories, noise_keywords, claude_model, claude_api_key

### What this MVP does not have (and does not need)

- Cluster records (admins debug from the error_log on the run record)
- Recommendation-incident M2M table (incidents linked via cluster_data JSON)
- Business Rule (Problem creation triggered from UI Action directly)
- Service-centric clustering (too unreliable on most instances)
- Monthly dedup (edge case, not worth the complexity)
- Per-recommendation notifications (run summary is enough)
- Custom roles (use itil and admin on PDI)
- Confidence threshold as a sys_property (hardcode 0.6, tune later)

### What is genuinely lost

| Feature | Impact |
|---|---|
| No cluster record | Admins cannot see per-cluster status; error_log text is the only debug surface |
| No M2M incident table | Problem Managers cannot open linked incidents from a related list on the recommendation form |
| No service-centric clustering | Patterns that span multiple CIs under one Business Service are not detected |
| No dedup | Manual job re-triggers create duplicate recommendations |
| No per-recommendation notification | Problem Managers must proactively check the list or rely on the run summary |

Each of these is a reasonable Phase 2 addition once the core pattern detection is validated.

---

## Summary of Changes from Original Design

| Dimension | Original | Simplified MVP |
|---|---|---|
| Custom tables | 4 | 2 |
| Script Includes | 5 | 4 |
| Business Rules | 1 | 0 |
| Clustering strategies | 2 (CI + service) | 1 (CI only) |
| Monthly dedup | Yes | No |
| Notification types | 2 | 1 |
| Custom roles | 2 | 0 (use native roles) |
| Configurable confidence threshold | Yes | No (hardcoded 0.6) |
