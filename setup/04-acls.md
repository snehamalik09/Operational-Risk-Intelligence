# Setup Guide 4: Configure ACLs (Access Control Lists)

This guide walks you through creating Access Control List (ACL) records to define permissions for the Operational Risk Intelligence application roles on custom tables.

## Prerequisites
- Completed **Setup Guide 3: Create Roles and System Properties**
- Roles `x_ori_admin` and `x_ori_analyst` created
- All four custom tables created (x_ori_analysis_run, x_ori_incident_cluster, x_ori_ai_recommendation, x_ori_recommendation_incident)
- Administrator role

---

## Overview: ACL Permission Model

The ORI application uses a three-tier permission model:

| Role | x_ori Tables | ITIL Tables (incident, problem, etc.) | Access |
|------|---------------|---------|--------|
| **x_ori_analyst** | Write | Read | Create/modify recommendations; read incidents and problems |
| **x_ori_admin** | Write | Write | Full administrative access to ORI tables; full access to ITIL tables |
| **itil** | Read | Read | View ORI data and ITIL tables (reporting/visibility) |

---

## Part 1: Create ACL for x_ori_analyst

This role can write (create, read, update, delete) recommendations and analysis data.

### Create Write ACL for x_ori_analyst on x_ori_ai_recommendation

1. In the search bar, type `sys_security_acl.list` and press Enter
2. Click **New** to create a new ACL record
3. Fill in the fields:

| Field | Value |
|-------|-------|
| **Name** | x_ori_ai_recommendation |
| **Table** | x_ori_ai_recommendation |
| **Operation** | write |
| **Grantable** | true |
| **Role** | x_ori_analyst |
| **Filter** | (leave blank) |

4. Click **Insert** to create the ACL
5. Verify the record was created

**Optional: Create read ACL for other tables**

To allow x_ori_analyst to read from other ORI tables, repeat the above steps for:
- **Table:** x_ori_analysis_run, **Operation:** read
- **Table:** x_ori_incident_cluster, **Operation:** read
- **Table:** x_ori_recommendation_incident, **Operation:** read

---

## Part 2: Create Read ACLs for itil Role

The `itil` role should have read-only access to all ORI tables for reporting and visibility purposes.

### Create Read ACL for itil on Each ORI Table

Repeat the following steps for each table: `x_ori_analysis_run`, `x_ori_incident_cluster`, `x_ori_ai_recommendation`, `x_ori_recommendation_incident`

1. In the search bar, type `sys_security_acl.list` and press Enter
2. Click **New**
3. Fill in the fields:

| Field | Value |
|-------|-------|
| **Name** | [table name] (e.g., x_ori_analysis_run) |
| **Table** | [corresponding table] |
| **Operation** | read |
| **Grantable** | false |
| **Role** | itil |
| **Filter** | (leave blank) |

4. Click **Insert**
5. Repeat for the remaining three tables

After completing all four read ACLs, the `itil` role will have visibility into all ORI data.

---

## Part 3: Create Write ACLs for x_ori_admin

The `x_ori_admin` role has full administrative access to all ORI tables.

### Create Write ACL for x_ori_admin on Each ORI Table

Repeat the following steps for each table: `x_ori_analysis_run`, `x_ori_incident_cluster`, `x_ori_ai_recommendation`, `x_ori_recommendation_incident`

1. In the search bar, type `sys_security_acl.list` and press Enter
2. Click **New**
3. Fill in the fields:

| Field | Value |
|-------|-------|
| **Name** | [table name] (e.g., x_ori_analysis_run) |
| **Table** | [corresponding table] |
| **Operation** | write |
| **Grantable** | true |
| **Role** | x_ori_admin |
| **Filter** | (leave blank) |

4. Click **Insert**
5. Repeat for the remaining three tables

After completing all four write ACLs, the `x_ori_admin` role will have full administrative control over ORI data.

---

## Part 4: Summary of ACLs to Create

Use this checklist to ensure all required ACLs are in place:

### x_ori_analyst Role
- [ ] Write ACL on x_ori_ai_recommendation

**Optional (for read access to other tables):**
- [ ] Read ACL on x_ori_analysis_run
- [ ] Read ACL on x_ori_incident_cluster
- [ ] Read ACL on x_ori_recommendation_incident

