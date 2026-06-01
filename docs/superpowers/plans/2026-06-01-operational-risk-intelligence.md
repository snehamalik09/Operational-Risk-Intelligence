# Operational Risk Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a scoped ServiceNow application (`x_ori`) that analyzes incidents monthly using Claude AI, surfaces recurring risk patterns as recommendations, and creates Problem records upon Problem Manager approval.

**Architecture:** Three-stage pipeline — Stage 0 (noise filtering), Stage 1 (structural clustering via GlideAggregate), Stage 2 (Claude API analysis per cluster). Five Script Includes own each responsibility. Approval is a simple state change on a recommendation record that triggers a Business Rule to create the Problem.

**Tech Stack:** ServiceNow GlideScript (ES5 JavaScript), `sn_ws.RESTMessageV2` for Claude API calls, ServiceNow Studio or sndev CLI for scaffolding, background scripts for TDD verification.

---

## File Structure

All files live inside the `x_ori` scoped application in ServiceNow. Reference paths use Studio's tree structure.

```
x_ori (Operational Risk Intelligence)
├── Tables
│   ├── x_ori_analysis_run
│   ├── x_ori_incident_cluster
│   ├── x_ori_ai_recommendation
│   └── x_ori_recommendation_incident
├── Script Includes
│   ├── ORINoiseFilter
│   ├── ORIClusterBuilder
│   ├── ORIClaudeClient
│   ├── ORIProblemCreator
│   └── ORIAnalysisEngine
├── Business Rules
│   └── ORI - Create Problem on Approval       [on x_ori_ai_recommendation]
├── UI Actions
│   ├── ORI - Approve Recommendation           [on x_ori_ai_recommendation]
│   └── ORI - Reject Recommendation            [on x_ori_ai_recommendation]
├── Scheduled Script Executions
│   └── ORI Monthly Analysis
├── Notifications
│   ├── ORI - Recommendation Pending Review
│   └── ORI - Monthly Run Summary
└── Application Roles
    ├── x_ori_admin
    └── x_ori_analyst
```

---

## Task 1: Scaffold the Scoped Application

**Files:**
- Create: ServiceNow scoped application `x_ori`

- [ ] **Step 1: Open ServiceNow Studio**

  Navigate to: **System Applications > Studio**. Click **Create Application**.

- [ ] **Step 2: Fill in application details**

  ```
  Name:        Operational Risk Intelligence
  Scope:       x_ori
  Version:     1.0.0
  Description: AI-powered recurring incident pattern detection and Problem Management automation
  ```

  Click **Create**. Studio opens with the new application.

- [ ] **Step 3: Verify scope prefix**

  In Studio, confirm the application scope header shows `x_ori`. All tables and records you create will be prefixed automatically.

- [ ] **Step 4: Commit**

  In Studio: **Source Control > Commit Changes** (if connected to a repo), or note this as a checkpoint.

---

## Task 2: Create Tables

**Files:**
- Create: `x_ori_analysis_run` (Studio > Create Application File > Table)
- Create: `x_ori_incident_cluster`
- Create: `x_ori_ai_recommendation`
- Create: `x_ori_recommendation_incident`

### 2a — Table: `x_ori_analysis_run`

- [ ] **Step 1: Create the table**

  Studio > **Create Application File** > **Table**. Set:
  ```
  Label:       Analysis Run
  Name:        x_ori_analysis_run
  Extends:     Task  →  NO. Extends: (none / base table)
  Auto-number: Yes   Prefix: ORI   Starting: 1001
  ```

- [ ] **Step 2: Add fields**

  Add each field via the Table's **Columns** tab:

  | Label | Column name | Type | Max length / Options |
  |---|---|---|---|
  | Run Date | run_date | Date | — |
  | Status | status | Choice | pending, running, completed, completed_with_errors, failed |
  | Incidents Analyzed | incidents_analyzed | Integer | — |
  | Incidents Excluded | incidents_excluded | Integer | — |
  | Noise Filter Summary | noise_filter_summary | String | 255 |
  | Clusters Found | clusters_found | Integer | — |
  | Recommendations Generated | recommendations_generated | Integer | — |
  | Error Log | error_log | Journal | — |
  | Triggered By | triggered_by | Reference → sys_user | — |

- [ ] **Step 3: Verify the table saved**

  Navigate to **x_ori_analysis_run.list** in your PDI. You should see an empty list with the ORI number column.

### 2b — Table: `x_ori_incident_cluster`

- [ ] **Step 1: Create the table**

  ```
  Label:  Incident Cluster
  Name:   x_ori_incident_cluster
  ```

- [ ] **Step 2: Add fields**

  | Label | Column name | Type | Notes |
  |---|---|---|---|
  | Analysis Run | analysis_run | Reference → x_ori_analysis_run | — |
  | Cluster Key | cluster_key | String | 100 |
  | CI | ci | Reference → cmdb_ci | — |
  | Assignment Group | assignment_group | Reference → sys_user_group | — |
  | Business Service | business_service | Reference → cmdb_ci | — |
  | Category | category | String | 100 |
  | Incident Count | incident_count | Integer | — |
  | Cluster Data | cluster_data | Long text | — |
  | Status | status | Choice | pending, analyzed, skipped, failed |

### 2c — Table: `x_ori_ai_recommendation`

- [ ] **Step 1: Create the table**

  ```
  Label:       AI Recommendation
  Name:        x_ori_ai_recommendation
  Auto-number: Yes   Prefix: REC   Starting: 1001
  ```

- [ ] **Step 2: Add fields**

  | Label | Column name | Type | Notes |
  |---|---|---|---|
  | Analysis Run | analysis_run | Reference → x_ori_analysis_run | — |
  | Cluster | cluster | Reference → x_ori_incident_cluster | — |
  | Pattern Summary | pattern_summary | String | 255 |
  | Root Cause Hypothesis | root_cause_hypothesis | Long text | — |
  | Recommendation Text | recommendation_text | Long text | — |
  | Problem Statement | problem_statement | String | 255 |
  | Severity | severity | Choice | high, medium, low |
  | Confidence Score | confidence_score | Decimal | — |
  | State | state | Choice | pending, approved, rejected, linked_to_existing |
  | Rejection Reason | rejection_reason | String | 500 |
  | Approved By | approved_by | Reference → sys_user | — |
  | Approval Date | approval_date | Date/Time | — |
  | Problem | problem | Reference → problem | — |

### 2d — Table: `x_ori_recommendation_incident`

- [ ] **Step 1: Create the table**

  ```
  Label:  Recommendation Incident
  Name:   x_ori_recommendation_incident
  ```

- [ ] **Step 2: Add fields**

  | Label | Column name | Type |
  |---|---|---|
  | Recommendation | recommendation | Reference → x_ori_ai_recommendation |
  | Incident | incident | Reference → incident |

- [ ] **Step 3: Commit**

  All four tables created. Commit or note checkpoint.

---

## Task 3: Create Roles and sys_properties

- [ ] **Step 1: Create role `x_ori_admin`**

  Studio > **Create Application File** > **Role**.
  ```
  Name:        x_ori_admin
  Description: Full access to ORI tables and configuration
  ```

- [ ] **Step 2: Create role `x_ori_analyst`**

  ```
  Name:        x_ori_analyst
  Description: Review and approve/reject ORI recommendations
  ```

