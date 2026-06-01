// Background script to test ORIAnalysisEngine
// Run in System > Background Scripts
// Note: Tests 2-4 invoke the real pipeline.
// completed_with_errors is expected when the Claude API key is not configured.

var engine = new ORIAnalysisEngine();

// --- Test 1: Kill-switch — x_ori.active='false' causes runMonthlyAnalysis to return null ---
var originalActive = gs.getProperty('x_ori.active', 'true');
gs.setProperty('x_ori.active', 'false');

var killSwitchResult = engine.runMonthlyAnalysis();
var test1 = killSwitchResult === null;
gs.print('Test 1 kill-switch returns null: ' + (test1 ? 'PASS' : 'FAIL'));

// Restore the property
gs.setProperty('x_ori.active', originalActive);

// --- Test 2: runMonthlyAnalysis() creates an Analysis Run record and returns a sys_id ---
var runSysId = engine.runMonthlyAnalysis();
var test2 = runSysId !== null && typeof runSysId === 'string' && runSysId.length > 0;
gs.print('Test 2 runMonthlyAnalysis returns a sys_id: ' + (test2 ? 'PASS' : 'FAIL'));

// --- Test 3: After run, Analysis Run status is a terminal value ---
var terminalStatuses = ['completed', 'completed_with_errors', 'failed'];
var statusIsTerminal = false;

if (runSysId) {
  var runCheck = new GlideRecord('x_ori_analysis_run');
  if (runCheck.get(runSysId)) {
    var runStatus = runCheck.getValue('status');
    for (var i = 0; i < terminalStatuses.length; i++) {
      if (runStatus === terminalStatuses[i]) {
        statusIsTerminal = true;
        break;
      }
    }
    gs.print('Test 3 run status is terminal (' + runStatus + '): ' + (statusIsTerminal ? 'PASS' : 'FAIL'));
  } else {
    gs.print('Test 3 run status is terminal: FAIL (run record not found)');
  }
} else {
  gs.print('Test 3 run status is terminal: FAIL (no runSysId)');
}

// --- Test 4: After run, clusters_found field is set (even if 0) ---
var clustersFieldSet = false;

if (runSysId) {
  var runCheck4 = new GlideRecord('x_ori_analysis_run');
  if (runCheck4.get(runSysId)) {
    var clustersFound = runCheck4.getValue('clusters_found');
    clustersFieldSet = clustersFound !== null && clustersFound !== '';
    gs.print('Test 4 clusters_found is set (' + clustersFound + '): ' + (clustersFieldSet ? 'PASS' : 'FAIL'));
  } else {
    gs.print('Test 4 clusters_found is set: FAIL (run record not found)');
  }
} else {
  gs.print('Test 4 clusters_found is set: FAIL (no runSysId)');
}

gs.print('All tests completed');
