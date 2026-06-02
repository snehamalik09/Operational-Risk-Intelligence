var ORIAnalysisEngine = Class.create();

ORIAnalysisEngine.prototype = {
  initialize: function() {},

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
    var clusterBuilder = new ORIClusterBuilder();
    var clusterSysIds = clusterBuilder.buildClusters(runSysId);

    var totalIncidents = 0;
    for (var i = 0; i < clusterSysIds.length; i++) {
      var clGr = new GlideRecord('x_ori_incident_cluster');
      if (clGr.get(clusterSysIds[i])) {
        totalIncidents += parseInt(clGr.getValue('incident_count') || '0', 10);
      }
    }

    var runGr = new GlideRecord('x_ori_analysis_run');
    runGr.get(runSysId);
    runGr.setValue('incidents_excluded', clusterBuilder.noiseExcludedCount);
    runGr.setValue('noise_filter_summary', clusterBuilder.getNoiseFilterSummary());
    runGr.setValue('incidents_analyzed', totalIncidents);
    runGr.update();

    var claudeClient = new ORIClaudeClient();
    var recCount = 0;
    var errors = [];

    for (var j = 0; j < clusterSysIds.length; j++) {
      var clusterSysId = clusterSysIds[j];
      try {
        var result = claudeClient.analyzeCluster(clusterSysId);
        if (!result.success) {
          this._setClusterStatus(clusterSysId, 'failed');
          errors.push('Cluster ' + clusterSysId + ': ' + result.error);
          continue;
        }
        if (!result.result.is_pattern) {
          this._setClusterStatus(clusterSysId, 'skipped');
          continue;
        }
        this._createRecommendation(clusterSysId, runSysId, result.result);
        this._setClusterStatus(clusterSysId, 'analyzed');
        recCount++;
      } catch (e) {
        this._setClusterStatus(clusterSysId, 'failed');
        errors.push('Cluster ' + clusterSysId + ' exception: ' + e.message);
      }
    }

    var finalStatus = errors.length === 0 ? 'completed' : 'completed_with_errors';

    runGr = new GlideRecord('x_ori_analysis_run');
    runGr.get(runSysId);
    runGr.setValue('clusters_found', clusterSysIds.length);
    runGr.setValue('recommendations_generated', recCount);
    runGr.setValue('status', finalStatus);
    if (errors.length > 0) {
      runGr.setValue('error_log', errors.join('\n'));
    }
    runGr.update();

    gs.eventQueue('x_ori.analysis.complete', runGr, runSysId, '');
  },

  _createRecommendation: function(clusterSysId, runSysId, aiResult) {
    var recGr = new GlideRecord('x_ori_ai_recommendation');
    recGr.initialize();
    recGr.setValue('analysis_run', runSysId);
    recGr.setValue('cluster', clusterSysId);
    recGr.setValue('pattern_summary', aiResult.pattern_summary || '');
    recGr.setValue('root_cause_hypothesis', aiResult.root_cause_hypothesis || '');
    recGr.setValue('recommendation_text', aiResult.recommendation || '');
    recGr.setValue('problem_statement', aiResult.problem_statement || '');
    recGr.setValue('severity', aiResult.severity || '');
    recGr.setValue('confidence_score', aiResult.confidence || 0);
    recGr.setValue('state', 'pending');
    var recSysId = recGr.insert();

    var clusterGr = new GlideRecord('x_ori_incident_cluster');
    if (clusterGr.get(clusterSysId)) {
      var clusterDataJson = clusterGr.getValue('cluster_data');
      if (clusterDataJson) {
        var clusterData;
        try {
          clusterData = JSON.parse(clusterDataJson);
        } catch (e) {
          clusterData = null;
        }
        if (clusterData && clusterData.incidents) {
          for (var i = 0; i < clusterData.incidents.length; i++) {
            var incidentSysId = clusterData.incidents[i].sys_id;
            if (!incidentSysId) {
              continue;
            }
            var riGr = new GlideRecord('x_ori_recommendation_incident');
            riGr.initialize();
            riGr.setValue('recommendation', recSysId);
            riGr.setValue('incident', incidentSysId);
            riGr.insert();
          }
        }
      }
    }

    return recSysId;
  },

  _setClusterStatus: function(clusterSysId, status) {
    var clusterGr = new GlideRecord('x_ori_incident_cluster');
    if (clusterGr.get(clusterSysId)) {
      clusterGr.setValue('status', status);
      clusterGr.update();
    }
  },

  _setRunStatus: function(runSysId, status, errorMsg) {
    var runGr = new GlideRecord('x_ori_analysis_run');
    if (runGr.get(runSysId)) {
      runGr.setValue('status', status);
      if (errorMsg) {
        runGr.setValue('error_log', errorMsg);
      }
      runGr.update();
    }
  },

  type: 'ORIAnalysisEngine'
};