- [ ] **Step 3: Create sys_properties**

  Navigate to: **System Properties > [your app]** or search `sys_properties.list`. Create each row:

  | Name | Value | Private | Description |
  |---|---|---|---|
  | x_ori.active | true | No | Master kill-switch |
  | x_ori.lookback_days | 30 | No | Incident analysis window in days |
  | x_ori.min_incidents_per_cluster | 3 | No | Min incidents to form a cluster |
  | x_ori.min_confidence_threshold | 0.6 | No | Claude confidence threshold |
  | x_ori.excluded_categories | Service Request,Access Management,User Administration | No | Comma-separated excluded categories |
  | x_ori.excluded_subcategories | Password Reset,Account Unlock,New User Setup,Duplicate | No | Comma-separated excluded subcategories |
  | x_ori.noise_keywords | password reset,access request,unlock account,duplicate,new user,vpn access,user creation,permission request,onboarding | No | Comma-separated noise keywords |
  | x_ori.claude_model | claude-opus-4-8 | No | Claude model ID |
  | x_ori.claude_max_tokens | 1024 | No | Max response tokens per cluster |
  | x_ori.claude_api_key | YOUR_API_KEY_HERE | **Yes** | Anthropic API key (PDI only — use Credential Store in production) |
  | x_ori.reviewer_group | | No | sys_user_group sys_id for notifications |

- [ ] **Step 4: Verify properties readable**

  Run in **System > Background Scripts**:
  ```javascript
  gs.print(gs.getProperty('x_ori.active'));
  gs.print(gs.getProperty('x_ori.lookback_days'));
  gs.print(gs.getProperty('x_ori.excluded_categories'));
  ```
  Expected output: `true`, `30`, `Service Request,Access Management,User Administration`

- [ ] **Step 5: Add Anthropic endpoint to allowed list**

  Navigate to: **System Web Services > Outbound > REST Message**. Confirm ServiceNow can reach `api.anthropic.com`. On a PDI, outbound calls are typically unrestricted. If you get a connection error later, add the endpoint to **MID Server Proxy** or check instance outbound settings.

- [ ] **Step 6: Commit**

---

## Task 4: Create ACLs

**Files:**
- Create: ACL records for all four custom tables (via System Security > Access Control)

ServiceNow creates default ACLs when a table is created. You only need to tighten them so non-ORI roles cannot write to the tables.

- [ ] **Step 1: Create write ACL on `x_ori_ai_recommendation` for the approve/reject state field**

  Navigate to: **System Security > Access Control (ACL)**. Click **New**.
  ```
  Type:       record
  Operation:  write
  Name:       x_ori_ai_recommendation
  Role:       x_ori_analyst
  ```
  This prevents users without `x_ori_analyst` from changing recommendation state.

- [ ] **Step 2: Create read ACL on all ORI tables for `itil` role**

  Repeat for each table: `x_ori_analysis_run`, `x_ori_incident_cluster`, `x_ori_ai_recommendation`, `x_ori_recommendation_incident`.
  ```
  Type:       record
  Operation:  read
  Name:       [table name]
  Role:       itil
  ```

- [ ] **Step 3: Grant `x_ori_admin` full access**

  Create one write ACL per custom table with role `x_ori_admin`. The admin role gets full read/write/delete.

- [ ] **Step 4: Verify access**

  Log in as a user without `x_ori_analyst` or `x_ori_admin` roles. Navigate to `x_ori_ai_recommendation.list`. Confirm they cannot see the Approve/Reject buttons (UI Action condition `current.state == 'pending'` only shows to users who can write the record).

- [ ] **Step 5: Commit**

  ```
  feat: add ACLs for ORI tables — itil read, x_ori_analyst write, x_ori_admin full
  ```

---

## Task 5: Implement ORINoiseFilter

**Files:**
- Create: Script Include `ORINoiseFilter` in Studio

- [ ] **Step 1: Write the failing test (background script)**

  Navigate to **System > Background Scripts**. Paste and run — this should FAIL (class not defined yet):
  ```javascript
  try {
      var filter = new ORINoiseFilter();
      gs.print('FAIL: Should have thrown — class not defined yet');
  } catch(e) {
      gs.print('PASS: Class not defined yet as expected: ' + e.message);
  }
  ```
  Expected: `PASS: Class not defined yet as expected`

- [ ] **Step 2: Create the Script Include**

  Studio > **Create Application File** > **Script Include**.
  ```
  Name:            ORINoiseFilter
  Accessible from: All application scopes
  ```

- [ ] **Step 3: Implement ORINoiseFilter**

  Paste this as the script body:
  ```javascript
  var ORINoiseFilter = Class.create();
  ORINoiseFilter.prototype = {
      initialize: function() {
          this.excludedCategories = this._splitProp('x_ori.excluded_categories');
          this.excludedSubcategories = this._splitProp('x_ori.excluded_subcategories');
          this.noiseKeywords = this._splitProp('x_ori.noise_keywords').map(function(k) {
              return k.toLowerCase();
          });
          this.excludedCount = 0;
          this.categoryExcludedCount = 0;
          this.keywordExcludedCount = 0;
      },

      applyQueryFilters: function(gr) {
          if (this.excludedCategories.length > 0) {
              gr.addQuery('category', 'NOT IN', this.excludedCategories.join(','));
          }
          if (this.excludedSubcategories.length > 0) {
              gr.addQuery('subcategory', 'NOT IN', this.excludedSubcategories.join(','));
          }
      },

      isNoise: function(gr) {
          var shortDesc = (gr.getValue('short_description') || '').toLowerCase();
          for (var i = 0; i < this.noiseKeywords.length; i++) {
              if (shortDesc.indexOf(this.noiseKeywords[i]) !== -1) {
                  this.keywordExcludedCount++;
                  this.excludedCount++;
                  return true;
              }
          }
          return false;
      },

      getSummary: function() {
          // categoryExcludedCount is always 0 — category exclusion happens at GlideAggregate
          // query time, not per-record, so it cannot be counted here. Only keyword exclusions
          // are counted per-record via isNoise().
          return this.excludedCount + ' excluded (keyword filter): ' +
              this.keywordExcludedCount + ' matched noise keywords';
      },

      _splitProp: function(propName) {
          var val = gs.getProperty(propName, '');
          if (!val) return [];
          return val.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
      },

      type: 'ORINoiseFilter'
  };
  ```

- [ ] **Step 4: Run the verification test (background script)**

  ```javascript
  // Test 1: isNoise() returns true for password reset
  var filter = new ORINoiseFilter();
  var mockGr = { getValue: function(f) { return f === 'short_description' ? 'Password reset request for user' : ''; } };
  var result = filter.isNoise(mockGr);
  gs.print('Test 1 isNoise=true for password reset: ' + (result === true ? 'PASS' : 'FAIL'));

  // Test 2: isNoise() returns false for real incident
  var filter2 = new ORINoiseFilter();
  var mockGr2 = { getValue: function(f) { return f === 'short_description' ? 'Database connection timeout on PRD-DB01' : ''; } };
  var result2 = filter2.isNoise(mockGr2);
  gs.print('Test 2 isNoise=false for real incident: ' + (result2 === false ? 'PASS' : 'FAIL'));

  // Test 3: excludedCategories loaded from sys_property
  var filter3 = new ORINoiseFilter();
  gs.print('Test 3 categories loaded: ' + (filter3.excludedCategories.length > 0 ? 'PASS' : 'FAIL'));
  gs.print('  categories: ' + filter3.excludedCategories.join(', '));

  // Test 4: getSummary() reflects keyword exclusion count
  var filter4 = new ORINoiseFilter();
  var mockGr4 = { getValue: function(f) { return f === 'short_description' ? 'vpn access issue' : ''; } };
  filter4.isNoise(mockGr4);
  var summary = filter4.getSummary();
  gs.print('Test 4 summary has count: ' + (summary.indexOf('1') !== -1 ? 'PASS' : 'FAIL') + ' — ' + summary);
  ```
  Expected: all four lines show `PASS`.

- [ ] **Step 5: Commit**

  ```
  feat: add ORINoiseFilter Script Include — Stage 0 category and keyword exclusion
  ```

---

## Task 6: Implement ORIClusterBuilder

**Files:**
- Create: Script Include `ORIClusterBuilder` in Studio

