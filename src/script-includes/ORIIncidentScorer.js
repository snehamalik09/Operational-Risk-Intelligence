var ORIIncidentScorer = Class.create();

ORIIncidentScorer.prototype = {
  initialize: function() {
    this.operationalCategories = this._splitProp('x_ori.operational_categories');
    this.categoryBonus = parseInt(gs.getProperty('x_ori.category_score_bonus', '15'), 10);
    this.keywordBonus = parseInt(gs.getProperty('x_ori.keyword_score_bonus', '10'), 10);
    this.riskKeywords = this._splitProp('x_ori.risk_keywords').map(function(k) {
      return k.toLowerCase();
    });
  },

  // incidentObj is a plain object produced by ORIAnalysisEngine._extractIncidentData
  calculateScore: function(incidentObj) {
    var score = 0;

    // Priority: 1=Critical, 2=High, 3=Moderate, 4=Low
    var priority = parseInt(incidentObj.priority || 4, 10);
    if (priority === 1) { score += 30; }
    else if (priority === 2) { score += 20; }
    else if (priority === 3) { score += 10; }

    // Impact: 1=High, 2=Medium, 3=Low
    var impact = parseInt(incidentObj.impact || 3, 10);
    if (impact === 1) { score += 20; }
    else if (impact === 2) { score += 10; }

    // Urgency: 1=High, 2=Medium, 3=Low
    var urgency = parseInt(incidentObj.urgency || 3, 10);
    if (urgency === 1) { score += 20; }
    else if (urgency === 2) { score += 10; }

    // Major Incident: state 1=Candidate, 3=Accepted
    var majorState = parseInt(incidentObj.major_incident_state || 0, 10);
    if (majorState === 1 || majorState === 3) { score += 50; }

    // Category bonus for operational categories
    var category = (incidentObj.category || '').toLowerCase();
    for (var i = 0; i < this.operationalCategories.length; i++) {
      if (category.indexOf(this.operationalCategories[i].toLowerCase()) !== -1) {
        score += this.categoryBonus;
        break;
      }
    }

    // Keyword bonus — each matching risk keyword adds points
    var text = ((incidentObj.short_description || '') + ' ' + (incidentObj.description || '')).toLowerCase();
    for (var j = 0; j < this.riskKeywords.length; j++) {
      if (text.indexOf(this.riskKeywords[j]) !== -1) {
        score += this.keywordBonus;
      }
    }

    return score;
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

  type: 'ORIIncidentScorer'
};
