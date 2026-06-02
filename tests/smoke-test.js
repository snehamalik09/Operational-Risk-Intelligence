// ORI End-to-End Smoke Test
// Run in System > Background Scripts
// Seeds 4 incidents with operational risk language, runs the full pipeline, prints results

// ─── PART 1: Seed test incidents ─────────────────────────────────────────────

var seededIds = [];

try {
    var ciGr = new GlideRecord('cmdb_ci');
    ciGr.setLimit(1);
    ciGr.query();
    var ciSysId = ciGr.next() ? ciGr.getUniqueValue() : '';

    var grpGr = new GlideRecord('sys_user_group');
    grpGr.setLimit(1);
    grpGr.query();
    var grpSysId = grpGr.next() ? grpGr.getUniqueValue() : '';

    var testIncidents = [
        { short: 'Application server out of memory — heap exhaustion', notes: 'Restarted JVM, cleared heap dump' },
        { short: 'Java memory leak causing service degradation', notes: 'Increased heap allocation, restarted app' },
        { short: 'OutOfMemoryError on application server — service unavailable', notes: 'Emergency restart, heap dump collected' },
        { short: 'Memory exhaustion on app server — latency spike', notes: 'Restarted service, notified capacity team' }
    ];

    var openedAt = new GlideDateTime();
    openedAt.addDaysLocalTime(-15);

    for (var i = 0; i < testIncidents.length; i++) {
        var inc = new GlideRecord('incident');
        inc.initialize();
        inc.setValue('short_description', testIncidents[i].short);
        inc.setValue('description', testIncidents[i].short);
        inc.setValue('close_notes', testIncidents[i].notes);
        inc.setValue('category', 'Application');
        inc.setValue('subcategory', 'Performance');
        inc.setValue('state', 6);
        inc.setValue('priority', 2);
        inc.setValue('impact', 2);
        inc.setValue('urgency', 2);
        inc.setValue('cmdb_ci', ciSysId);
        inc.setValue('assignment_group', grpSysId);
        inc.setValue('opened_at', openedAt);
        var id = inc.insert();
        seededIds.push(id);
    }
    gs.print('[SEED] Created ' + seededIds.length + ' test incidents. CI: ' + ciSysId + ' Group: ' + grpSysId);
} catch (e) {
    gs.print('[SEED] Warning: ' + e.message + ' — continuing with empty CI/group');
}

// ─── PART 2: Run the analysis engine ─────────────────────────────────────────

var engine = new ORIAnalysisEngine();
var runSysId = engine.runMonthlyAnalysis();
gs.print('[RUN] Analysis run created: ' + runSysId);

// ─── PART 3: Verify Analysis Run record ──────────────────────────────────────

if (runSysId) {
    var runGr = new GlideRecord('x_ori_analysis_run');
    runGr.get(runSysId);
    var status = runGr.getValue('status');
    var reviewed = runGr.getValue('total_incidents_reviewed');
    var excluded = runGr.getValue('incidents_excluded');
    var analyzed = runGr.getValue('incidents_analyzed');
    var patterns = runGr.getValue('patterns_identified');
    var recs = runGr.getValue('recommendations_generated');

    gs.print('[RUN] Status: ' + status);
    gs.print('[RUN] Reviewed: ' + reviewed + ' | Excluded: ' + excluded + ' | Analyzed: ' + analyzed);
    gs.print('[RUN] Patterns identified: ' + patterns + ' | Recommendations: ' + recs);

    var isTerminal = ['completed', 'completed_with_errors', 'failed'].indexOf(status) !== -1;
    gs.print('[CHECK] Terminal status: ' + (isTerminal ? 'PASS' : 'FAIL'));
    gs.print('[CHECK] Incident counts populated: ' + (reviewed !== null ? 'PASS' : 'FAIL'));
}

// ─── PART 4: Manual verification instructions ────────────────────────────────

gs.print('');
gs.print('[NEXT STEPS — Manual]');
gs.print('1. Navigate to x_ori_analysis_run.list and open run: ' + runSysId);
gs.print('2. Verify status = completed or completed_with_errors');
gs.print('3. Navigate to x_ori_ai_recommendation.list — open any pending recommendation');
gs.print('4. Verify pattern_name, pattern_summary, trend_direction, and confidence_score are populated');
gs.print('5. Verify linked_incidents JSON contains incident numbers from the seeded data');
gs.print('6. Click ORI - Approve Recommendation');
gs.print('7. Navigate to problem.list — verify new Problem was created');
gs.print('8. Verify the Problem short_description matches the approved problem_statement');

// ─── PART 5: Cleanup instructions ────────────────────────────────────────────

gs.print('');
gs.print('[CLEANUP] Run this after verification to remove seeded incidents:');
gs.print('var idsToDelete = ' + JSON.stringify(seededIds) + ';');
gs.print('for (var i = 0; i < idsToDelete.length; i++) {');
gs.print('  var del = new GlideRecord("incident");');
gs.print('  if (del.get(idsToDelete[i])) del.deleteRecord();');
gs.print('}');
gs.print('gs.print("Cleanup complete — " + idsToDelete.length + " incidents deleted");');
