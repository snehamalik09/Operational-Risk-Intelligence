// Background script to test ORIAnalysisEngine
// Run in System > Background Scripts
// Tests 2-4 invoke the real pipeline — completed_with_errors is expected if Claude API key is not set

// Test 1: Kill-switch returns null when x_ori.active = false
gs.setProperty('x_ori.active', 'false');
var engine1 = new ORIAnalysisEngine();
var killResult = engine1.runMonthlyAnalysis();
gs.print('Test 1 kill-switch returns null: ' + (killResult === null ? 'PASS' : 'FAIL'));
gs.setProperty('x_ori.active', 'true');

// Test 2: runMonthlyAnalysis creates an Analysis Run record
var engine2 = new ORIAnalysisEngine();
var runSysId = engine2.runMonthlyAnalysis();
gs.print('Test 2 run record created: ' + (runSysId ? 'PASS' : 'FAIL') + ' — ' + runSysId);

if (runSysId) {
    var runGr = new GlideRecord('x_ori_analysis_run');
    runGr.get(runSysId);

    // Test 3: Run has a terminal status
    var finalStatus = runGr.getValue('status');
    var isTerminal = ['completed', 'completed_with_errors', 'failed'].indexOf(finalStatus) !== -1;
    gs.print('Test 3 terminal status: ' + (isTerminal ? 'PASS' : 'FAIL') + ' — ' + finalStatus);

    // Test 4: Incident counts are populated (even if 0)
    var reviewed = runGr.getValue('total_incidents_reviewed');
    var excluded = runGr.getValue('incidents_excluded');
    var analyzed = runGr.getValue('incidents_analyzed');
    gs.print('Test 4 incident counts set: ' + (reviewed !== null && excluded !== null && analyzed !== null ? 'PASS' : 'FAIL'));
    gs.print('  reviewed=' + reviewed + ' excluded=' + excluded + ' analyzed=' + analyzed);
}

// Test 5: _computeDedupKey produces expected format
var engine3 = new ORIAnalysisEngine();
var key = engine3._computeDedupKey('DB Connection Exhaustion', 'PRD-DB01');
gs.print('Test 5 dedup key format: ' + (key === 'DB Connection Exhaustion|PRD-DB01' ? 'PASS' : 'FAIL') + ' — ' + key);

// Test 6: _isDuplicate returns false for a key that does not exist
var uniqueKey = 'NonExistentPattern_' + new GlideDateTime().getNumericValue() + '|CI-TEST';
gs.print('Test 6 non-existent dedup key: ' + (!engine3._isDuplicate(uniqueKey) ? 'PASS' : 'FAIL'));

// Test 7: _sanitizeIncident strips internal fields and includes risk_score
var testInc = {
    sys_id: 'abc123', number: 'INC001', short_description: 'test', description: 'test desc',
    close_notes: 'fixed', priority: 2, priority_display: '2 - High',
    impact: 1, impact_display: '1 - High', urgency: 2, urgency_display: '2 - Medium',
    category: 'Application', subcategory: 'Performance',
    ci_name: 'APP-01', assignment_group_name: 'App Team',
    major_incident_state: 0, risk_score: 75
};
var sanitized = engine3._sanitizeIncident(testInc);
gs.print('Test 7 sanitized has number: ' + (sanitized.number === 'INC001' ? 'PASS' : 'FAIL'));
gs.print('Test 7 sanitized has risk_score: ' + (sanitized.risk_score === 75 ? 'PASS' : 'FAIL'));
gs.print('Test 7 sanitized no sys_id: ' + (!sanitized.sys_id ? 'PASS' : 'FAIL'));

gs.print('All ORIAnalysisEngine tests completed');
