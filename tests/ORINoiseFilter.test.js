// Background script to test ORINoiseFilter
// Run in System > Background Scripts

var filter = new ORINoiseFilter();
filter.initialize();

// Test 1: isNoise() returns true for "Password reset request for user"
var mockRecord1 = {
  getValue: function(field) {
    if (field === 'short_description') {
      return 'Password reset request for user';
    }
    return null;
  }
};
var test1 = filter.isNoise(mockRecord1) === true;
gs.print('Test 1 isNoise password reset: ' + (test1 ? 'PASS' : 'FAIL'));

// Test 2: isNoise() returns false for "Database connection timeout on PRD-DB01"
var mockRecord2 = {
  getValue: function(field) {
    if (field === 'short_description') {
      return 'Database connection timeout on PRD-DB01';
    }
    return null;
  }
};
var test2 = filter.isNoise(mockRecord2) === false;
gs.print('Test 2 isNoise database timeout: ' + (test2 ? 'PASS' : 'FAIL'));

// Test 3: isNoise() returns true for "vpn access issue"
var mockRecord3 = {
  getValue: function(field) {
    if (field === 'short_description') {
      return 'vpn access issue';
    }
    return null;
  }
};
var test3 = filter.isNoise(mockRecord3) === true;
gs.print('Test 3 isNoise vpn access: ' + (test3 ? 'PASS' : 'FAIL'));

// Test 4: isNoise() returns false for "Application server memory exhaustion"
var mockRecord4 = {
  getValue: function(field) {
    if (field === 'short_description') {
      return 'Application server memory exhaustion';
    }
    return null;
  }
};
var test4 = filter.isNoise(mockRecord4) === false;
gs.print('Test 4 isNoise app server memory: ' + (test4 ? 'PASS' : 'FAIL'));

// Test 5: excludedCategories array is non-empty after initialize
var test5 = filter.excludedCategories && filter.excludedCategories.length > 0;
gs.print('Test 5 excludedCategories non-empty: ' + (test5 ? 'PASS' : 'FAIL'));

// Test 6: getSummary() returns a string containing the excluded count after calling isNoise() twice on noise incidents
var mockRecord5 = {
  getValue: function(field) {
    if (field === 'short_description') {
      return 'password reset request';
    }
    return null;
  }
};
var mockRecord6 = {
  getValue: function(field) {
    if (field === 'short_description') {
      return 'access request';
    }
    return null;
  }
};
filter.isNoise(mockRecord5);
filter.isNoise(mockRecord6);
var summary = filter.getSummary();
var test6 = typeof summary === 'string' && summary.indexOf(filter.excludedCount.toString()) !== -1;
gs.print('Test 6 getSummary with count: ' + (test6 ? 'PASS' : 'FAIL'));

// Test 7: applyQueryFilters() can be called on a mock GlideAggregate without throwing
var mockGlideAggregate = {
  addQuery: function(field, op, value) {
    gs.print('addQuery called: ' + field + ' ' + op);
  }
};
var test7 = false;
try {
  filter.applyQueryFilters(mockGlideAggregate);
  test7 = true;
} catch (e) {
  gs.print('Error in applyQueryFilters: ' + e.message);
}
gs.print('Test 7 applyQueryFilters no throw: ' + (test7 ? 'PASS' : 'FAIL'));

gs.print('All tests completed');
