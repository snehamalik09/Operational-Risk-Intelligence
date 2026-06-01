/**
 * ORI Application - End-to-End Smoke Test
 * ServiceNow Background Script
 *
 * This script performs a comprehensive smoke test of the Operational Risk Intelligence (ORI) application:
 * 1. Seeds test incidents with memory leak patterns
 * 2. Runs the monthly analysis engine
 * 3. Verifies analysis run results
 * 4. Provides manual verification steps
 * 5. Outputs cleanup instructions
 */

gs.print('===============================================');
gs.print('[ORI SMOKE TEST] Starting end-to-end test');
gs.print('===============================================');

// ============================================================================
// PART 1: SEED TEST INCIDENTS
// ============================================================================

gs.print('\n[SEED] Part 1: Seeding test incidents...');

var seededIncidentIds = [];
var ciSysId = '';
var grpSysId = '';

try {
    // Find a real CI from the instance
    var ciGr = new GlideRecord('cmdb_ci');
    ciGr.setLimit(1);
    ciGr.query();
    ciSysId = ciGr.next() ? ciGr.getUniqueValue() : '';

    if (!ciSysId) {
        gs.print('[SEED] WARNING: No CI found in instance. Proceeding with empty CI reference.');
    }

    // Find a real group
    var grpGr = new GlideRecord('sys_user_group');
    grpGr.setLimit(1);
    grpGr.query();
    grpSysId = grpGr.next() ? grpGr.getUniqueValue() : '';

    if (!grpSysId) {
        gs.print('[SEED] WARNING: No group found in instance. Proceeding with empty group reference.');
    }

    // Calculate opened_at timestamp (15 days ago)
    var openedAt = new GlideDateTime();
    openedAt.addDaysLocalTime(-15);

    // Memory leak pattern descriptions (vary the text)
    var memoryLeakDescriptions = [
        'Application server restart required due to memory leak',
        'App server out of memory',
        'Memory exhaustion on application server',
        'Application unavailable — memory leak detected'
    ];

    var closureNotes = [
        'Restarted application server. Memory usage returned to normal. Monitoring for recurrence.',
        'Applied patch to resolve memory leak in caching layer. Incident closed.',
        'Upgraded JVM memory settings. Issue resolved after maintenance window.',
        'Identified and fixed memory leak in third-party library. All systems nominal.'
    ];

    // Create 4 test incidents
    for (var i = 0; i < 4; i++) {
        var incidentGr = new GlideRecord('incident');
        incidentGr.initialize();
        incidentGr.short_description = memoryLeakDescriptions[i];
        incidentGr.description = 'Automated smoke test incident - ' + memoryLeakDescriptions[i];
        incidentGr.close_notes = closureNotes[i];
        incidentGr.category = 'Application';
        incidentGr.subcategory = 'Performance';
        incidentGr.state = 6;  // Resolved
        incidentGr.priority = 2;

        if (ciSysId) {
            incidentGr.cmdb_ci = ciSysId;
        }

        if (grpSysId) {
            incidentGr.assignment_group = grpSysId;
        }

        incidentGr.opened_at = openedAt;

        var sysId = incidentGr.insert();
        seededIncidentIds.push(sysId);
        gs.print('[SEED] Created incident: ' + sysId);
    }

    gs.print('[SEED] Created ' + seededIncidentIds.length + ' test incidents. CI: ' + (ciSysId || 'NONE') + ' Group: ' + (grpSysId || 'NONE'));

} catch (e) {
    gs.print('[SEED] ERROR: Exception during seeding - ' + e.message);
    gs.print('[SEED] Stack: ' + e.stack);
}

// ============================================================================
// PART 2: RUN THE ANALYSIS ENGINE
// ============================================================================

gs.print('\n[RUN] Part 2: Running analysis engine...');

var runSysId = '';
var analysisStatus = '';
var clustersFound = 0;
var recommendationsGenerated = 0;
var incidentsExcluded = 0;

try {
    var engine = new ORIAnalysisEngine();
    runSysId = engine.runMonthlyAnalysis();

    if (!runSysId) {
        gs.print('[RUN] ERROR: Analysis engine returned empty run ID');
    } else {
        gs.print('[RUN] Analysis run created: ' + runSysId);
    }

} catch (e) {
    gs.print('[RUN] ERROR: Exception during analysis engine execution - ' + e.message);
    gs.print('[RUN] Stack: ' + e.stack);
}

// ============================================================================
// PART 3: VERIFY ANALYSIS RUN RECORD
// ============================================================================