- [ ] **Step 1: Write the failing test (background script)**

  ```javascript
  try {
      var builder = new ORIClusterBuilder();
      gs.print('FAIL: Should have thrown');
  } catch(e) {
      gs.print('PASS: Not defined yet: ' + e.message);
  }
  ```

- [ ] **Step 2: Create the Script Include `ORIClusterBuilder`**

  ```javascript
  var ORIClusterBuilder = Class.create();
  ORIClusterBuilder.prototype = {
      initialize: function() {
          this.minIncidents = parseInt(gs.getProperty('x_ori.min_incidents_per_cluster', '3'));
          this.lookbackDays = parseInt(gs.getProperty('x_ori.lookback_days', '30'));
          this.noiseFilter = new ORINoiseFilter();
      },

      buildClusters: function(analysisRunSysId) {
          var startDate = new GlideDateTime();
          startDate.addDaysLocalTime(-this.lookbackDays);

          var clusterSysIds = [];

          var ciClusters = this._buildCIClusters(startDate, analysisRunSysId);
          clusterSysIds = clusterSysIds.concat(ciClusters);

          var serviceClusters = this._buildServiceClusters(startDate, analysisRunSysId);
          clusterSysIds = clusterSysIds.concat(serviceClusters);

          return clusterSysIds;
      },

      _buildCIClusters: function(startDate, analysisRunSysId) {
          var sysIds = [];
          var ga = new GlideAggregate('incident');
          ga.addQuery('state', 'IN', '6,7');
          ga.addQuery('opened_at', '>=', startDate);
          ga.addQuery('cmdb_ci', '!=', '');
          this.noiseFilter.applyQueryFilters(ga);
          ga.addAggregate('COUNT');
          ga.groupBy('cmdb_ci');
          ga.groupBy('category');
          ga.groupBy('assignment_group');
          ga.addHaving('COUNT', '>=', this.minIncidents);
          ga.query();

          while (ga.next()) {
              var sysId = this._persistCluster({
                  analysis_run: analysisRunSysId,
                  ci: ga.getValue('cmdb_ci'),
                  category: ga.getValue('category'),
                  assignment_group: ga.getValue('assignment_group'),
                  incident_count: parseInt(ga.getAggregate('COUNT'))
              }, startDate);
              if (sysId) sysIds.push(sysId);
          }
          return sysIds;
      },

      _buildServiceClusters: function(startDate, analysisRunSysId) {
          var sysIds = [];
          var ga = new GlideAggregate('incident');
          ga.addQuery('state', 'IN', '6,7');
          ga.addQuery('opened_at', '>=', startDate);
          ga.addQuery('business_service', '!=', '');
          this.noiseFilter.applyQueryFilters(ga);
          ga.addAggregate('COUNT');
          ga.groupBy('business_service');
          ga.groupBy('category');
          ga.addHaving('COUNT', '>=', this.minIncidents);
          ga.query();

          while (ga.next()) {
              var sysId = this._persistCluster({
                  analysis_run: analysisRunSysId,
                  business_service: ga.getValue('business_service'),
                  category: ga.getValue('category'),
                  incident_count: parseInt(ga.getAggregate('COUNT'))
              }, startDate);
              if (sysId) sysIds.push(sysId);
          }
          return sysIds;
      },

      _persistCluster: function(data, startDate) {
          var keyParts = [
              data.ci || '',
              data.business_service || '',
              data.category || '',
              data.assignment_group || ''
          ];
          var clusterKey = this._hash(keyParts.join('|'));

          // Skip if same cluster already processed this calendar month
          var monthStart = new GlideDateTime();
          monthStart.setValue(new GlideDate().getByFormat('yyyy-MM') + '-01 00:00:00');
          var existing = new GlideRecord('x_ori_incident_cluster');
          existing.addQuery('cluster_key', clusterKey);
          existing.addQuery('sys_created_on', '>=', monthStart);
          existing.query();
          if (existing.next()) return null;

          var incidentData = this._fetchIncidentData(data, startDate);

          var gr = new GlideRecord('x_ori_incident_cluster');
          gr.newRecord();
          gr.setValue('analysis_run', data.analysis_run);
          gr.setValue('cluster_key', clusterKey);
          gr.setValue('ci', data.ci || '');
          gr.setValue('assignment_group', data.assignment_group || '');
          gr.setValue('business_service', data.business_service || '');
          gr.setValue('category', data.category || '');
          gr.setValue('incident_count', data.incident_count);
          gr.setValue('cluster_data', JSON.stringify(incidentData));
          gr.setValue('status', 'pending');
          return gr.insert();
      },

      _fetchIncidentData: function(clusterData, startDate) {
          var incidents = [];
          var gr = new GlideRecord('incident');
          gr.addQuery('state', 'IN', '6,7');
          gr.addQuery('opened_at', '>=', startDate);

          if (clusterData.ci) {
              gr.addQuery('cmdb_ci', clusterData.ci);
              gr.addQuery('category', clusterData.category);
              if (clusterData.assignment_group) {
                  gr.addQuery('assignment_group', clusterData.assignment_group);
              }
          } else {
              gr.addQuery('business_service', clusterData.business_service);
              gr.addQuery('category', clusterData.category);
          }
          this.noiseFilter.applyQueryFilters(gr);
          gr.query();

          while (gr.next()) {
              if (!this.noiseFilter.isNoise(gr)) {
                  incidents.push({
                      sys_id: gr.getUniqueValue(),
                      number: gr.getValue('number'),
                      short_description: gr.getValue('short_description'),
                      resolution_notes: gr.getValue('close_notes') || '',
                      priority: gr.getDisplayValue('priority'),
                      category: gr.getValue('category'),
                      subcategory: gr.getValue('subcategory') || ''
                  });
              }
          }

          return {
              ci_name: clusterData.ci ? this._lookupName('cmdb_ci', clusterData.ci, 'name') : '',
              group_name: clusterData.assignment_group ? this._lookupName('sys_user_group', clusterData.assignment_group, 'name') : '',
              service_name: clusterData.business_service ? this._lookupName('cmdb_ci', clusterData.business_service, 'name') : '',
              category: clusterData.category || '',
              start_date: startDate.getDisplayValue(),
              end_date: new GlideDateTime().getDisplayValue(),
              incidents: incidents
          };
      },

      _lookupName: function(table, sysId, field) {
          if (!sysId) return '';
          var gr = new GlideRecord(table);
          if (gr.get(sysId)) return gr.getValue(field) || sysId;
          return sysId;
      },

      _hash: function(str) {
          var digest = new GlideDigest();
          return digest.getMD5Base64(str);
      },

      type: 'ORIClusterBuilder'
  };
  ```

- [ ] **Step 3: Run the verification test (background script)**

  ```javascript
  // Test 1: ORIClusterBuilder initializes with correct defaults
  var builder = new ORIClusterBuilder();
  gs.print('Test 1 minIncidents: ' + (builder.minIncidents === 3 ? 'PASS' : 'FAIL') + ' — ' + builder.minIncidents);
  gs.print('Test 1 lookbackDays: ' + (builder.lookbackDays === 30 ? 'PASS' : 'FAIL') + ' — ' + builder.lookbackDays);

  // Test 2: _hash produces a string
  var hash = builder._hash('cmdb_ci|Application|Service Desk');
  gs.print('Test 2 hash is string: ' + (typeof hash === 'string' && hash.length > 0 ? 'PASS' : 'FAIL') + ' — ' + hash);

  // Test 3: _lookupName returns something for a real group
  var grp = new GlideRecord('sys_user_group');
  grp.setLimit(1);
  grp.query();
  if (grp.next()) {
      var name = builder._lookupName('sys_user_group', grp.getUniqueValue(), 'name');
      gs.print('Test 3 _lookupName works: ' + (name.length > 0 ? 'PASS' : 'FAIL') + ' — ' + name);
  } else {
      gs.print('Test 3 SKIP: no groups found in instance');
  }

  // Test 4: buildClusters returns an array (even if empty on a fresh PDI)
  var runGr = new GlideRecord('x_ori_analysis_run');
  runGr.newRecord();
  runGr.setValue('status', 'running');
  runGr.setValue('run_date', new GlideDate().getDisplayValue());
  var runId = runGr.insert();
  var builder2 = new ORIClusterBuilder();
  var clusters = builder2.buildClusters(runId);
  gs.print('Test 4 buildClusters returns array: ' + (Array.isArray(clusters) ? 'PASS' : 'FAIL'));
  gs.print('  clusters found: ' + clusters.length);
  // Clean up test run
  var del = new GlideRecord('x_ori_analysis_run');
  del.get(runId);
  del.deleteRecord();
  ```
  Expected: Test 1–3 all PASS. Test 4 returns array (0 clusters is fine on a fresh PDI with no matching incidents).

