// Background script to test ORIProblemCreator
// Run in System > Background Scripts

// Create a minimal recommendation with linked_incidents JSON (empty sys_ids — no real incidents needed)
var recGr = new GlideRecord('x_ori_ai_recommendation');
recGr.initialize();
recGr.setValue('pattern_name', 'Test Memory Leak Pattern');
recGr.setValue('dedup_key', 'Test Memory Leak Pattern|APP-TEST-01');
recGr.setValue('pattern_summary', 'Recurring memory leak');
recGr.setValue('root_cause_hypothesis', 'JVM heap exhaustion');
recGr.setValue('recommendation_text', 'Investigate heap settings');
recGr.setValue('problem_statement', 'Recurring memory leak on APP-TEST-01');
recGr.setValue('confidence_score', 0.85);
recGr.setValue('trend_direction', 'increasing');
recGr.setValue('primary_ci', 'APP-TEST-01');
recGr.setValue('linked_incidents', '[]');
recGr.setValue('state', 'pending');
var recSysId = recGr.insert();

// Test 1: createProblem creates a Problem record
var creator = new ORIProblemCreator();
var problemSysId = creator.createProblem(recSysId);
gs.print('Test 1 Problem created: ' + (problemSysId ? 'PASS' : 'FAIL') + ' — ' + problemSysId);

// Test 2: recommendation.problem reference is set
var checkRec = new GlideRecord('x_ori_ai_recommendation');
checkRec.get(recSysId);
gs.print('Test 2 recommendation.problem set: ' + (checkRec.getValue('problem') === problemSysId ? 'PASS' : 'FAIL'));

// Test 3: Problem short_description matches problem_statement
var checkProblem = new GlideRecord('problem');
checkProblem.get(problemSysId);
gs.print('Test 3 problem short_description correct: ' + (checkProblem.getValue('short_description') === 'Recurring memory leak on APP-TEST-01' ? 'PASS' : 'FAIL'));

// Test 4: approved_by is set after createProblem
gs.print('Test 4 approved_by set: ' + (checkRec.getValue('approved_by') ? 'PASS' : 'FAIL'));

// Test 5: createProblem returns false for unknown sys_id
var result5 = new ORIProblemCreator().createProblem('nonexistent_0000000000000000');
gs.print('Test 5 unknown sys_id returns false: ' + (result5 === false ? 'PASS' : 'FAIL'));

// Test 6: _findExistingProblem returns null when pattern_name is empty
var emptyRec = new GlideRecord('x_ori_ai_recommendation');
emptyRec.initialize();
emptyRec.setValue('pattern_name', '');
emptyRec.setValue('primary_ci', '');
emptyRec.setValue('state', 'pending');
var emptyRecId = emptyRec.insert();
var emptyRecGr = new GlideRecord('x_ori_ai_recommendation');
emptyRecGr.get(emptyRecId);
gs.print('Test 6 empty pattern_name returns null: ' + (new ORIProblemCreator()._findExistingProblem(emptyRecGr) === null ? 'PASS' : 'FAIL'));

// Cleanup
var del1 = new GlideRecord('problem'); if (del1.get(problemSysId)) { del1.deleteRecord(); }
var del2 = new GlideRecord('x_ori_ai_recommendation'); if (del2.get(recSysId)) { del2.deleteRecord(); }
var del3 = new GlideRecord('x_ori_ai_recommendation'); if (del3.get(emptyRecId)) { del3.deleteRecord(); }
gs.print('All ORIProblemCreator tests completed');
