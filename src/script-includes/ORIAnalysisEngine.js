var ORIAnalysisEngine = Class.create();

ORIAnalysisEngine.prototype = {
  initialize: function() {
    this._excludedCategories = this._splitProp('x_ori.excluded_categories');
    this._excludedSubcategories = this._splitProp('x_ori.excluded_subcategories');
    this._noiseKeywords = this._splitProp('x_ori.noise_keywords').map(function(k) {
      return k.toLowerCase();
    });
  },

  runMonthlyAnalysis: function() {
    if (gs.getProperty('x_ori.active', 'true') !== 'true') {
      gs.log('ORIAnalysisEngine: x_ori.active is not true — skipping analysis.');
      return null;
    }

    var runGr = new GlideRecord('x_ori_analysis_run');
    runGr.initialize();
    runGr.setValue('run_date', new GlideDate().getDisplayValue());
    runGr.setValue('status', 'running');
    runGr.setValue('triggered_by', gs.getUserID());
    var runSysId = runGr.insert();

    try {
      this._executeAnalysis(runSysId);
    } catch (e) {
      this._setRunStatus(runSysId, 'failed', e.message);
      gs.error('ORIAnalysisEngine._executeAnalysis failed: ' + e.message);
    }

    return runSysId;
  },

  _executeAnalysis: function(runSysId) {
    var lookbackDays = parseInt(gs.getProperty('x_ori.lookback_days', '30'), 10);
    var startDate = new GlideDateTime();
    startDate.addDaysLocalTime(-lookbackDays);

    // Stage 1 — Count total incidents before filtering
    var gaCount = new GlideAggregate('incident');
    gaCount.addQuery('state', 'IN', '6,7');
    gaCount.addQuery('opened_at', '>=', startDate);
    gaCount.addAggregate('COUNT');
    gaCount.query();
    var totalReviewed = 0;
    if (gaCount.next()) {
      totalReviewed = parseInt(gaCount.getAggregate('COUNT') || '0', 10);
    }

    // Stage 1 — Fetch qualifying incidents with noise filters applied
    var gr = new GlideRecord('incident');
    gr.addQuery('state', 'IN', '6,7');
    gr.addQuery('opened_at', '>=', startDate);
    this._applyNoiseQueryFilters(gr);
    gr.query();

    var incidentPool = [];
    while (gr.next()) {
      if (this._isNoise(gr)) { continue; }
      incidentPool.push(this._extractIncidentData(gr));
    }

    var runGr = new GlideRecord('x_ori_analysis_run');
    runGr.get(runSysId);
    runGr.setValue('total_incidents_reviewed', totalReviewed);
    runGr.setValue('incidents_excluded', totalReviewed - incidentPool.length);
    runGr.setValue('incidents_analyzed', incidentPool.length);
    runGr.update();

    if (incidentPool.length === 0) {
      this._setRunStatus(runSysId, 'completed', '');
      gs.eventQueue('x_ori.analysis.complete', new GlideRecord('x_ori_analysis_run'), runSysId, '');
      return;
    }

    // Stage 2 — Risk scoring
    var scorer = new ORIIncidentScorer();
    for (var i = 0; i < incidentPool.length; i++) {
      incidentPool[i].risk_score = scorer.calculateScore(incidentPool[i]);
    }

    // Stage 3 — Sort by risk score desc, truncate, prepare sanitized payload
    incidentPool.sort(function(a, b) { return b.risk_score - a.risk_score; });
    var maxPerCall = parseInt(gs.getProperty('x_ori.max_incidents_per_call', '200'), 10);
    if (incidentPool.length > maxPerCall) {
      incidentPool = incidentPool.slice(0, maxPerCall);
    }

    var incidentLookupMap = {};
    var sanitizedPool = [];
    for (var j = 0; j < incidentPool.length; j++) {
      var inc = incidentPool[j];
      incidentLookupMap[inc.number] = inc.sys_id;
      sanitizedPool.push(this._sanitizeIncident(inc));
    }

    var context = {
      period_start: startDate.getDisplayValue(),
      period_end: new GlideDateTime().getDisplayValue(),
      total_incidents: sanitizedPool.length
    };

    // Stage 4 — Claude semantic analysis (single call)
    var claudeClient = new ORIClaudeClient();
    var aiResult = claudeClient.analyzePool(sanitizedPool, context);

    if (!aiResult.success) {
      this._setRunStatus(runSysId, 'completed_with_errors', aiResult.error);
      gs.eventQueue('x_ori.analysis.complete', new GlideRecord('x_ori_analysis_run'), runSysId, '');
      return;
    }

    // Stage 5 — Dedup check and recommendation creation
    var patterns = aiResult.patterns || [];
    var recCount = 0;
    for (var k = 0; k < patterns.length; k++) {
      var pattern = patterns[k];
      var dedupKey = this._computeDedupKey(pattern.pattern_name, pattern.primary_ci);
      if (this._isDuplicate(dedupKey)) { continue; }
      this._createRecommendation(runSysId, pattern, incidentLookupMap);
      recCount++;
    }

    var runGr2 = new GlideRecord('x_ori_analysis_run');
    runGr2.get(runSysId);
    runGr2.setValue('patterns_identified', patterns.length);
    runGr2.setValue('recommendations_generated', recCount);
    runGr2.setValue('status', 'completed');
    runGr2.update();

    gs.eventQueue('x_ori.analysis.complete', runGr2, runSysId, '');
  },

  _createRecommendation: function(runSysId, pattern, incidentLookupMap) {
    // Resolve incident numbers to {number, sys_id} pairs
    var linked = [];
    var affected = pattern.affected_incidents || [];
    for (var i = 0; i < affected.length; i++) {
      var num = affected[i];
      var sysId = incidentLookupMap[num];
      if (sysId) { linked.push({ number: num, sys_id: sysId }); }
    }

    // Derive severity from confidence score
    var confidence = pattern.confidence || 0;
    var severity = confidence >= 0.8 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';

    var recGr = new GlideRecord('x_ori_ai_recommendation');
    recGr.initialize();
    recGr.setValue('analysis_run', runSysId);
    recGr.setValue('pattern_name', pattern.pattern_name || '');
    recGr.setValue('dedup_key', this._computeDedupKey(pattern.pattern_name, pattern.primary_ci));
    recGr.setValue('pattern_summary', pattern.pattern_summary || '');
    recGr.setValue('root_cause_hypothesis', pattern.root_cause_hypothesis || '');
    recGr.setValue('recommendation_text', pattern.recommended_action || '');
    recGr.setValue('problem_statement', pattern.problem_statement || '');
    recGr.setValue('severity', severity);
    recGr.setValue('confidence_score', confidence);
    recGr.setValue('trend_direction', pattern.trend_direction || 'stable');
    recGr.setValue('primary_ci', pattern.primary_ci || '');
    recGr.setValue('linked_incidents', JSON.stringify(linked));
    recGr.setValue('state', 'pending');
    recGr.insert();
  },

  _computeDedupKey: function(patternName, primaryCi) {
    return (patternName || '') + '|' + (primaryCi || '');
  },

  _isDuplicate: function(dedupKey) {
    if (!dedupKey || dedupKey === '|') { return false; }
    var now = new GlideDateTime();
    var monthStart = new GlideDateTime();
    monthStart.setValue(now.getValue().substring(0, 7) + '-01 00:00:00');

    var gr = new GlideRecord('x_ori_ai_recommendation');
    gr.addQuery('dedup_key', dedupKey);
    gr.addQuery('state', '!=', 'rejected');
    gr.addQuery('sys_created_on', '>=', monthStart);
    gr.query();
    return gr.next();
  },

  _extractIncidentData: function(gr) {
    return {
      sys_id: gr.getUniqueValue(),
      number: gr.getValue('number') || '',
      short_description: gr.getValue('short_description') || '',
      description: gr.getValue('description') || '',
      close_notes: gr.getValue('close_notes') || '',
      priority: parseInt(gr.getValue('priority') || '4', 10),
      priority_display: gr.getDisplayValue('priority'),
      impact: parseInt(gr.getValue('impact') || '3', 10),
      impact_display: gr.getDisplayValue('impact'),
      urgency: parseInt(gr.getValue('urgency') || '3', 10),
      urgency_display: gr.getDisplayValue('urgency'),
      category: gr.getValue('category') || '',
      subcategory: gr.getValue('subcategory') || '',
      ci_name: gr.getDisplayValue('cmdb_ci') || '',
      assignment_group_name: gr.getDisplayValue('assignment_group') || '',
      major_incident_state: parseInt(gr.getValue('major_incident_state') || '0', 10),
      risk_score: 0
    };
  },

  _sanitizeIncident: function(inc) {
    return {
      number: inc.number,
      short_description: inc.short_description,
      description: inc.description,
      resolution_notes: inc.close_notes,
      priority: inc.priority_display,
      impact: inc.impact_display,
      urgency: inc.urgency_display,
      category: inc.category,
      subcategory: inc.subcategory,
      ci_name: inc.ci_name,
      assignment_group: inc.assignment_group_name,
      risk_score: inc.risk_score,
      is_major_incident: inc.major_incident_state === 1 || inc.major_incident_state === 3
    };
  },

  _applyNoiseQueryFilters: function(gr) {
    if (this._excludedCategories.length > 0) {
      gr.addQuery('category', 'NOT IN', this._excludedCategories.join(','));
    }
    if (this._excludedSubcategories.length > 0) {
      gr.addQuery('subcategory', 'NOT IN', this._excludedSubcategories.join(','));
    }
  },

  _isNoise: function(gr) {
    var desc = (gr.getValue('short_description') || '').toLowerCase();
    for (var i = 0; i < this._noiseKeywords.length; i++) {
      if (desc.indexOf(this._noiseKeywords[i]) !== -1) { return true; }
    }
    return false;
  },

  _setRunStatus: function(runSysId, status, errorMsg) {
    var gr = new GlideRecord('x_ori_analysis_run');
    if (gr.get(runSysId)) {
      gr.setValue('status', status);
      if (errorMsg) { gr.setValue('error_log', errorMsg); }
      gr.update();
    }
  },

  _splitProp: function(propName) {
    var value = gs.getProperty(propName, '');
    if (!value || value.trim() === '') { return []; }
    var parts = value.split(',');
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      var trimmed = parts[i].trim();
      if (trimmed !== '') { result.push(trimmed); }
    }
    return result;
  },

  type: 'ORIAnalysisEngine'
};
