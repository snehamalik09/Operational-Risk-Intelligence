// Background script to test ORIClaudeClient
// Run in System > Background Scripts

var client = new ORIClaudeClient();
client.initialize();

// Test 1: _parseResponse with minimal JSON (no pattern)
var test1Input = '{"is_pattern": false}';
var test1Result = client._parseResponse(test1Input);
var test1Pass = test1Result.success === true && test1Result.result.is_pattern === false;
gs.print('Test 1 _parseResponse no pattern: ' + (test1Pass ? 'PASS' : 'FAIL'));

// Test 2: _parseResponse with valid full JSON (is_pattern=true, confidence=0.9, all fields)
var test2Input = '{"is_pattern": true, "confidence": 0.9, "pattern_summary": "Database timeout pattern", "root_cause_hypothesis": "Connection pool exhaustion on primary database server.", "recommendation": "Increase connection pool size and implement monitoring.", "severity": "high", "problem_statement": "Recurring database connection timeouts affecting service availability"}';
var test2Result = client._parseResponse(test2Input);
var test2Pass = test2Result.success === true && test2Result.result.is_pattern === true && test2Result.result.confidence === 0.9;
gs.print('Test 2 _parseResponse full JSON: ' + (test2Pass ? 'PASS' : 'FAIL'));

// Test 3: _parseResponse strips markdown code fences
var test3Input = '```json\n{"is_pattern": false}\n```';
var test3Result = client._parseResponse(test3Input);
var test3Pass = test3Result.success === true && test3Result.result.is_pattern === false;
gs.print('Test 3 _parseResponse strips markdown: ' + (test3Pass ? 'PASS' : 'FAIL'));

// Test 4: _parseResponse with low confidence (0.3)
var test4Input = '{"is_pattern": true, "confidence": 0.3, "pattern_summary": "Weak pattern", "root_cause_hypothesis": "Unknown cause.", "recommendation": "Investigate further.", "severity": "low", "problem_statement": "Weak pattern detected"}';
var test4Result = client._parseResponse(test4Input);
var test4Pass = test4Result.success === true && test4Result.result.is_pattern === false && test4Result.result.skipped_reason === 'confidence_below_threshold';
gs.print('Test 4 _parseResponse low confidence: ' + (test4Pass ? 'PASS' : 'FAIL'));

// Test 5: _parseResponse with missing required field (no pattern_summary)
var test5Input = '{"is_pattern": true, "confidence": 0.9, "root_cause_hypothesis": "Some cause.", "recommendation": "Do something.", "severity": "high", "problem_statement": "Some statement"}';
var test5Result = client._parseResponse(test5Input);
var test5Pass = test5Result.success === false && test5Result.error.indexOf('pattern_summary') !== -1;
gs.print('Test 5 _parseResponse missing field: ' + (test5Pass ? 'PASS' : 'FAIL'));

// Test 6: _buildPrompt with mock cluster data containing ci_name='PRD-DB01' and 1 incident
var mockClusterData = {
  ci_name: 'PRD-DB01',
  group_name: 'Database Team',
  service_name: 'Order Processing',
  category: 'Infrastructure',
  start_date: '2025-01-01',
  end_date: '2025-01-31',
  incidents: [
    {
      number: 'INC0001001',
      short_description: 'Database connection timeout',
      resolution_notes: 'Increased pool size',
      priority: 'High',
      category: 'Infrastructure'
    }
  ]
};
var test6Prompt = client._buildPrompt(mockClusterData);
var test6Pass = test6Prompt.indexOf('PRD-DB01') !== -1;
gs.print('Test 6 _buildPrompt contains CI name: ' + (test6Pass ? 'PASS' : 'FAIL'));

// Test 7: _buildPrompt includes the incident number in the output
var test7Pass = test6Prompt.indexOf('INC0001001 |') !== -1;
gs.print('Test 7 _buildPrompt includes incident number: ' + (test7Pass ? 'PASS' : 'FAIL'));

gs.print('All tests completed');
