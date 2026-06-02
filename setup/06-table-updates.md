# ORI Table Updates for Architecture v1.1

Apply these changes in ServiceNow Studio before deploying the revised Script Includes.

---

## 1. Delete `x_ori_incident_cluster` table

This table is no longer used. Structural clustering has been replaced by Claude semantic analysis.

1. Navigate to **System Definition > Tables**
2. Search for `x_ori_incident_cluster`
3. Open the record and click **Delete**
4. Confirm deletion

> If existing cluster records exist from earlier testing, they will be deleted with the table. This is safe — no production data depends on them.

---

## 2. Update `x_ori_analysis_run`

### 2a — Rename `clusters_found` → `patterns_identified`

1. Open the `x_ori_analysis_run` table in Studio
2. Find the `clusters_found` column
3. Change the **Column name** to `patterns_identified` and the **Label** to `Patterns Identified`
4. Save

### 2b — Add `total_incidents_reviewed` field

| Field | Type | Label |
|---|---|---|
| `total_incidents_reviewed` | Integer | Total Incidents Reviewed |

---

## 3. Update `x_ori_ai_recommendation`

### 3a — Remove `cluster` reference field

1. Open the `x_ori_ai_recommendation` table in Studio
2. Find the `cluster` column (Reference → x_ori_incident_cluster)
3. Delete it

### 3b — Add new fields

Add each field via the table's **Columns** tab:

| Label | Column name | Type | Notes |
|---|---|---|---|
| Pattern Name | `pattern_name` | String | Max length: 255 |
| Dedup Key | `dedup_key` | String | Max length: 500 |
| Trend Direction | `trend_direction` | Choice | Values: increasing, stable, decreasing |
| Primary CI | `primary_ci` | String | Max length: 255 — stores display name |
| Linked Incidents | `linked_incidents` | Long text | JSON: [{number, sys_id}, ...] |

### 3c — Verify `severity` field remains

The `severity` field (Choice: high, medium, low) should still exist. It is now populated by the system based on confidence score rather than by Claude directly.

---

## 4. Add new sys_properties

Navigate to **System Properties > Properties** and create:

| Name | Default Value | Private | Description |
|---|---|---|---|
| `x_ori.max_incidents_per_call` | 200 | No | Pool ceiling — truncated by risk score |
| `x_ori.operational_categories` | Database,Application,Performance,Network,Infrastructure | No | Receive category score bonus |
| `x_ori.category_score_bonus` | 15 | No | Points added for operational category |
| `x_ori.keyword_score_bonus` | 10 | No | Points added per risk keyword match |
| `x_ori.risk_keywords` | timeout,latency,outage,memory leak,deadlock,service unavailable,connection failure,crash,disk full,high cpu | No | Risk keyword scoring list |

### Update existing sys_properties

| Property | Old value | New value |
|---|---|---|
| `x_ori.claude_max_tokens` | 1024 | **4096** — responses are now multi-pattern |
| `x_ori.excluded_categories` | (existing) | Review and update: Password Reset,Access Request,VPN Access,Mailbox Request,Printer Request,Software Installation |
| `x_ori.noise_keywords` | (existing) | Review and update: reset password,unlock account,access required,distribution list,email access |

### Remove obsolete sys_property

| Property | Action |
|---|---|
| `x_ori.min_incidents_per_cluster` | Delete — clustering is removed |

---

## 5. Verification checklist

After applying all table changes:

- [ ] `x_ori_incident_cluster` table is deleted
- [ ] `x_ori_analysis_run.patterns_identified` field exists (was `clusters_found`)
- [ ] `x_ori_analysis_run.total_incidents_reviewed` field exists
- [ ] `x_ori_ai_recommendation.cluster` field is deleted
- [ ] `x_ori_ai_recommendation.pattern_name` field exists
- [ ] `x_ori_ai_recommendation.dedup_key` field exists
- [ ] `x_ori_ai_recommendation.trend_direction` field exists (Choice)
- [ ] `x_ori_ai_recommendation.primary_ci` field exists (String 255)
- [ ] `x_ori_ai_recommendation.linked_incidents` field exists (Long text)
- [ ] `x_ori.max_incidents_per_call` sys_property exists
- [ ] `x_ori.claude_max_tokens` updated to 4096
