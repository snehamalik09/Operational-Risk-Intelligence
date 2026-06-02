// Background script to test ORIClusterBuilder (includes folded noise filter tests)
// Run in System > Background Scripts

var builder = new ORIClusterBuilder();

// Test 1: initialize() sets minIncidents=3 from sys_property
gs.print('Test 1 initialize minIncidents: ' + (builder.minIncidents === 3 ? 'PASS' : 'FAIL'));

// Test 2: initialize() sets lookbackDays=30 from sys_property
gs.print('Test 2 initialize lookbackDays: ' + (builder.lookbackDays === 30 ? 'PASS' : 'FAIL'));

// Test 3: _hash() returns a non-empty string
var hashResult = builder._hash('test input');
gs.print('Test 3 _hash returns non-empty string: ' + (typeof hashResult === 'string' && hashResult.length > 0 ? 'PASS' : 'FAIL'));

// Test 4: _lookupName() returns empty string for empty sysId
gs.print('Test 4 _lookupName empty sysId: ' + (builder._lookupName('sys_user_group', '', 'name') === '' ? 'PASS' : 'FAIL'));

// Test 5: _lookupName() returns a value for a real sys_user_group
var groupGr = new GlideRecord('sys_user_group');
groupGr.query();
if (groupGr.next()) {
  var lookupResult = builder._lookupName('sys_user_group', groupGr.getValue('sys_id'), 'name');
  gs.print('Test 5 _lookupName real group: ' + (lookupResult && lookupResult.length > 0 ? 'PASS' : 'FAIL'));
} else {
  gs.print('Test 5 _lookupName real group: SKIP (no groups on instance)');
}

// Test 6: buildClusters() returns an array
var runGr = new GlideRecord('x_ori_analysis_run');
runGr.initialize();
runGr.setValue('status', 'pending');
var runId = runGr.insert();
var clustersResult = builder.buildClusters(runId);
gs.print('Test 6 buildClusters returns array: ' + (Array.isArray(clustersResult) ? 'PASS' : 'FAIL'));
gs.print('  clusters found: ' + clustersResult.length);
// Clean up
var clusterCleanup = new GlideRecord('x_ori_incident_cluster');
clusterCleanup.addQuery('analysis_run', runId);
clusterCleanup.query();
clusterCleanup.deleteMultiple();
var runCleanup = new GlideRecord('x_ori_analysis_run');
runCleanup.get(runId);
runCleanup.deleteRecord();

// --- Noise filter tests (formerly ORINoiseFilter.test.js) ---
var nf = new ORIClusterBuilder();

// Test 7: _isNoise() returns true for a password reset description
var mockReset = { getValue: function(f) { return f === 'short_description' ? 'Password reset request for user' : null; } };
gs.print('Test 7 _isNoise true for password reset: ' + (nf._isNoise(mockReset) === true ? 'PASS' : 'FAIL'));

// Test 8: _isNoise() returns false for a real operational incident
var mockReal = { getValue: function(f) { return f === 'short_description' ? 'Database connection timeout on PRD-DB01' : null; } };
gs.print('Test 8 _isNoise false for real incident: ' + (nf._isNoise(mockReal) === false ? 'PASS' : 'FAIL'));

// Test 9: _isNoise() returns true for a vpn access description
var mockVpn = { getValue: function(f) { return f === 'short_description' ? 'vpn access issue' : null; } };
gs.print('Test 9 _isNoise true for vpn access: ' + (nf._isNoise(mockVpn) === true ? 'PASS' : 'FAIL'));

// Test 10: _isNoise() returns false for a memory exhaustion incident
var mockMem = { getValue: function(f) { return f === 'short_description' ? 'Application server memory exhaustion' : null; } };
gs.print('Test 10 _isNoise false for memory exhaustion: ' + (nf._isNoise(mockMem) === false ? 'PASS' : 'FAIL'));

// Test 11: excludedCategories loaded from sys_property
gs.print('Test 11 excludedCategories non-empty: ' + (nf.excludedCategories.length > 0 ? 'PASS' : 'FAIL'));

// Test 12: getNoiseFilterSummary() reflects count after noise matches
var nf2 = new ORIClusterBuilder();
nf2._isNoise({ getValue: function(f) { return f === 'short_description' ? 'password reset' : null; } });
nf2._isNoise({ getValue: function(f) { return f === 'short_description' ? 'access request for new user' : null; } });
var summary = nf2.getNoiseFilterSummary();
gs.print('Test 12 getNoiseFilterSummary reflects count: ' + (summary.indexOf('2') !== -1 ? 'PASS' : 'FAIL') + ' — ' + summary);

// Test 13: _applyNoiseQueryFilters() does not throw on a mock GlideAggregate
var mockGa = { addQuery: function(f, op, v) { /* no-op */ } };
var applyOk = false;
try { nf._applyNoiseQueryFilters(mockGa); applyOk = true; } catch (e) { gs.print('Error: ' + e.message); }
gs.print('Test 13 _applyNoiseQueryFilters no throw: ' + (applyOk ? 'PASS' : 'FAIL'));

gs.print('All tests completed');
