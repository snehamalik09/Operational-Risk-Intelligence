// Background script to test ORIClusterBuilder
// Run in System > Background Scripts

var builder = new ORIClusterBuilder();
builder.initialize();

// Test 1: initialize() sets minIncidents=3 from sys_property
var test1 = builder.minIncidents === 3;
gs.print('Test 1 initialize minIncidents: ' + (test1 ? 'PASS' : 'FAIL'));

// Test 2: initialize() sets lookbackDays=30 from sys_property
var test2 = builder.lookbackDays === 30;
gs.print('Test 2 initialize lookbackDays: ' + (test2 ? 'PASS' : 'FAIL'));

// Test 3: _hash() returns a non-empty string
var hashResult = builder._hash('test input');
var test3 = typeof hashResult === 'string' && hashResult.length > 0;
gs.print('Test 3 _hash returns non-empty string: ' + (test3 ? 'PASS' : 'FAIL'));

// Test 4: _lookupName() returns empty string for empty sysId
var test4 = builder._lookupName('sys_user_group', '', 'name') === '';
gs.print('Test 4 _lookupName empty sysId: ' + (test4 ? 'PASS' : 'FAIL'));

// Test 5: _lookupName() returns a value for a real sys_user_group
var groupGr = new GlideRecord('sys_user_group');
groupGr.query();
var test5 = false;
if (groupGr.next()) {
  var groupSysId = groupGr.getValue('sys_id');
  var lookupResult = builder._lookupName('sys_user_group', groupSysId, 'name');
  test5 = lookupResult && lookupResult.length > 0;
}
gs.print('Test 5 _lookupName returns value for real sys_user_group: ' + (test5 ? 'PASS' : 'FAIL'));

// Test 6: buildClusters() returns an array
var analysisRunGr = new GlideRecord('x_ori_analysis_run');
analysisRunGr.initialize();
analysisRunGr.setValue('status', 'pending');
var analysisRunId = analysisRunGr.insert();

var clustersResult = builder.buildClusters(analysisRunId);
var test6 = Array.isArray(clustersResult);
gs.print('Test 6 buildClusters returns array: ' + (test6 ? 'PASS' : 'FAIL'));

// Clean up test records
var clusterCleanup = new GlideRecord('x_ori_incident_cluster');
clusterCleanup.addQuery('analysis_run', analysisRunId);
clusterCleanup.query();
clusterCleanup.deleteMultiple();

var cleanupGr = new GlideRecord('x_ori_analysis_run');
cleanupGr.get(analysisRunId);
cleanupGr.deleteRecord();

gs.print('All tests completed');