gs.print('\n[VERIFY] Part 3: Verifying analysis run record...');

var statusCheckPassed = false;
var clustersCheckPassed = false;

try {
    if (!runSysId) {
        gs.print('[VERIFY] ERROR: No run ID available. Skipping verification.');
    } else {
        var analysisRunGr = new GlideRecord('x_ori_analysis_run');
        if (analysisRunGr.get(runSysId)) {

            analysisStatus = analysisRunGr.status.toString();
            clustersFound = analysisRunGr.clusters_found.toString();
            recommendationsGenerated = analysisRunGr.recommendations_generated.toString();
            incidentsExcluded = analysisRunGr.incidents_excluded.toString();

            gs.print('[VERIFY] Analysis Run Details:');
            gs.print('  - Status: ' + analysisStatus);
            gs.print('  - Clusters Found: ' + clustersFound);
            gs.print('  - Recommendations Generated: ' + recommendationsGenerated);
            gs.print('  - Incidents Excluded: ' + incidentsExcluded);

            // Assert: status is one of completed/completed_with_errors/failed
            var validStatuses = ['completed', 'completed_with_errors', 'failed'];
            var statusValid = false;
            for (var j = 0; j < validStatuses.length; j++) {
                if (analysisStatus === validStatuses[j]) {
                    statusValid = true;
                    break;
                }
            }

            if (statusValid) {
                gs.print('[VERIFY] Status check: PASS');
                statusCheckPassed = true;
            } else {
                gs.print('[VERIFY] Status check: FAIL - Expected one of [completed, completed_with_errors, failed], got: ' + analysisStatus);
            }

            // Assert: clusters_found is a number (not null)
            if (clustersFound && !isNaN(parseInt(clustersFound, 10))) {
                gs.print('[VERIFY] Clusters found check: PASS');
                clustersCheckPassed = true;
            } else {
                gs.print('[VERIFY] Clusters found check: FAIL - Expected a number, got: ' + clustersFound);
            }

        } else {
            gs.print('[VERIFY] ERROR: Could not retrieve analysis run record: ' + runSysId);
        }
    }

} catch (e) {
    gs.print('[VERIFY] ERROR: Exception during verification - ' + e.message);
    gs.print('[VERIFY] Stack: ' + e.stack);
}

// ============================================================================
// PART 4: MANUAL VERIFICATION STEPS
// ============================================================================

gs.print('\n[NEXT STEPS - Manual Verification]');
gs.print('====================================');

if (runSysId) {
    gs.print('1. Navigate to x_ori_analysis_run.list and open run: ' + runSysId);
    gs.print('2. Verify status = completed or completed_with_errors');
    gs.print('3. Navigate to x_ori_ai_recommendation.list — open any pending recommendation');
    gs.print('4. Verify pattern_summary, root_cause_hypothesis, and confidence_score are populated');
    gs.print('5. Click "ORI - Approve Recommendation" button');
    gs.print('6. Navigate to problem.list — verify new Problem was created with matching short_description');
    gs.print('7. Navigate to incident.list — verify the seeded incidents have problem_id set');
} else {
    gs.print('Analysis run was not created. Cannot proceed with manual verification steps.');
}

// ============================================================================
// PART 5: CLEANUP SCRIPT INSTRUCTIONS
// ============================================================================

gs.print('\n[CLEANUP] Run this in Background Scripts after verification:');
gs.print('===========================================================');

if (seededIncidentIds.length > 0) {
    gs.print('var idsToDelete = [' + seededIncidentIds.join(', ') + '];');
} else {
    gs.print('var idsToDelete = [];');
}

gs.print('for (var i = 0; i < idsToDelete.length; i++) {');
gs.print('    var del = new GlideRecord("incident");');
gs.print('    if (del.get(idsToDelete[i])) del.deleteRecord();');
gs.print('}');
gs.print('gs.print("Cleanup complete");');

// ============================================================================
// SUMMARY AND COMPLETION
// ============================================================================

gs.print('\n===============================================');
gs.print('[ORI SMOKE TEST] Test execution complete');
gs.print('===============================================');
gs.print('Incidents seeded: ' + seededIncidentIds.length);
gs.print('Analysis run: ' + (runSysId || 'NONE'));
gs.print('Status check: ' + (statusCheckPassed ? 'PASS' : 'FAIL'));
gs.print('Clusters check: ' + (clustersCheckPassed ? 'PASS' : 'FAIL'));
gs.print('===============================================');

// Done
gs.print('\nDONE');