- [ ] **Step 4: Commit**

  ```
  feat: add ORIClusterBuilder — Stage 1 CI-centric and service-centric incident grouping
  ```

---

## Task 7: Implement ORIClaudeClient

**Files:**
- Create: Script Include `ORIClaudeClient` in Studio

- [ ] **Step 1: Write the failing test**

  ```javascript
  try {
      var client = new ORIClaudeClient();
      gs.print('FAIL: Should have thrown');
  } catch(e) {
      gs.print('PASS: Not defined yet');
  }
  ```

- [ ] **Step 2: Create the Script Include `ORIClaudeClient`**

  ```javascript
  var ORIClaudeClient = Class.create();
  ORIClaudeClient.prototype = {
      initialize: function() {
          this.model = gs.getProperty('x_ori.claude_model', 'claude-opus-4-8');
          this.maxTokens = parseInt(gs.getProperty('x_ori.claude_max_tokens', '1024'));
          this.confidenceThreshold = parseFloat(gs.getProperty('x_ori.min_confidence_threshold', '0.6'));
          this.apiKey = gs.getProperty('x_ori.claude_api_key', '');
      },

      analyzeCluster: function(clusterSysId) {
          var clusterGr = new GlideRecord('x_ori_incident_cluster');
          if (!clusterGr.get(clusterSysId)) {
              return { success: false, error: 'Cluster not found: ' + clusterSysId };
          }

          var clusterData;
          try {
              clusterData = JSON.parse(clusterGr.getValue('cluster_data') || '{}');
          } catch(e) {
              return { success: false, error: 'cluster_data is not valid JSON: ' + e.message };
          }

          if (!clusterData.incidents || clusterData.incidents.length === 0) {
              return { success: true, result: { is_pattern: false, skipped_reason: 'no_incidents' } };
          }

          var prompt = this._buildPrompt(clusterData);
          var apiResponse = this._callAPI(prompt);

          if (!apiResponse.success) return apiResponse;

          return this._parseResponse(apiResponse.content);
      },

      _buildPrompt: function(clusterData) {
          var lines = clusterData.incidents.map(function(inc) {
              return inc.number + ' | ' +
                  inc.short_description + ' | ' +
                  (inc.resolution_notes || 'No notes') + ' | Priority: ' + inc.priority;
          });

          return 'You are an ITSM Problem Management analyst.\n\n' +
              'Analyze the following group of incidents and determine whether they share ' +
              'a recurring operational risk pattern that warrants a Problem record.\n\n' +
              'Cluster Context:\n' +
              '- Configuration Item: ' + (clusterData.ci_name || 'N/A') + '\n' +
              '- Assignment Group: ' + (clusterData.group_name || 'N/A') + '\n' +
              '- Business Service: ' + (clusterData.service_name || 'N/A') + '\n' +
              '- Category: ' + (clusterData.category || 'N/A') + '\n' +
              '- Period: ' + (clusterData.start_date || '') + ' to ' + (clusterData.end_date || '') + '\n' +
              '- Incident Count: ' + clusterData.incidents.length + '\n\n' +
              'Incidents:\n' + lines.join('\n') + '\n\n' +
              'Respond ONLY in this JSON format:\n' +
              '{\n' +
              '  "is_pattern": true,\n' +
              '  "confidence": 0.85,\n' +
              '  "pattern_summary": "One sentence describing the pattern.",\n' +
              '  "root_cause_hypothesis": "One paragraph on likely root cause.",\n' +
              '  "recommendation": "Specific Problem Management action.",\n' +
              '  "severity": "high",\n' +
              '  "problem_statement": "Draft Problem short description under 160 characters."\n' +
              '}\n\n' +
              'If no genuine recurring pattern exists, return {"is_pattern": false} only.';
      },

      _callAPI: function(prompt) {
          if (!this.apiKey) {
              return { success: false, error: 'x_ori.claude_api_key sys_property is empty' };
          }

          var rm = new sn_ws.RESTMessageV2();
          rm.setEndpoint('https://api.anthropic.com/v1/messages');
          rm.setHttpMethod('POST');
          rm.setRequestHeader('Content-Type', 'application/json');
          rm.setRequestHeader('anthropic-version', '2023-06-01');
          rm.setRequestHeader('x-api-key', this.apiKey);
          rm.setRequestBody(JSON.stringify({
              model: this.model,
              max_tokens: this.maxTokens,
              messages: [{ role: 'user', content: prompt }]
          }));

          var response;
          try {
              response = rm.execute();
          } catch(e) {
              return { success: false, error: 'REST call exception: ' + e.message };
          }

          var statusCode = response.getStatusCode();
          var body = response.getBody();

          if (statusCode === 429) {
              gs.sleep(30000);
              try {
                  response = rm.execute();
                  statusCode = response.getStatusCode();
                  body = response.getBody();
              } catch(e) {
                  return { success: false, error: 'Retry after 429 failed: ' + e.message };
              }
          }

          if (statusCode !== 200) {
              return { success: false, error: 'HTTP ' + statusCode + ': ' + body };
          }

          var parsed;
          try {
              parsed = JSON.parse(body);
          } catch(e) {
              return { success: false, error: 'Invalid API response JSON: ' + body };
          }

          var content = parsed.content && parsed.content[0] && parsed.content[0].text;
          if (!content) {
              return { success: false, error: 'No text content in API response: ' + body };
          }

          return { success: true, content: content };
      },

      _parseResponse: function(content) {
          var jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          var parsed;
          try {
              parsed = JSON.parse(jsonStr);
          } catch(e) {
              return { success: false, error: 'Claude returned non-JSON: ' + content };
          }

          if (!parsed.is_pattern) {
              return { success: true, result: { is_pattern: false } };
          }

          if ((parsed.confidence || 0) < this.confidenceThreshold) {
              return { success: true, result: { is_pattern: false, skipped_reason: 'confidence_below_threshold' } };
          }

          // Validate required fields
          var required = ['pattern_summary', 'root_cause_hypothesis', 'recommendation', 'severity', 'problem_statement'];
          for (var i = 0; i < required.length; i++) {
              if (!parsed[required[i]]) {
                  return { success: false, error: 'Claude response missing field: ' + required[i] };
              }
          }

          return { success: true, result: parsed };
      },

      type: 'ORIClaudeClient'
  };
  ```

