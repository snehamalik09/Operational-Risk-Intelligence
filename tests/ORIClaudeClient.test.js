// Background script to test ORIClaudeClient
// Run in System > Background Scripts
// All tests operate on _parsePatterns and _buildSystemPrompt — no real API call required

var client = new ORIClaudeClient();

// Test 1: _parsePatterns handles empty patterns array
var r1 = client._parsePatterns('{"patterns": []}');
gs.print('Test 1 empty patterns: ' + (r1.success && r1.patterns.length === 0 ? 'PASS' : 'FAIL'));

// Test 2: _parsePatterns returns valid pattern with all required fields
var validPattern = JSON.stringify({ patterns: [{
    pattern_name: 'DB Connection Exhaustion',
    pattern_summary: 'Recurring DB timeout.',
    root_cause_hypothesis: 'Connection pool exhausted.',
    confidence: 0.9,
    trend_direction: 'increasing',
    affected_incidents: ['INC001', 'INC002'],
    recommended_action: 'Investigate connection pool.',
    problem_statement: 'Recurring DB timeouts on PRD-DB01',
    primary_ci: 'PRD-DB01'
}]});
var r2 = client._parsePatterns(validPattern);
gs.print('Test 2 valid pattern parsed: ' + (r2.success && r2.patterns.length === 1 ? 'PASS' : 'FAIL'));
gs.print('  pattern_name: ' + (r2.patterns[0] && r2.patterns[0].pattern_name));

// Test 3: _parsePatterns strips markdown fences
var r3 = client._parsePatterns('```json\n{"patterns": []}\n```');
gs.print('Test 3 strips markdown fences: ' + (r3.success ? 'PASS' : 'FAIL'));

// Test 4: _parsePatterns filters out patterns below confidence threshold
var lowConf = JSON.stringify({ patterns: [{
    pattern_name: 'Weak Pattern', pattern_summary: 'x', root_cause_hypothesis: 'x',
    confidence: 0.3, trend_direction: 'stable',
    affected_incidents: ['INC001', 'INC002'],
    recommended_action: 'x', problem_statement: 'x', primary_ci: 'CI-01'
}]});
var r4 = client._parsePatterns(lowConf);
gs.print('Test 4 low confidence filtered: ' + (r4.success && r4.patterns.length === 0 ? 'PASS' : 'FAIL'));

// Test 5: _parsePatterns filters out patterns with fewer than 2 affected incidents
var oneIncident = JSON.stringify({ patterns: [{
    pattern_name: 'Single Incident', pattern_summary: 'x', root_cause_hypothesis: 'x',
    confidence: 0.9, trend_direction: 'stable',
    affected_incidents: ['INC001'],
    recommended_action: 'x', problem_statement: 'x', primary_ci: 'CI-01'
}]});
var r5 = client._parsePatterns(oneIncident);
gs.print('Test 5 single incident filtered: ' + (r5.success && r5.patterns.length === 0 ? 'PASS' : 'FAIL'));

// Test 6: _parsePatterns returns failure for non-JSON content
var r6 = client._parsePatterns('This is not JSON');
gs.print('Test 6 non-JSON returns failure: ' + (!r6.success ? 'PASS' : 'FAIL'));

// Test 7: _parsePatterns filters pattern missing required field (primary_ci absent)
var missingField = JSON.stringify({ patterns: [{
    pattern_name: 'Missing Primary CI', pattern_summary: 'x', root_cause_hypothesis: 'x',
    confidence: 0.9, trend_direction: 'stable',
    affected_incidents: ['INC001', 'INC002'],
    recommended_action: 'x', problem_statement: 'x'
}]});
var r7 = client._parsePatterns(missingField);
gs.print('Test 7 missing primary_ci filtered: ' + (r7.success && r7.patterns.length === 0 ? 'PASS' : 'FAIL'));

// Test 8: _buildSystemPrompt returns a non-empty string containing key instructions
var prompt = client._buildSystemPrompt();
gs.print('Test 8 system prompt non-empty: ' + (typeof prompt === 'string' && prompt.length > 100 ? 'PASS' : 'FAIL'));
gs.print('Test 8 prompt contains pattern_name field: ' + (prompt.indexOf('pattern_name') !== -1 ? 'PASS' : 'FAIL'));

// Test 9: analyzePool returns empty patterns immediately for empty incident array
var r9 = client.analyzePool([], { period_start: '2026-05-01', period_end: '2026-05-31', total_incidents: 0 });
gs.print('Test 9 empty pool: ' + (r9.success && r9.patterns.length === 0 ? 'PASS' : 'FAIL'));

gs.print('All ORIClaudeClient tests completed');