### itil Role
- [ ] Read ACL on x_ori_analysis_run
- [ ] Read ACL on x_ori_incident_cluster
- [ ] Read ACL on x_ori_ai_recommendation
- [ ] Read ACL on x_ori_recommendation_incident

### x_ori_admin Role
- [ ] Write ACL on x_ori_analysis_run
- [ ] Write ACL on x_ori_incident_cluster
- [ ] Write ACL on x_ori_ai_recommendation
- [ ] Write ACL on x_ori_recommendation_incident

---

## Part 5: Verification Steps

### Verify ACLs Were Created

1. In the search bar, type `sys_security_acl.list` and press Enter
2. Filter for ACLs related to `x_ori` by searching in the **Name** field
3. You should see all the ACLs you created listed

### Test Permission Enforcement

#### Test 1: Switch to x_ori_analyst Role
1. Using a different browser window or private window, log in as a user with the `x_ori_analyst` role
2. Navigate to the `x_ori_ai_recommendation` table list
3. Verify you can:
   - [ ] View the table list
   - [ ] Create a new recommendation (click **New**)
   - [ ] Edit an existing recommendation
   - [ ] Delete a recommendation (if created)
4. If any of these fail, return to ACL configuration and verify the write permission is set correctly

#### Test 2: Switch to itil Role
1. Using a different browser window, log in as a user with the `itil` role
2. Try to navigate to `x_ori_analysis_run` table list
3. Verify you can:
   - [ ] View the table list (read access)
   - [ ] View individual records
4. Verify you **cannot**:
   - [ ] Click **New** to create a record
   - [ ] Edit a record
5. If you can perform write operations, return to ACL configuration and ensure the operation is set to **read** (not **write**)

#### Test 3: Switch to x_ori_admin Role
1. Using a different browser window, log in as a user with the `x_ori_admin` role
2. Navigate to all four ORI tables
3. Verify you can:
   - [ ] View all tables
   - [ ] Create, edit, and delete records on each table
4. If any operations fail, return to ACL configuration and verify write ACLs are set for this role

---

## Part 6: Advanced Configuration (Optional)

### Field-Level Security (Optional)

If you need to restrict access to specific fields (e.g., hide the `x_ori.claude_api_key` from certain users), you can create **field-level ACLs**:

1. In the search bar, type `sys_security_acl.list`
2. Click **New**
3. Set:
   - **Name:** [field name you want to restrict]
   - **Table:** [table name]
   - **Operation:** read (or write)
   - **Type:** Field (if available as an option)
   - **Role:** [role you want to restrict]

This is optional and only needed if certain fields should be hidden from specific roles.

---

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| Table names not appearing in ACL dropdown | Ensure the table names match exactly (case-sensitive): x_ori_analysis_run, x_ori_incident_cluster, x_ori_ai_recommendation, x_ori_recommendation_incident |
| Role names not appearing in dropdown | Create the roles in Setup Guide 3 before creating ACLs; refresh the browser if roles don't appear |
| User cannot access table even with correct role | ACLs can take 5-10 minutes to propagate; ask the user to log out and back in, or clear their browser cache |
| User can perform operations despite read-only ACL | Verify the ACL **Operation** is set to **read** (not write); users with admin role override ACLs, so test with a non-admin user |
| Too many ACLs created | You can safely delete duplicate ACLs from the sys_security_acl list; no data will be lost |

---

## Next Steps

Once all ACLs are created and verified, the ORI application setup is complete. Your instance is ready for:
- Developing business rules and automation
- Creating Flow Designer workflows
- Building custom UI forms
- Configuring integrations with Anthropic's Claude API

## Summary of Setup Completion

To confirm all setup is complete, verify:

- [ ] **Setup Guide 1:** Scoped application `x_ori` created
- [ ] **Setup Guide 2:** Four custom tables created with all fields
- [ ] **Setup Guide 3:** Roles `x_ori_admin` and `x_ori_analyst` created; all 11 properties configured; API key set
- [ ] **Setup Guide 4:** All required ACLs created and tested

You are now ready to proceed with application development!