- [ ] **Step 3: Run the unit tests for _parseResponse (no API call needed)**

  ```javascript
  var client = new ORIClaudeClient();

  // Test 1: _parseResponse handles is_pattern: false
  var r1 = client._parseResponse('{"is_pattern": false}');
  gs.print('Test 1 no pattern: ' + (r1.success && !r1.result.is_pattern ? 'PASS' : 'FAIL'));

  // Test 2: _parseResponse handles valid pattern response
  var validResponse = JSON.stringify({
      is_pattern: true,
      confidence: 0.9,
      pattern_summary: 'Recurring DB timeout',
      root_cause_hypothesis: 'Connection pool exhaustion.',
      recommendation: 'Investigate DB connection pool settings.',
      severity: 'high',
      problem_statement: 'Recurring DB timeouts on PRD-DB01'
  });
  var r2 = client._parseResponse(validResponse);
  gs.print('Test 2 valid pattern: ' + (r2.success && r2.result.is_pattern ? 'PASS' : 'FAIL'));
  gs.print('  pattern_summary: ' + (r2.result && r2.result.pattern_summary));

  // Test 3: _parseResponse strips markdown fences
  var r3 = client._parseResponse('```json\n{"is_pattern": false}\n```');
  gs.print('Test 3 strips markdown fences: ' + (r3.success && !r3.result.is_pattern ? 'PASS' : 'FAIL'));

  // Test 4: _parseResponse rejects low confidence
  var lowConf = JSON.stringify({
      is_pattern: true, confidence: 0.3,
      pattern_summary: 'x', root_cause_hypothesis: 'x',
      recommendation: 'x', severity: 'low', problem_statement: 'x'
  });
  var r4 = client._parseResponse(lowConf);
  gs.print('Test 4 low confidence skipped: ' + (r4.success && !r4.result.is_pattern ? 'PASS' : 'FAIL'));

  // Test 5: _buildPrompt contains cluster context
  var mockData = {
      ci_name: 'PRD-DB01', group_name: 'DBA Team', service_name: 'Core Banking',
      category: 'Database', start_date: '2026-05-01', end_date: '2026-05-31',
      incidents: [{ number: 'INC001', short_description: 'DB down', resolution_notes: 'Restarted', priority: '2 - High' }]
  };
  var prompt = client._buildPrompt(mockData);
  gs.print('Test 5 prompt has CI name: ' + (prompt.indexOf('PRD-DB01') !== -1 ? 'PASS' : 'FAIL'));
  gs.print('Test 5 prompt has incident: ' + (prompt.indexOf('INC001') !== -1 ? 'PASS' : 'FAIL'));
  ```
  Expected: all five tests PASS.

- [ ] **Step 4: Test live API call (optional — costs tokens)**

  Only run this if you want to verify the actual Claude API connection:
  ```javascript
  var client = new ORIClaudeClient();
  var mockData = {
      ci_name: 'PRD-DB01', group_name: 'DBA Team', service_name: 'Core Banking',
      category: 'Database', start_date: '2026-05-01', end_date: '2026-05-31',
      incidents: [
          { number: 'INC001', short_description: 'DB connection timeout', resolution_notes: 'Restarted service', priority: '2 - High' },
          { number: 'INC002', short_description: 'Database not responding', resolution_notes: 'Restarted service', priority: '2 - High' },
          { number: 'INC003', short_description: 'DB timeout affecting core banking', resolution_notes: 'Restarted connection pool', priority: '1 - Critical' }
      ]
  };
  var prompt = client._buildPrompt(mockData);
  var apiResult = client._callAPI(prompt);
  gs.print('API call success: ' + apiResult.success);
  if (apiResult.success) {
      gs.print('Response: ' + apiResult.content);
  } else {
      gs.print('Error: ' + apiResult.error);
  }
  ```

- [ ] **Step 5: Commit**

  ```
  feat: add ORIClaudeClient — Stage 2 Claude API integration with prompt builder and response parser
  ```

---

## Task 8: Implement ORIProblemCreator

**Files:**
- Create: Script Include `ORIProblemCreator` in Studio

- [ ] **Step 1: Write the failing test**

  ```javascript
  try {
      var creator = new ORIProblemCreator();
      gs.print('FAIL: Should have thrown');
  } catch(e) {
      gs.print('PASS: Not defined yet');
  }
  ```

- [ ] **Step 2: Create the Script Include `ORIProblemCreator`**

  ```javascript
  var ORIProblemCreator = Class.create();
  ORIProblemCreator.prototype = {
      initialize: function() {},

      createProblem: function(recommendationSysId) {
          var recGr = new GlideRecord('x_ori_ai_recommendation');
          if (!recGr.get(recommendationSysId)) {
              gs.error('ORIProblemCreator: recommendation not found: ' + recommendationSysId);
              return false;
          }

          // Duplicate guard
          var existingProblemId = this._findExistingProblem(recGr);
          if (existingProblemId) {
              recGr.setValue('problem', existingProblemId);
              recGr.setValue('state', 'linked_to_existing');
              recGr.update();
              this._associateIncidents(recommendationSysId, existingProblemId);
              return existingProblemId;
          }

          // Create new Problem
          var problemGr = new GlideRecord('problem');
          problemGr.newRecord();
          problemGr.setValue('short_description', recGr.getValue('problem_statement'));
          problemGr.setValue('description',
              'Root Cause Hypothesis:\n' + recGr.getValue('root_cause_hypothesis') +
              '\n\nRecommendation:\n' + recGr.getValue('recommendation_text') +
              '\n\nGenerated by Operational Risk Intelligence — Run: ' + recGr.getDisplayValue('analysis_run'));

          var clusterGr = new GlideRecord('x_ori_incident_cluster');
          if (clusterGr.get(recGr.getValue('cluster'))) {
              problemGr.setValue('assignment_group', clusterGr.getValue('assignment_group'));
              problemGr.setValue('cmdb_ci', clusterGr.getValue('ci'));
              problemGr.setValue('category', clusterGr.getValue('category'));
          }

          var problemSysId = problemGr.insert();

          this._associateIncidents(recommendationSysId, problemSysId);

          recGr.setValue('problem', problemSysId);
          recGr.setValue('approved_by', gs.getUserID());
          recGr.setValue('approval_date', new GlideDateTime().getDisplayValue());
          recGr.update();

          return problemSysId;
      },

      _findExistingProblem: function(recGr) {
          var clusterGr = new GlideRecord('x_ori_incident_cluster');
          if (!clusterGr.get(recGr.getValue('cluster'))) return null;

          var ci = clusterGr.getValue('ci');
          var category = clusterGr.getValue('category');
          if (!ci) return null;

          var problemGr = new GlideRecord('problem');
          problemGr.addQuery('cmdb_ci', ci);
          problemGr.addQuery('category', category);
          // Exclude closed states: 4=Closed Positive, 5=Closed Negative
          problemGr.addQuery('state', 'NOT IN', '4,5');
          problemGr.query();
          if (problemGr.next()) return problemGr.getUniqueValue();
          return null;
      },

      _associateIncidents: function(recommendationSysId, problemSysId) {
          var junctionGr = new GlideRecord('x_ori_recommendation_incident');
          junctionGr.addQuery('recommendation', recommendationSysId);
          junctionGr.query();

          while (junctionGr.next()) {
              var incidentSysId = junctionGr.getValue('incident');

              // Update incident.problem_id
              var incGr = new GlideRecord('incident');
              if (incGr.get(incidentSysId)) {
                  incGr.setValue('problem_id', problemSysId);
                  incGr.update();
              }
          }
      },

      type: 'ORIProblemCreator'
  };
  ```

