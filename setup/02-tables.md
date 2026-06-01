# Setup Guide 2: Create Custom Tables

This guide walks you through creating the four custom tables required for the Operational Risk Intelligence application.

## Prerequisites
- Completed **Setup Guide 1: Scaffold the Scoped Application**
- ServiceNow Studio open with the `x_ori` scope active
- Access to create tables and fields

## Overview

Four tables will be created in this guide:
1. **x_ori_analysis_run** — Stores analysis batch runs
2. **x_ori_incident_cluster** — Stores grouped/clustered incidents
3. **x_ori_ai_recommendation** — Stores AI-generated recommendations
4. **x_ori_recommendation_incident** — Junction table linking recommendations to incidents

---

## Table 1: x_ori_analysis_run

This table tracks each analysis run and its results.

### Create the Table
1. In ServiceNow Studio, right-click on **Tables** in the left panel
2. Select **New Table**
3. Configure the basic settings:

| Setting | Value |
|---------|-------|
| **Table Label** | Analysis Run |
| **Table Name** | x_ori_analysis_run |
| **Extends** | (leave empty or select "Task") |
| **Auto Number Prefix** | ORI |
| **Auto Number Start At** | 1001 |

4. Click **Create**

### Add Fields to x_ori_analysis_run

Add the following fields to the table. For each field, right-click in the fields list and select **New Field**:

| Field Label | Field Name | Type | Length | Default | Other Settings |
|-------------|-----------|------|--------|---------|-----------------|
| Run Date | run_date | Date | - | - | - |
| Status | status | Choice | - | pending | Choices: pending, running, completed, completed_with_errors, failed |
| Incidents Analyzed | incidents_analyzed | Integer | - | 0 | - |
| Incidents Excluded | incidents_excluded | Integer | - | 0 | - |
| Noise Filter Summary | noise_filter_summary | String | 255 | - | - |
| Clusters Found | clusters_found | Integer | - | 0 | - |
| Recommendations Generated | recommendations_generated | Integer | - | 0 | - |
| Error Log | error_log | Journal | - | - | - |
| Triggered By | triggered_by | Reference | - | - | References: sys_user |

---

## Table 2: x_ori_incident_cluster

This table stores incident clusters identified by the analysis.

### Create the Table
1. In ServiceNow Studio, right-click on **Tables** in the left panel
2. Select **New Table**
3. Configure the basic settings:

| Setting | Value |
|---------|-------|
| **Table Label** | Incident Cluster |
| **Table Name** | x_ori_incident_cluster |
| **Extends** | (leave empty) |

4. Click **Create**

### Add Fields to x_ori_incident_cluster

Add the following fields to the table:

| Field Label | Field Name | Type | Length | Other Settings |
|-------------|-----------|------|--------|-----------------|
| Analysis Run | analysis_run | Reference | - | References: x_ori_analysis_run |
| Cluster Key | cluster_key | String | 100 | - |
| CI | ci | Reference | - | References: cmdb_ci |
| Assignment Group | assignment_group | Reference | - | References: sys_user_group |
| Business Service | business_service | Reference | - | References: cmdb_ci |
| Category | category | String | 100 | - |
| Incident Count | incident_count | Integer | - | Default: 0 |
| Cluster Data | cluster_data | Long Text | - | - |
| Status | status | Choice | - | Choices: pending, analyzed, skipped, failed |

---

## Table 3: x_ori_ai_recommendation

This table stores AI-generated recommendations based on clusters.

### Create the Table
1. In ServiceNow Studio, right-click on **Tables** in the left panel
2. Select **New Table**
3. Configure the basic settings:

| Setting | Value |
|---------|-------|
| **Table Label** | AI Recommendation |
| **Table Name** | x_ori_ai_recommendation |
| **Extends** | (leave empty) |
| **Auto Number Prefix** | REC |
| **Auto Number Start At** | 1001 |

4. Click **Create**

### Add Fields to x_ori_ai_recommendation

Add the following fields to the table:

| Field Label | Field Name | Type | Length | Other Settings |
|-------------|-----------|------|--------|-----------------|
| Analysis Run | analysis_run | Reference | - | References: x_ori_analysis_run |
| Cluster | cluster | Reference | - | References: x_ori_incident_cluster |
| Pattern Summary | pattern_summary | String | 255 | - |
| Root Cause Hypothesis | root_cause_hypothesis | Long Text | - | - |
| Recommendation Text | recommendation_text | Long Text | - | - |
| Problem Statement | problem_statement | String | 255 | - |
| Severity | severity | Choice | - | Choices: high, medium, low |
| Confidence Score | confidence_score | Decimal | - | Decimal places: 2 |
| State | state | Choice | - | Choices: pending, approved, rejected, linked_to_existing |
| Rejection Reason | rejection_reason | String | 500 | - |
| Approved By | approved_by | Reference | - | References: sys_user |
| Approval Date | approval_date | Date/Time | - | - |
| Problem | problem | Reference | - | References: problem |

---

## Table 4: x_ori_recommendation_incident

This is a junction table that links recommendations to their associated incidents.

### Create the Table
1. In ServiceNow Studio, right-click on **Tables** in the left panel
2. Select **New Table**
3. Configure the basic settings:

| Setting | Value |
|---------|-------|
| **Table Label** | Recommendation Incident |
| **Table Name** | x_ori_recommendation_incident |
| **Extends** | (leave empty) |

4. Click **Create**

### Add Fields to x_ori_recommendation_incident

Add the following fields to the table:

| Field Label | Field Name | Type | Other Settings |
|-------------|-----------|------|-----------------|
| Recommendation | recommendation | Reference | References: x_ori_ai_recommendation |
| Incident | incident | Reference | References: incident |

---

## Verification Steps

After creating all four tables, verify they are correctly configured:

### 1. Check Table Visibility in Studio
1. In ServiceNow Studio, expand the **Tables** section
2. You should see all four tables listed:
   - x_ori_analysis_run
   - x_ori_incident_cluster
   - x_ori_ai_recommendation
   - x_ori_recommendation_incident

### 2. Test Table Access
1. Navigate to each table's list view to confirm they are accessible
   - Search for `x_ori_analysis_run` in the main search bar
   - Repeat for other three tables
2. Each table should open and show an empty list view (since no data exists yet)

### 3. Verify Auto-numbering (for applicable tables)
1. For **x_ori_analysis_run** and **x_ori_ai_recommendation**, test creating a record
2. Verify the auto-number field generates correctly (ORI-1001, REC-1001, etc.)
3. Delete the test records when complete

## Next Steps

Once all four tables are created and verified, proceed to **Setup Guide 3: Create Roles and Properties** to configure the required roles and system properties.

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| Cannot create table in scope x_ori | Ensure the scoped application was created in Setup Guide 1 and the scope is active |
| Reference field not finding target table | Verify the target table name is spelled correctly (case-sensitive) |
| Auto-number field not generating | Check that **Auto Number Prefix** and **Auto Number Start At** are configured; restart browser if needed |
| Table appears but cannot modify | Ensure you have the appropriate application context selected |
