var ORIClusterBuilder = Class.create();

ORIClusterBuilder.prototype = {
  initialize: function() {
    this.minIncidents = parseInt(gs.getProperty('x_ori.min_incidents_per_cluster', '3'), 10);
    this.lookbackDays = parseInt(gs.getProperty('x_ori.lookback_days', '30'), 10);
    this.noiseFilter = new ORINoiseFilter();
  },

  buildClusters: function(analysisRunSysId) {
    var startDate = new GlideDateTime();
    startDate.addDaysLocalTime(-this.lookbackDays);

    var ciClusters = this._buildCIClusters(startDate, analysisRunSysId);
    var serviceClusters = this._buildServiceClusters(startDate, analysisRunSysId);

    var result = [];
    for (var i = 0; i < ciClusters.length; i++) {
      result.push(ciClusters[i]);
    }
    for (var j = 0; j < serviceClusters.length; j++) {
      result.push(serviceClusters[j]);
    }

    return result;
  },

  _buildCIClusters: function(startDate, analysisRunSysId) {
    var ga = new GlideAggregate('incident');
    ga.addQuery('state', 'IN', '6,7');
    ga.addQuery('opened_at', '>=', startDate);
    ga.addQuery('cmdb_ci', '!=', '');

    this.noiseFilter.applyQueryFilters(ga);

    ga.groupBy('cmdb_ci');
    ga.groupBy('category');
    ga.groupBy('assignment_group');
    ga.addAggregate('COUNT', 'sys_id');
    ga.addHaving('COUNT', '>=', this.minIncidents);

    var result = [];
    ga.query();
    while (ga.next()) {
      var ciSysId = ga.getValue('cmdb_ci');
      var category = ga.getValue('category');
      var assignmentGroupSysId = ga.getValue('assignment_group');
      var count = parseInt(ga.getAggregate('COUNT', 'sys_id') || '0', 10);

      var data = {
        analysis_run: analysisRunSysId,
        ci: ciSysId,
        category: category,
        assignment_group: assignmentGroupSysId,
        incident_count: count
      };

      var clusterId = this._persistCluster(data, startDate);
      if (clusterId) {
        result.push(clusterId);
      }
    }

    return result;
  },

  _buildServiceClusters: function(startDate, analysisRunSysId) {
    var ga = new GlideAggregate('incident');
    ga.addQuery('state', 'IN', '6,7');
    ga.addQuery('opened_at', '>=', startDate);
    ga.addQuery('business_service', '!=', '');

    this.noiseFilter.applyQueryFilters(ga);

    ga.groupBy('business_service');
    ga.groupBy('category');
    ga.addAggregate('COUNT', 'sys_id');
    ga.addHaving('COUNT', '>=', this.minIncidents);

    var result = [];
    ga.query();
    while (ga.next()) {
      var businessServiceSysId = ga.getValue('business_service');
      var category = ga.getValue('category');
      var count = parseInt(ga.getAggregate('COUNT', 'sys_id') || '0', 10);

      var data = {
        analysis_run: analysisRunSysId,
        business_service: businessServiceSysId,
        category: category,
        incident_count: count
      };

      var clusterId = this._persistCluster(data, startDate);
      if (clusterId) {
        result.push(clusterId);
      }
    }

    return result;
  },

  _persistCluster: function(data, startDate) {
    var ci = data.ci || '';
    var businessService = data.business_service || '';
    var category = data.category || '';
    var assignmentGroup = data.assignment_group || '';

    var clusterKeyInput = ci + '|' + businessService + '|' + category + '|' + assignmentGroup;
    var clusterKey = this._hash(clusterKeyInput);

    // Check if cluster already created this calendar month
    var now = new GlideDateTime();
    var monthStart = new GlideDateTime();
    monthStart.setValue(now.getValue().substring(0, 7) + '-01 00:00:00');

    var checkGr = new GlideRecord('x_ori_incident_cluster');
    checkGr.addQuery('cluster_key', clusterKey);
    checkGr.addQuery('sys_created_on', '>=', monthStart);
    checkGr.query();

    if (checkGr.next()) {
      return null;
    }

    var incidentData = this._fetchIncidentData(data, startDate);

    var gr = new GlideRecord('x_ori_incident_cluster');
    gr.initialize();
    gr.setValue('analysis_run', data.analysis_run);
    gr.setValue('cluster_key', clusterKey);
    if (data.ci) {
      gr.setValue('ci', data.ci);
    }
    if (data.assignment_group) {
      gr.setValue('assignment_group', data.assignment_group);
    }
    if (data.business_service) {
      gr.setValue('business_service', data.business_service);
    }
    if (data.category) {
      gr.setValue('category', data.category);
    }
    gr.setValue('incident_count', data.incident_count);
    gr.setValue('cluster_data', JSON.stringify(incidentData));
    gr.setValue('status', 'pending');

    return gr.insert();
  },

  _fetchIncidentData: function(data, startDate) {
    var gr = new GlideRecord('incident');
    gr.addQuery('state', 'IN', '6,7');
    gr.addQuery('opened_at', '>=', startDate);

    if (data.ci) {
      gr.addQuery('cmdb_ci', data.ci);
    }
    if (data.business_service) {
      gr.addQuery('business_service', data.business_service);
    }
    if (data.category) {
      gr.addQuery('category', data.category);
    }
    if (data.assignment_group) {
      gr.addQuery('assignment_group', data.assignment_group);
    }

    this.noiseFilter.applyQueryFilters(gr);

    var incidents = [];
    gr.query();
    while (gr.next()) {
      if (this.noiseFilter.isNoise(gr)) {
        continue;
      }

      var incident = {
        sys_id: gr.getValue('sys_id'),
        number: gr.getValue('number'),
        short_description: gr.getValue('short_description'),
        resolution_notes: gr.getValue('close_notes'),
        priority: gr.getDisplayValue('priority'),
        category: gr.getValue('category'),
        subcategory: gr.getValue('subcategory')
      };
      incidents.push(incident);
    }

    var ciName = this._lookupName('cmdb_ci', data.ci || '', 'name');
    var groupName = this._lookupName('sys_user_group', data.assignment_group || '', 'name');
    var serviceName = this._lookupName('cmdb_business_service', data.business_service || '', 'name');

    var result = {
      ci_name: ciName,
      group_name: groupName,
      service_name: serviceName,
      category: data.category || '',
      start_date: startDate.getDisplayValue(),
      end_date: new GlideDateTime().getDisplayValue(),
      incidents: incidents
    };

    return result;
  },

  _lookupName: function(table, sysId, field) {
    if (!sysId || sysId === '') {
      return '';
    }

    var gr = new GlideRecord(table);
    if (gr.get(sysId)) {
      return gr.getValue(field) || sysId;
    }

    return '';
  },

  _hash: function(str) {
    var digest = new GlideDigest();
    return digest.getMD5Base64(str);
  },

  type: 'ORIClusterBuilder'
};