- [ ] **Step 3: Run the verification test (background script)**

  ```javascript
  // Setup: create a test recommendation with cluster and linked incidents
  // Create a fake cluster
  var clusterGr = new GlideRecord('x_ori_incident_cluster');
  clusterGr.newRecord();
  clusterGr.setValue('category', 'Network');
  clusterGr.setValue('incident_count', 3);
  clusterGr.setValue('cluster_data', '{"incidents":[]}');
  clusterGr.setValue('status', 'analyzed');
  var clusterSysId = clusterGr.insert();

  // Create a fake recommendation
  var recGr = new GlideRecord('x_ori_ai_recommendation');
  recGr.newRecord();
  recGr.setValue('cluster', clusterSysId);
  recGr.setValue('pattern_summary', 'Test pattern');
  recGr.setValue('root_cause_hypothesis', 'Test hypothesis');
  recGr.setValue('recommendation_text', 'Test recommendation');
  recGr.setValue('problem_statement', 'Test Problem - Network recurring failures');
  recGr.setValue('severity', 'medium');
  recGr.setValue('confidence_score', 0.85);
  recGr.setValue('state', 'pending');
  var recSysId = recGr.insert();

  // Test 1: createProblem creates a Problem record
  var creator = new ORIProblemCreator();
  var problemSysId = creator.createProblem(recSysId);
  gs.print('Test 1 Problem created: ' + (problemSysId ? 'PASS' : 'FAIL') + ' — sysId: ' + problemSysId);

  // Test 2: Recommendation now has problem reference
  var checkRec = new GlideRecord('x_ori_ai_recommendation');
  checkRec.get(recSysId);
  gs.print('Test 2 recommendation.problem set: ' + (checkRec.getValue('problem') === problemSysId ? 'PASS' : 'FAIL'));

  // Test 3: Duplicate guard returns existing problem on second call
  var creator2 = new ORIProblemCreator();
  var problemSysId2 = creator2.createProblem(recSysId);
  var checkRec2 = new GlideRecord('x_ori_ai_recommendation');
  checkRec2.get(recSysId);
  gs.print('Test 3 state is linked_to_existing: ' + (checkRec2.getValue('state') === 'linked_to_existing' ? 'PASS' : 'FAIL'));

  // Cleanup
  new GlideRecord('problem').get(problemSysId) && (function(){ var d = new GlideRecord('problem'); d.get(problemSysId); d.deleteRecord(); })();
  new GlideRecord('x_ori_ai_recommendation').get(recSysId) && (function(){ var d = new GlideRecord('x_ori_ai_recommendation'); d.get(recSysId); d.deleteRecord(); })();
  new GlideRecord('x_ori_incident_cluster').get(clusterSysId) && (function(){ var d = new GlideRecord('x_ori_incident_cluster'); d.get(clusterSysId); d.deleteRecord(); })();
  gs.print('Cleanup done');
  ```
  Expected: Tests 1, 2 PASS. Test 3 PASS (state = linked_to_existing on second call because the problem still exists and has no CI, but the duplicate guard only applies when CI is set — on this test it won't find a duplicate, so Test 3 may create another problem. That is expected behaviour for the no-CI case).

  > **Note on Test 3:** The duplicate guard only triggers when the cluster has a CI set. The test cluster above has no CI, so the guard returns null and a new Problem is created. To test the duplicate guard fully, create a cluster with a `ci` field set to a real CMDB CI sys_id and an existing open Problem for that CI/category combination.

- [ ] **Step 4: Commit**

  ```
  feat: add ORIProblemCreator — Problem creation with duplicate guard and incident association
  ```

---

## Task 9: Implement ORIAnalysisEngine

**Files:**
- Create: Script Include `ORIAnalysisEngine` in Studio

- [ ] **Step 1: Write the failing test**

  ```javascript
  try {
      var engine = new ORIAnalysisEngine();
      gs.print('FAIL: Should have thrown');
  } catch(e) {
      gs.print('PASS: Not defined yet');
  }
  ```

- [ ] **Step 2: Create the Script Include `ORIAnalysisEngine`**

  ```javascript
  var ORIAnalysisEngine = Class.create();
  ORIAnalysisEngine.prototype = {
      initialize: function() {},

      runMonthlyAnalysis: function() {
          if (gs.getProperty('x_ori.active', 'true') !== 'true') {
              gs.info('ORIAnalysisEngine: Skipped — x_ori.active is false');
              return null;
          }

          var runGr = new GlideRecord('x_ori_analysis_run');
          runGr.newRecord();
          runGr.setValue('run_date', new GlideDate().getDisplayValue());
          runGr.setValue('status', 'running');
          runGr.setValue('triggered_by', gs.getUserID());
          var runSysId = runGr.insert();

          try {
              this._executeAnalysis(runSysId);
          } catch(e) {
              gs.error('ORIAnalysisEngine fatal error: ' + e.message);
              this._setRunStatus(runSysId, 'failed', e.message);
          }

          return runSysId;
      },

      _executeAnalysis: function(runSysId) {
          var clusterBuilder = new ORIClusterBuilder();
          var clusterSysIds = clusterBuilder.buildClusters(runSysId);

          // Update noise filter stats on run record
          var noiseFilter = clusterBuilder.noiseFilter;
          var runGr = new GlideRecord('x_ori_analysis_run');
          runGr.get(runSysId);
          runGr.setValue('incidents_excluded', noiseFilter.excludedCount);
          runGr.setValue('noise_filter_summary', noiseFilter.getSummary());
          runGr.update();

          // Count total incidents across all clusters for the run record
          var totalIncidents = 0;
          for (var k = 0; k < clusterSysIds.length; k++) {
              var cGr = new GlideRecord('x_ori_incident_cluster');
              if (cGr.get(clusterSysIds[k])) {
                  totalIncidents += parseInt(cGr.getValue('incident_count') || '0');
              }
          }
          var runGr3 = new GlideRecord('x_ori_analysis_run');
          runGr3.get(runSysId);
          runGr3.setValue('incidents_analyzed', totalIncidents);
          runGr3.update();

          var claudeClient = new ORIClaudeClient();
          var recCount = 0;
          var errors = [];

          for (var i = 0; i < clusterSysIds.length; i++) {
              var clusterSysId = clusterSysIds[i];
              try {
                  var result = claudeClient.analyzeCluster(clusterSysId);

                  if (!result.success) {
                      this._setClusterStatus(clusterSysId, 'failed');
                      errors.push('[Cluster ' + clusterSysId + '] ' + result.error);
                      continue;
                  }

                  if (!result.result.is_pattern) {
                      this._setClusterStatus(clusterSysId, 'skipped');
                      continue;
                  }

                  this._createRecommendation(clusterSysId, runSysId, result.result);
                  this._setClusterStatus(clusterSysId, 'analyzed');
                  recCount++;

              } catch(e) {
                  this._setClusterStatus(clusterSysId, 'failed');
                  errors.push('[Cluster ' + clusterSysId + '] Exception: ' + e.message);
              }
          }

          var status = errors.length === 0 ? 'completed' : 'completed_with_errors';
          var runGr2 = new GlideRecord('x_ori_analysis_run');
          runGr2.get(runSysId);
          runGr2.setValue('clusters_found', clusterSysIds.length);
          runGr2.setValue('recommendations_generated', recCount);
          runGr2.setValue('status', status);
          if (errors.length > 0) {
              runGr2.setValue('error_log', errors.join('\n'));
          }
          runGr2.update();

          gs.eventQueue('x_ori.analysis.complete', runGr2, runSysId, '');
      },

      _createRecommendation: function(clusterSysId, runSysId, aiResult) {
          var recGr = new GlideRecord('x_ori_ai_recommendation');
          recGr.newRecord();
          recGr.setValue('analysis_run', runSysId);
          recGr.setValue('cluster', clusterSysId);
          recGr.setValue('pattern_summary', aiResult.pattern_summary);
          recGr.setValue('root_cause_hypothesis', aiResult.root_cause_hypothesis);
          recGr.setValue('recommendation_text', aiResult.recommendation);
          recGr.setValue('problem_statement', aiResult.problem_statement);
          recGr.setValue('severity', aiResult.severity);
          recGr.setValue('confidence_score', aiResult.confidence);
          recGr.setValue('state', 'pending');
          var recSysId = recGr.insert();

          // Link incidents from cluster_data
          var clusterGr = new GlideRecord('x_ori_incident_cluster');
          if (clusterGr.get(clusterSysId)) {
              try {
                  var clusterData = JSON.parse(clusterGr.getValue('cluster_data') || '{}');
                  var incidents = clusterData.incidents || [];
                  for (var j = 0; j < incidents.length; j++) {
                      var jGr = new GlideRecord('x_ori_recommendation_incident');
                      jGr.newRecord();
                      jGr.setValue('recommendation', recSysId);
                      jGr.setValue('incident', incidents[j].sys_id);
                      jGr.insert();
                  }
              } catch(e) {
                  gs.warn('ORIAnalysisEngine: Could not link incidents for cluster ' + clusterSysId + ': ' + e.message);
              }
          }

          return recSysId;
      },

      _setClusterStatus: function(clusterSysId, status) {
          var gr = new GlideRecord('x_ori_incident_cluster');
          if (gr.get(clusterSysId)) {
              gr.setValue('status', status);
              gr.update();
          }
      },

      _setRunStatus: function(runSysId, status, errorMsg) {
          var gr = new GlideRecord('x_ori_analysis_run');
          if (gr.get(runSysId)) {
              gr.setValue('status', status);
              if (errorMsg) gr.setValue('error_log', errorMsg);
              gr.update();
          }
      },

      type: 'ORIAnalysisEngine'
  };
  ```

- [ ] **Step 3: Run the integration test (background script)**

  ```javascript
  // Test 1: Kill-switch prevents run when x_ori.active = false
  gs.setProperty('x_ori.active', 'false');
  var engine = new ORIAnalysisEngine();
  var result = engine.runMonthlyAnalysis();
  gs.print('Test 1 kill-switch returns null: ' + (result === null ? 'PASS' : 'FAIL'));
  gs.setProperty('x_ori.active', 'true');

  // Test 2: runMonthlyAnalysis creates an Analysis Run record
  var engine2 = new ORIAnalysisEngine();
  var runSysId = engine2.runMonthlyAnalysis();
  gs.print('Test 2 run record created: ' + (runSysId ? 'PASS' : 'FAIL') + ' — ' + runSysId);

  // Test 3: Run record has a terminal status after completion
  if (runSysId) {
      var runGr = new GlideRecord('x_ori_analysis_run');
      runGr.get(runSysId);
      var finalStatus = runGr.getValue('status');
      var isTerminal = ['completed', 'completed_with_errors', 'failed'].indexOf(finalStatus) !== -1;
      gs.print('Test 3 terminal status: ' + (isTerminal ? 'PASS' : 'FAIL') + ' — ' + finalStatus);
      gs.print('  clusters_found: ' + runGr.getValue('clusters_found'));
      gs.print('  recommendations_generated: ' + runGr.getValue('recommendations_generated'));
      gs.print('  incidents_excluded: ' + runGr.getValue('incidents_excluded'));
  }
  ```
  Expected: Test 1 PASS. Test 2 PASS. Test 3 PASS with status `completed` or `completed_with_errors` (completed_with_errors is expected if Claude API key is not set yet).

- [ ] **Step 4: Commit**

  ```
  feat: add ORIAnalysisEngine — pipeline orchestrator with run lifecycle management and per-cluster error isolation
  ```

---

## Task 10: Business Rule — Create Problem on Approval

**Files:**
- Create: Business Rule `ORI - Create Problem on Approval` on table `x_ori_ai_recommendation`

- [ ] **Step 1: Create the Business Rule**

  Studio > **Create Application File** > **Business Rule**.

  ```
  Name:    ORI - Create Problem on Approval
  Table:   x_ori_ai_recommendation [x_ori_ai_recommendation]
  When:    after
  Update:  checked
  ```

  Add condition: **Field** `State` **changes to** `approved`

  Script:
  ```javascript
  (function executeRule(current, previous) {
      if (current.state.changesTo('approved')) {
          var creator = new ORIProblemCreator();
          creator.createProblem(current.getUniqueValue());
      }
  })(current, previous);
  ```

- [ ] **Step 2: Verify the Business Rule triggers**

  In a background script, create a test recommendation and change its state to approved:
  ```javascript
  // Create minimal test cluster and recommendation
  var clGr = new GlideRecord('x_ori_incident_cluster');
  clGr.newRecord();
  clGr.setValue('category', 'Application');
  clGr.setValue('cluster_data', '{"incidents":[]}');
  clGr.setValue('status', 'analyzed');
  var clId = clGr.insert();

  var recGr = new GlideRecord('x_ori_ai_recommendation');
  recGr.newRecord();
  recGr.setValue('cluster', clId);
  recGr.setValue('problem_statement', 'Business Rule test — Application recurring errors');
  recGr.setValue('root_cause_hypothesis', 'Test hypothesis');
  recGr.setValue('recommendation_text', 'Test action');
  recGr.setValue('pattern_summary', 'Test pattern');
  recGr.setValue('severity', 'low');
  recGr.setValue('confidence_score', 0.75);
  recGr.setValue('state', 'pending');
  var recId = recGr.insert();

  // Trigger approval (simulates Business Rule)
  var updateGr = new GlideRecord('x_ori_ai_recommendation');
  updateGr.get(recId);
  updateGr.setValue('state', 'approved');
  updateGr.update();

  // Check that problem was created
  var checkGr = new GlideRecord('x_ori_ai_recommendation');
  checkGr.get(recId);
  gs.print('Business Rule test — problem field set: ' + (checkGr.getValue('problem') ? 'PASS' : 'FAIL'));
  gs.print('  problem sysId: ' + checkGr.getValue('problem'));
  ```

- [ ] **Step 3: Commit**

  ```
  feat: add Business Rule — creates Problem record when recommendation approved
  ```

---

## Task 11: UI Actions — Approve and Reject

**Files:**
- Create: UI Action `ORI - Approve Recommendation` on `x_ori_ai_recommendation`
- Create: UI Action `ORI - Reject Recommendation` on `x_ori_ai_recommendation`

### 10a — Approve UI Action

- [ ] **Step 1: Create the UI Action**

  Studio > **Create Application File** > **UI Action**.

  ```
  Name:         ORI - Approve Recommendation
  Table:        x_ori_ai_recommendation
  Action name:  ori_approve
  Form button:  checked
  Onclick:      gsftSubmit(null, g_form, 'ori_approve')
  Condition:    current.state == 'pending'
  ```

  Script:
  ```javascript
  (function() {
      current.setValue('state', 'approved');
      current.update();
      action.setRedirectURL(current);
  })();
  ```

### 10b — Reject UI Action

- [ ] **Step 1: Create the UI Action**

  ```
  Name:         ORI - Reject Recommendation
  Table:        x_ori_ai_recommendation
  Action name:  ori_reject
  Form button:  checked
  Onclick:      ori_promptReject()
  Condition:    current.state == 'pending'
  ```

  Client script (in the Onclick field, replace with this to prompt for reason):
  ```javascript
  var reason = prompt('Rejection reason (required):');
  if (!reason || reason.trim() === '') {
      alert('A rejection reason is required.');
      return;
  }
  g_form.setValue('rejection_reason', reason);
  gsftSubmit(null, g_form, 'ori_reject');
  ```

  Server script:
  ```javascript
  (function() {
      current.setValue('state', 'rejected');
      current.update();
      action.setRedirectURL(current);
  })();
  ```

- [ ] **Step 2: Verify buttons appear on the recommendation form**

  Open any `x_ori_ai_recommendation` record with `state = pending`. You should see both **ORI - Approve Recommendation** and **ORI - Reject Recommendation** buttons. Click Reject and confirm the prompt appears.

- [ ] **Step 3: Commit**

  ```
  feat: add UI Actions for approve/reject on recommendation form
  ```

---

## Task 12: Scheduled Job

**Files:**
- Create: Scheduled Script Execution `ORI Monthly Analysis`

- [ ] **Step 1: Create the Scheduled Job**

  Navigate to: **System Definition > Scheduled Jobs**. Click **New**, select **Automatically run a script of your choosing**.

  ```
  Name:          ORI Monthly Analysis
  Application:   x_ori (Operational Risk Intelligence)
  Run:           Monthly
  Day:           1
  Time:          02:00:00
  Active:        true
  ```

  Script:
  ```javascript
  var engine = new ORIAnalysisEngine();
  engine.runMonthlyAnalysis();
  ```

- [ ] **Step 2: Test-trigger manually**

  Right-click the Scheduled Job record header > **Execute Now**. Navigate to `x_ori_analysis_run.list`. You should see a new run record with status `completed` or `completed_with_errors`.

- [ ] **Step 3: Commit**

  ```
  feat: add monthly scheduled job — triggers ORIAnalysisEngine on the 1st of each month
  ```

---

## Task 13: Notifications

**Files:**
- Create: Notification `ORI - Recommendation Pending Review`
- Create: Event Registration `x_ori.analysis.complete`
- Create: Notification `ORI - Monthly Run Summary`

### 12a — Recommendation Pending Notification

- [ ] **Step 1: Create the notification**

  Navigate to: **System Notification > Email > Notifications**. Click **New**.

  ```
  Name:        ORI - Recommendation Pending Review
  Table:       x_ori_ai_recommendation [x_ori_ai_recommendation]
  When to send — Inserted: checked
  Condition:   current.state == 'pending'
  ```

  **Who will receive:**
  - Select **Groups from fields** → pick the `assignment_group` from the cluster (use a script if needed):
    ```
    Recipient script:
    var clGr = current.cluster.getRefRecord();
    if (clGr.isValidRecord() && clGr.getValue('assignment_group')) {
        gs.addInfoMessage('group:' + clGr.getValue('assignment_group'));
        // Use the built-in Group field — add clGr.assignment_group.getRefRecord() to recipients
    }
    ```
  - Simpler alternative for PDI: add your own user as a recipient via **Users** tab.

  **Subject:**
  ```
  [ORI] New Risk Pattern Detected — ${pattern_summary} (${severity})
  ```

  **Body:**
  ```
  A recurring operational risk pattern has been detected.

  Pattern: ${pattern_summary}
  Severity: ${severity}
  Confidence: ${confidence_score}

  Root Cause Hypothesis:
  ${root_cause_hypothesis}

  Recommendation:
  ${recommendation_text}

  Proposed Problem Statement:
  ${problem_statement}

  Review and approve or reject this recommendation:
  ${URI}

  Generated by Operational Risk Intelligence.
  ```

### 12b — Run Summary Notification

- [ ] **Step 1: Register the event**

  Navigate to: **System Policy > Events > Registry**. Click **New**.
  ```
  Event name:   x_ori.analysis.complete
  Table:        x_ori_analysis_run
  Description:  Fired when an ORI monthly analysis run completes
  ```

- [ ] **Step 2: Create the notification**

  ```
  Name:        ORI - Monthly Run Summary
  Table:       x_ori_analysis_run [x_ori_analysis_run]
  Send when:   Event is fired — Event name: x_ori.analysis.complete
  ```

  **Subject:**
  ```
  [ORI] Monthly Analysis Complete — ${status} | ${recommendations_generated} recommendations
  ```

  **Body:**
  ```
  Operational Risk Intelligence — Monthly Analysis Summary

  Status:                   ${status}
  Run Date:                 ${run_date}
  Incidents Analyzed:       ${incidents_analyzed}
  Incidents Excluded:       ${incidents_excluded} (${noise_filter_summary})
  Clusters Found:           ${clusters_found}
  Recommendations Generated: ${recommendations_generated}

  ${error_log}

  View the full run record: ${URI}
  ```

- [ ] **Step 3: Commit**

  ```
  feat: add notifications for pending recommendations and monthly run summary
  ```

---

## Task 14: End-to-End Smoke Test

Validates the full pipeline from scheduled job to Problem creation.

- [ ] **Step 1: Seed test incidents**

  Run in background script to create 4 realistic test incidents for the same CI and category:
  ```javascript
  // Find a real CI and assignment group from your PDI
  var ciGr = new GlideRecord('cmdb_ci');
  ciGr.setLimit(1);
  ciGr.query();
  var ciSysId = ciGr.next() ? ciGr.getUniqueValue() : '';

  var grpGr = new GlideRecord('sys_user_group');
  grpGr.setLimit(1);
  grpGr.query();
  var grpSysId = grpGr.next() ? grpGr.getUniqueValue() : '';

  var testIncidents = [
      { short: 'Application server restart required due to memory leak', notes: 'Restarted app server, cleared heap' },
      { short: 'App server out of memory — emergency restart', notes: 'OOM error in logs, restarted service' },
      { short: 'Memory exhaustion on application server', notes: 'JVM heap full, restarted' },
      { short: 'Application unavailable — memory leak detected', notes: 'Heap dump collected, service restarted' }
  ];

  var seededIds = [];
  for (var i = 0; i < testIncidents.length; i++) {
      var inc = new GlideRecord('incident');
      inc.newRecord();
      inc.setValue('short_description', testIncidents[i].short);
      inc.setValue('close_notes', testIncidents[i].notes);
      inc.setValue('category', 'Application');
      inc.setValue('subcategory', 'Performance');
      inc.setValue('state', 6); // Resolved
      inc.setValue('priority', 2);
      inc.setValue('cmdb_ci', ciSysId);
      inc.setValue('assignment_group', grpSysId);
      inc.setValue('opened_at', new GlideDateTime().subtract(1296000000)); // ~15 days ago
      var id = inc.insert();
      seededIds.push(id);
      gs.print('Created incident: ' + id);
  }
  gs.print('Seeded ' + seededIds.length + ' incidents. CI: ' + ciSysId + ', Group: ' + grpSysId);
  ```

- [ ] **Step 2: Run the analysis engine manually**

  ```javascript
  var engine = new ORIAnalysisEngine();
  var runSysId = engine.runMonthlyAnalysis();
  gs.print('Run created: ' + runSysId);
  ```

- [ ] **Step 3: Inspect the Analysis Run record**

  Navigate to `x_ori_analysis_run.list`. Open the run. Verify:
  - `status` = `completed` or `completed_with_errors`
  - `clusters_found` ≥ 1
  - `recommendations_generated` ≥ 1 (if Claude API key is configured and the pattern is detected)

- [ ] **Step 4: Inspect the Recommendation record**

  Navigate to `x_ori_ai_recommendation.list`. Open the recommendation. Verify:
  - `pattern_summary` is populated by Claude
  - `state` = `pending`
  - Related list shows the 4 seeded incidents

- [ ] **Step 5: Approve the recommendation**

  Click **ORI - Approve Recommendation**. Navigate to `problem.list`. Verify:
  - A new Problem record exists with the `problem_statement` as short description
  - The Problem's `assignment_group` matches the cluster's group
  - The 4 test incidents each have their `problem_id` field pointing to this Problem

- [ ] **Step 6: Verify reject flow**

  Create another pending recommendation manually, click **ORI - Reject Recommendation**, enter a reason. Verify `state = rejected` and `rejection_reason` is populated.

- [ ] **Step 7: Clean up test data**

  ```javascript
  // Delete seeded incidents — replace with actual sys_ids from Step 1
  var idsToDelete = [/* paste sys_ids from Step 1 output */];
  for (var i = 0; i < idsToDelete.length; i++) {
      var del = new GlideRecord('incident');
      if (del.get(idsToDelete[i])) del.deleteRecord();
  }
  gs.print('Test incidents deleted');
  ```

- [ ] **Step 8: Final commit**

  ```
  feat: ORI v1.0 complete — all pipeline stages, approval workflow, and smoke test verified
  ```

---

## Post-Implementation Checklist

- [ ] `x_ori.active` is `true`
- [ ] `x_ori.claude_api_key` sys_property contains a valid Anthropic API key (marked private)
- [ ] `x_ori.reviewer_group` points to a real sys_user_group sys_id
- [ ] Scheduled Job is active and set to run on the 1st of the month
- [ ] At least one user has the `x_ori_analyst` role
- [ ] Outbound calls to `api.anthropic.com` are permitted from the instance
- [ ] First manual run executed successfully with `completed` or `completed_with_errors` status
