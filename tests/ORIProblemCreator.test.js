// Background script to test ORIProblemCreator
// Run in System > Background Scripts

var creator = new ORIProblemCreator();

// --- Setup shared test data ---

// Create a test CI
var ciGr = new GlideRecord('cmdb_ci');
ciGr.initialize();
ciGr.setValue('name', 'ORI-TEST-CI-' + new GlideDateTime().getNumericValue());
var testCiSysId = ciGr.insert();

// Create a test assignment group
var groupGr = new GlideRecord('sys_user_group');
groupGr.initialize();
groupGr.setValue('name', 'ORI Test Group ' + new GlideDateTime().getNumericValue());
var testGroupSysId = groupGr.insert();

// Create a test analysis run
var runGr = new GlideRecord('x_ori_analysis_run');
runGr.initialize();
runGr.setValue('status', 'running');
var testRunSysId = runGr.insert();

// Create a test cluster WITH a CI (used for tests 1-3)
var clusterWithCiGr = new GlideRecord('x_ori_incident_cluster');
clusterWithCiGr.initialize();
clusterWithCiGr.setValue('analysis_run', testRunSysId);
clusterWithCiGr.setValue('ci', testCiSysId);
clusterWithCiGr.setValue('assignment_group', testGroupSysId);
clusterWithCiGr.setValue('category', 'software');
clusterWithCiGr.setValue('cluster_key', 'ori-test-ci-cluster');
clusterWithCiGr.setValue('incident_count', 3);
clusterWithCiGr.setValue('status', 'pending');
var testClusterWithCiId = clusterWithCiGr.insert();

// Create a test recommendation linked to the cluster with CI
var recGr = new GlideRecord('x_ori_ai_recommendation');
recGr.initialize();
recGr.setValue('analysis_run', testRunSysId);
recGr.setValue('cluster', testClusterWithCiId);
recGr.setValue('problem_statement', 'ORI Test: Recurring software failures on ORI-TEST-CI');
recGr.setValue('root_cause_hypothesis', 'Test root cause hypothesis text.');
recGr.setValue('recommendation_text', 'Test recommendation action text.');
recGr.setValue('pattern_summary', 'Test pattern summary.');
recGr.setValue('severity', 'high');
recGr.setValue('confidence_score', '0.85');
recGr.setValue('state', 'pending');
var testRecSysId = recGr.insert();

// Create two test incidents
var inc1Gr = new GlideRecord('incident');
inc1Gr.initialize();
inc1Gr.setValue('short_description', 'ORI Test Incident 1');
inc1Gr.setValue('caller_id', gs.getUserID());
var testInc1SysId = inc1Gr.insert();

var inc2Gr = new GlideRecord('incident');
inc2Gr.initialize();
inc2Gr.setValue('short_description', 'ORI Test Incident 2');
inc2Gr.setValue('caller_id', gs.getUserID());
var testInc2SysId = inc2Gr.insert();

// Link incidents to recommendation
var ri1Gr = new GlideRecord('x_ori_recommendation_incident');
ri1Gr.initialize();
ri1Gr.setValue('recommendation', testRecSysId);
ri1Gr.setValue('incident', testInc1SysId);
ri1Gr.insert();

var ri2Gr = new GlideRecord('x_ori_recommendation_incident');
ri2Gr.initialize();
ri2Gr.setValue('recommendation', testRecSysId);
ri2Gr.setValue('incident', testInc2SysId);
ri2Gr.insert();

// --- Test 1: createProblem creates a Problem record ---
var problemSysId = creator.createProblem(testRecSysId);
var test1 = problemSysId && problemSysId !== false && problemSysId.length > 0;
gs.print('Test 1 createProblem creates a Problem record: ' + (test1 ? 'PASS' : 'FAIL'));

// --- Test 2: recommendation.problem reference is populated after createProblem ---
var recCheck = new GlideRecord('x_ori_ai_recommendation');
recCheck.get(testRecSysId);
var recProblemValue = recCheck.getValue('problem');
var test2 = recProblemValue && recProblemValue === problemSysId;
gs.print('Test 2 recommendation.problem reference populated: ' + (test2 ? 'PASS' : 'FAIL'));

// --- Test 3: Duplicate guard — open Problem for same CI+category leads to linked_to_existing ---

// Create a second recommendation for the same cluster
var recGr2 = new GlideRecord('x_ori_ai_recommendation');
recGr2.initialize();
recGr2.setValue('analysis_run', testRunSysId);
recGr2.setValue('cluster', testClusterWithCiId);
recGr2.setValue('problem_statement', 'ORI Test Duplicate: Recurring software failures on ORI-TEST-CI');
recGr2.setValue('root_cause_hypothesis', 'Duplicate test root cause.');
recGr2.setValue('recommendation_text', 'Duplicate test recommendation.');
recGr2.setValue('pattern_summary', 'Duplicate test pattern.');
recGr2.setValue('severity', 'medium');
recGr2.setValue('confidence_score', '0.75');
recGr2.setValue('state', 'pending');
var testRec2SysId = recGr2.insert();

