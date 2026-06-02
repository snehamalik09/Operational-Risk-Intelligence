# ORI Notifications Setup Guide

One notification is required: a run summary email sent after each monthly analysis completes.

Problem Managers review pending recommendations by navigating to `x_ori_ai_recommendation.list` directly, or via the link in the run summary email.

---

## Notification: ORI - Monthly Run Summary (Event-Driven)

### Step 1: Register the Custom Event

1. Navigate to **System Policy > Events > Registry**
2. Click **New**
3. Configure as follows:

| Field | Value |
|-------|-------|
| **Name** | x_ori.analysis.complete |
| **Table** | x_ori_analysis_run |
| **Application** | x_ori (Operational Risk Intelligence) |

4. Click **Submit**

### Step 2: Create the Notification

1. Navigate to **System Notification > Email > Notifications**
2. Click **New**
3. Configure as follows:

| Field | Value |
|-------|-------|
| **Name** | ORI - Monthly Run Summary |
| **Table** | x_ori_analysis_run |
| **Send when** | Event fired |
| **Event name** | x_ori.analysis.complete |
| **Active** | true |

### Recipients

- **PDI testing:** add your own user account via **Specific people**
- **Production:** use the group stored in sys_property `x_ori.reviewer_group`

### Email Template

**Subject:**
```
[ORI] Monthly Analysis Complete — ${status} | ${recommendations_generated} recommendations
```

**Body:**
```
Operational Risk Intelligence — Monthly Analysis Summary

Status:                    ${status}
Run Date:                  ${run_date}
Incidents Analyzed:        ${incidents_analyzed}
Incidents Excluded:        ${incidents_excluded} (${noise_filter_summary})
Clusters Found:            ${clusters_found}
Recommendations Generated: ${recommendations_generated}

${error_log}

View the full run record: ${URI}
```

---

## Verification

1. Trigger a manual run via the Scheduled Job (**Execute Now**)
2. Confirm the `x_ori.analysis.complete` event fires (check **System Policy > Events > Log**)
3. Verify the email appears in **System Notification > Email > Outgoing**
4. Open the email and confirm variables (`${status}`, `${recommendations_generated}`, etc.) are populated

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Email not received | Spam folder; verify recipient address on the notification record |
| Event not firing | Confirm `gs.eventQueue('x_ori.analysis.complete', ...)` is called in `ORIAnalysisEngine._executeAnalysis` |
| Variables not populated | Confirm field names match exactly on `x_ori_analysis_run` table |
| `x_ori.reviewer_group` missing | Create the sys_property with the desired group's sys_id as value |
