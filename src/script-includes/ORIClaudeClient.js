var ORIClaudeClient = Class.create();

ORIClaudeClient.prototype = {
  initialize: function() {
    this.model = gs.getProperty('x_ori.claude_model', 'claude-opus-4-8');
    this.maxTokens = parseInt(gs.getProperty('x_ori.claude_max_tokens', '1024'), 10);
    this.confidenceThreshold = parseFloat(gs.getProperty('x_ori.min_confidence_threshold', '0.6'));
    this.apiKey = gs.getProperty('x_ori.claude_api_key', '');
  },

  analyzeCluster: function(clusterSysId) {
    var gr = new GlideRecord('x_ori_incident_cluster');
    if (!gr.get(clusterSysId)) {
      return { success: false, error: 'Cluster not found: ' + clusterSysId };
    }

    var clusterDataJson = gr.getValue('cluster_data');
    var clusterData;
    try {
      clusterData = JSON.parse(clusterDataJson);
    } catch (e) {
      return { success: false, error: 'cluster_data is not valid JSON: ' + e.message };
    }

    if (!clusterData.incidents || clusterData.incidents.length === 0) {
      return { success: true, result: { is_pattern: false, skipped_reason: 'no_incidents' } };
    }

    var prompt = this._buildPrompt(clusterData);
    var apiResponse = this._callAPI(prompt);
    if (!apiResponse.success) {
      return apiResponse;
    }

    return this._parseResponse(apiResponse.content);
  },

  _buildPrompt: function(clusterData) {
    var prompt = 'You are an ITSM Problem Management analyst.\n\n';
    prompt += 'Analyze the following group of incidents and determine whether they share\n';
    prompt += 'a recurring operational risk pattern that warrants a Problem record.\n\n';
    prompt += 'Cluster Context:\n';
    prompt += '- Configuration Item: ' + (clusterData.ci_name || 'N/A') + '\n';
    prompt += '- Assignment Group: ' + (clusterData.group_name || 'N/A') + '\n';
    prompt += '- Business Service: ' + (clusterData.service_name || 'N/A') + '\n';
    prompt += '- Category: ' + (clusterData.category || 'N/A') + '\n';
    prompt += '- Period: ' + clusterData.start_date + ' to ' + clusterData.end_date + '\n';
    prompt += '- Incident Count: ' + clusterData.incidents.length + '\n\n';
    prompt += 'Incidents:\n';

    for (var i = 0; i < clusterData.incidents.length; i++) {
      var incident = clusterData.incidents[i];
      var incidentNum = incident.number || '';
      var shortDesc = incident.short_description || '';
      var notes = incident.resolution_notes || 'No notes';
      var priority = incident.priority || 'Unknown';

      prompt += incidentNum + ' | ' + shortDesc + ' | ' + notes + ' | Priority: ' + priority + '\n';
    }

    prompt += '\nRespond ONLY in this JSON format:\n';
    prompt += '{\n';
    prompt += '  "is_pattern": true,\n';
    prompt += '  "confidence": 0.85,\n';
    prompt += '  "pattern_summary": "One sentence describing the pattern.",\n';
    prompt += '  "root_cause_hypothesis": "One paragraph on likely root cause.",\n';
    prompt += '  "recommendation": "Specific Problem Management action.",\n';
    prompt += '  "severity": "high",\n';
    prompt += '  "problem_statement": "Draft Problem short description under 160 characters."\n';
    prompt += '}\n\n';
    prompt += 'If no genuine recurring pattern exists, return {"is_pattern": false} only.';

    return prompt;
  },

  _callAPI: function(prompt) {
    if (!this.apiKey || this.apiKey === '') {
      return { success: false, error: 'x_ori.claude_api_key sys_property is empty' };
    }

    var request = new sn_ws.RESTMessageV2();
    request.setEndpoint('https://api.anthropic.com/v1/messages');
    request.setHttpMethod('POST');
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('anthropic-version', '2023-06-01');
    request.setRequestHeader('x-api-key', this.apiKey);

    var body = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    request.setRequestBody(JSON.stringify(body));

    var response;
    var attempt = 0;
    var maxAttempts = 2;

    while (attempt < maxAttempts) {
      try {
        response = request.execute();
      } catch (e) {
        return { success: false, error: 'REST call exception: ' + e.message };
      }

      var statusCode = response.getStatusCode();

      if (statusCode === 429) {
        if (attempt === 0) {
          gs.sleep(30000);
          attempt++;
          continue;
        } else {
          var errorBody429 = response.getBody();
          return { success: false, error: 'HTTP ' + statusCode + ': ' + errorBody429 };
        }
      }

      if (statusCode !== 200) {
        var errorBody = response.getBody();
        return { success: false, error: 'HTTP ' + statusCode + ': ' + errorBody };
      }

      var responseBody = response.getBody();
      var parsed;
      try {
        parsed = JSON.parse(responseBody);
      } catch (e) {
        return { success: false, error: 'Invalid API response JSON: ' + responseBody };
      }

      if (!parsed.content || parsed.content.length === 0 || !parsed.content[0].text) {
        return { success: false, error: 'No text content in API response: ' + responseBody };
      }

      var content = parsed.content[0].text;
      return { success: true, content: content };
    }

    return { success: false, error: 'Max retries exceeded' };
  },

  _parseResponse: function(content) {
    var cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    var parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return { success: false, error: 'Claude returned non-JSON: ' + content };
    }

    if (!parsed.is_pattern) {
      return { success: true, result: { is_pattern: false } };
    }

    var confidence = parsed.confidence || 0;
    if (confidence < this.confidenceThreshold) {
      return { success: true, result: { is_pattern: false, skipped_reason: 'confidence_below_threshold' } };
    }

    var requiredFields = ['pattern_summary', 'root_cause_hypothesis', 'recommendation', 'severity', 'problem_statement'];
    for (var i = 0; i < requiredFields.length; i++) {
      var fieldName = requiredFields[i];
      if (!parsed[fieldName]) {
        return { success: false, error: 'Claude response missing field: ' + fieldName };
      }
    }

    return { success: true, result: parsed };
  },

  type: 'ORIClaudeClient'
};
