var ORIClaudeClient = Class.create();

ORIClaudeClient.prototype = {
  initialize: function() {
    this.model = gs.getProperty('x_ori.claude_model', 'claude-opus-4-8');
    this.maxTokens = parseInt(gs.getProperty('x_ori.claude_max_tokens', '4096'), 10);
    this.confidenceThreshold = parseFloat(gs.getProperty('x_ori.min_confidence_threshold', '0.6'));
    this.apiKey = gs.getProperty('x_ori.claude_api_key', '');
  },

  // sanitizedIncidents: array of plain objects (already sanitized by ORIAnalysisEngine)
  // context: { period_start, period_end, total_incidents }
  analyzePool: function(sanitizedIncidents, context) {
    if (!this.apiKey) {
      return { success: false, error: 'x_ori.claude_api_key sys_property is empty' };
    }
    if (!sanitizedIncidents || sanitizedIncidents.length === 0) {
      return { success: true, patterns: [] };
    }

    var systemPrompt = this._buildSystemPrompt();
    var userMessage = JSON.stringify({
      analysis_context: context,
      incidents: sanitizedIncidents
    });

    var apiResponse = this._callAPI(systemPrompt, userMessage);
    if (!apiResponse.success) { return apiResponse; }

    return this._parsePatterns(apiResponse.content);
  },

  _buildSystemPrompt: function() {
    return 'You are an ITSM Problem Management analyst. Your task is to identify recurring operational risk patterns in the incident data provided.\n\n' +
      'Group incidents that share a common root cause, even if they involve different configuration items, categories, or assignment groups.\n\n' +
      'Do not group incidents based on structural similarity alone. Group them based on semantic similarity — shared failure modes, root causes, or operational risk themes.\n\n' +
      'For each pattern, identify the primary configuration item most central to the issue. If the pattern spans multiple CIs, identify the CI that appears most frequently or is most likely the root cause.\n\n' +
      'Return only patterns with genuine recurring risk that warrant a Problem record. A pattern must involve at least 2 incidents.\n\n' +
      'If you identify no meaningful patterns, return {"patterns": []}.\n\n' +
      'Respond ONLY in this JSON format:\n' +
      '{\n' +
      '  "patterns": [\n' +
      '    {\n' +
      '      "pattern_name": "Concise name for this recurring risk",\n' +
      '      "pattern_summary": "One sentence describing the pattern.",\n' +
      '      "root_cause_hypothesis": "One paragraph on likely root cause.",\n' +
      '      "confidence": 0.0,\n' +
      '      "trend_direction": "increasing|stable|decreasing",\n' +
      '      "affected_incidents": ["INC0001234", "INC0001256"],\n' +
      '      "recommended_action": "Specific Problem Management action.",\n' +
      '      "problem_statement": "Draft Problem short description (<=160 chars).",\n' +
      '      "primary_ci": "Display name of the primary CI involved"\n' +
      '    }\n' +
      '  ]\n' +
      '}';
  },

  _callAPI: function(systemPrompt, userMessage) {
    var rm = new sn_ws.RESTMessageV2();
    rm.setEndpoint('https://api.anthropic.com/v1/messages');
    rm.setHttpMethod('POST');
    rm.setRequestHeader('Content-Type', 'application/json');
    rm.setRequestHeader('anthropic-version', '2023-06-01');
    rm.setRequestHeader('x-api-key', this.apiKey);
    rm.setRequestBody(JSON.stringify({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    }));

    var response;
    try {
      response = rm.execute();
    } catch (e) {
      return { success: false, error: 'REST call exception: ' + e.message };
    }

    var statusCode = response.getStatusCode();
    var body = response.getBody();

    if (statusCode === 429) {
      gs.sleep(30000);
      try {
        response = rm.execute();
        statusCode = response.getStatusCode();
        body = response.getBody();
      } catch (e) {
        return { success: false, error: 'Retry after 429 failed: ' + e.message };
      }
    }

    if (statusCode !== 200) {
      return { success: false, error: 'HTTP ' + statusCode + ': ' + body };
    }

    var parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      return { success: false, error: 'Invalid API response JSON: ' + body };
    }

    var content = parsed.content && parsed.content[0] && parsed.content[0].text;
    if (!content) {
      return { success: false, error: 'No text content in API response: ' + body };
    }

    return { success: true, content: content };
  },

  _parsePatterns: function(content) {
    var jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    var parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return { success: false, error: 'Claude returned non-JSON: ' + content };
    }

    var rawPatterns = parsed.patterns || [];
    var threshold = this.confidenceThreshold;
    var requiredFields = ['pattern_name', 'pattern_summary', 'root_cause_hypothesis',
      'recommended_action', 'problem_statement', 'primary_ci', 'affected_incidents'];

    var validPatterns = [];
    for (var i = 0; i < rawPatterns.length; i++) {
      var p = rawPatterns[i];

      if ((p.confidence || 0) < threshold) { continue; }
      if (!Array.isArray(p.affected_incidents) || p.affected_incidents.length < 2) { continue; }

      var valid = true;
      for (var j = 0; j < requiredFields.length; j++) {
        if (!p[requiredFields[j]]) { valid = false; break; }
      }
      if (!valid) { continue; }

      validPatterns.push(p);
    }

    return { success: true, patterns: validPatterns };
  },

  type: 'ORIClaudeClient'
};