var problem2SysId = creator.createProblem(testRec2SysId);

var rec2Check = new GlideRecord('x_ori_ai_recommendation');
rec2Check.get(testRec2SysId);
var rec2State = rec2Check.getValue('state');
var test3 = rec2State === 'linked_to_existing';
gs.print('Test 3 duplicate guard sets state=linked_to_existing: ' + (test3 ? 'PASS' : 'FAIL'));

// --- Test 4: CI-less cluster — _findExistingProblem returns null, new Problem is created ---

// Create a cluster with NO CI
var clusterNoCiGr = new GlideRecord('x_ori_incident_cluster');
clusterNoCiGr.initialize();
clusterNoCiGr.setValue('analysis_run', testRunSysId);
clusterNoCiGr.setValue('category', 'network');
clusterNoCiGr.setValue('cluster_key', 'ori-test-no-ci-cluster');
clusterNoCiGr.setValue('incident_count', 3);
clusterNoCiGr.setValue('status', 'pending');
var testClusterNoCiId = clusterNoCiGr.insert();

var recNoCiGr = new GlideRecord('x_ori_ai_recommendation');
recNoCiGr.initialize();
recNoCiGr.setValue('analysis_run', testRunSysId);
recNoCiGr.setValue('cluster', testClusterNoCiId);
recNoCiGr.setValue('problem_statement', 'ORI Test: Network pattern without CI');
recNoCiGr.setValue('root_cause_hypothesis', 'No CI root cause text.');
recNoCiGr.setValue('recommendation_text', 'No CI recommendation text.');
recNoCiGr.setValue('pattern_summary', 'No CI pattern summary.');
recNoCiGr.setValue('severity', 'low');
recNoCiGr.setValue('confidence_score', '0.65');
recNoCiGr.setValue('state', 'pending');
var testRecNoCiSysId = recNoCiGr.insert();

var problemNoCiSysId = creator.createProblem(testRecNoCiSysId);

var test4a = problemNoCiSysId && problemNoCiSysId !== false && problemNoCiSysId.length > 0;
var recNoCiCheck = new GlideRecord('x_ori_ai_recommendation');
recNoCiCheck.get(testRecNoCiSysId);
var recNoCiState = recNoCiCheck.getValue('state');
var test4b = recNoCiState !== 'linked_to_existing';
var test4 = test4a && test4b;
gs.print('Test 4 CI-less cluster creates new problem (not linked_to_existing): ' + (test4 ? 'PASS' : 'FAIL'));

// --- Cleanup ---

// Delete x_ori_recommendation_incident rows
var riCleanup = new GlideRecord('x_ori_recommendation_incident');
riCleanup.addQuery('recommendation', 'IN', testRecSysId + ',' + testRec2SysId + ',' + testRecNoCiSysId);
riCleanup.query();
riCleanup.deleteMultiple();

// Delete recommendation records
var recCleanup = new GlideRecord('x_ori_ai_recommendation');
recCleanup.addQuery('analysis_run', testRunSysId);
recCleanup.query();
recCleanup.deleteMultiple();

// Delete problem records created by these tests
var probCleanup1 = new GlideRecord('problem');
if (problemSysId && probCleanup1.get(problemSysId)) {
  probCleanup1.deleteRecord();
}
var probCleanup2 = new GlideRecord('problem');
if (problemNoCiSysId && probCleanup2.get(problemNoCiSysId)) {
  probCleanup2.deleteRecord();
}

// Delete clusters
var clusterCleanup = new GlideRecord('x_ori_incident_cluster');
clusterCleanup.addQuery('analysis_run', testRunSysId);
clusterCleanup.query();
clusterCleanup.deleteMultiple();

// Delete incidents
var incCleanup1 = new GlideRecord('incident');
if (incCleanup1.get(testInc1SysId)) {
  incCleanup1.deleteRecord();
}
var incCleanup2 = new GlideRecord('incident');
if (incCleanup2.get(testInc2SysId)) {
  incCleanup2.deleteRecord();
}

// Delete analysis run
var runCleanup = new GlideRecord('x_ori_analysis_run');
if (runCleanup.get(testRunSysId)) {
  runCleanup.deleteRecord();
}

// Delete CI and group
var ciCleanup = new GlideRecord('cmdb_ci');
if (ciCleanup.get(testCiSysId)) {
  ciCleanup.deleteRecord();
}
var groupCleanup = new GlideRecord('sys_user_group');
if (groupCleanup.get(testGroupSysId)) {
  groupCleanup.deleteRecord();
}

gs.print('All tests completed');
