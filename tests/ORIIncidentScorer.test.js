// Background script to test ORIIncidentScorer
// Run in System > Background Scripts

var scorer = new ORIIncidentScorer();

// Test 1: P1 Critical = 30 points
var p1 = { priority: 1, impact: 3, urgency: 3, major_incident_state: 0, category: 'General', short_description: '', description: '' };
gs.print('Test 1 P1=30pts: ' + (scorer.calculateScore(p1) === 30 ? 'PASS' : 'FAIL') + ' — ' + scorer.calculateScore(p1));

// Test 2: P2 High + Impact High + Urgency High = 60 points
var p2 = { priority: 2, impact: 1, urgency: 1, major_incident_state: 0, category: 'General', short_description: '', description: '' };
gs.print('Test 2 P2+ImpHigh+UrgHigh=60: ' + (scorer.calculateScore(p2) === 60 ? 'PASS' : 'FAIL') + ' — ' + scorer.calculateScore(p2));

// Test 3: Major Incident adds 50 points
var major = { priority: 3, impact: 3, urgency: 3, major_incident_state: 3, category: 'General', short_description: '', description: '' };
gs.print('Test 3 MajorIncident=60(10+50): ' + (scorer.calculateScore(major) === 60 ? 'PASS' : 'FAIL') + ' — ' + scorer.calculateScore(major));

// Test 4: Operational category adds bonus (default 15)
var opCat = { priority: 4, impact: 3, urgency: 3, major_incident_state: 0, category: 'Database', short_description: '', description: '' };
var scoreWithBonus = scorer.calculateScore(opCat);
gs.print('Test 4 operational category bonus: ' + (scoreWithBonus > 0 ? 'PASS' : 'FAIL') + ' — ' + scoreWithBonus);

// Test 5: Risk keyword in description adds bonus
var kwInc = { priority: 4, impact: 3, urgency: 3, major_incident_state: 0, category: 'General', short_description: 'timeout on server', description: '' };
var scoreWithKw = scorer.calculateScore(kwInc);
gs.print('Test 5 risk keyword adds bonus: ' + (scoreWithKw > 0 ? 'PASS' : 'FAIL') + ' — ' + scoreWithKw);

// Test 6: P4 + Low impact + Low urgency + no major + no keyword = 0
var minimal = { priority: 4, impact: 3, urgency: 3, major_incident_state: 0, category: 'General', short_description: 'generic issue', description: '' };
gs.print('Test 6 minimal incident score=0: ' + (scorer.calculateScore(minimal) === 0 ? 'PASS' : 'FAIL') + ' — ' + scorer.calculateScore(minimal));

// Test 7: Higher risk incident scores higher than lower risk
var highRisk = { priority: 1, impact: 1, urgency: 1, major_incident_state: 3, category: 'Database', short_description: 'outage memory leak timeout', description: '' };
var lowRisk = { priority: 4, impact: 3, urgency: 3, major_incident_state: 0, category: 'General', short_description: 'minor glitch', description: '' };
gs.print('Test 7 high > low risk score: ' + (scorer.calculateScore(highRisk) > scorer.calculateScore(lowRisk) ? 'PASS' : 'FAIL'));

gs.print('All ORIIncidentScorer tests completed');
