var ORINoiseFilter = Class.create();

ORINoiseFilter.prototype = {
  initialize: function() {
    this.excludedCategories = this._splitProp('x_ori.excluded_categories');
    this.excludedSubcategories = this._splitProp('x_ori.excluded_subcategories');
    this.noiseKeywords = this._splitProp('x_ori.noise_keywords').map(function(keyword) {
      return keyword.toLowerCase();
    });
    this.excludedCount = 0;
    this.keywordExcludedCount = 0;
  },

  applyQueryFilters: function(gr) {
    if (this.excludedCategories && this.excludedCategories.length > 0) {
      gr.addQuery('category', 'NOT IN', this.excludedCategories.join(','));
    }
    if (this.excludedSubcategories && this.excludedSubcategories.length > 0) {
      gr.addQuery('subcategory', 'NOT IN', this.excludedSubcategories.join(','));
    }
  },

  isNoise: function(gr) {
    var description = gr.getValue('short_description');
    if (!description) {
      return false;
    }

    var lowerDescription = description.toLowerCase();
    for (var i = 0; i < this.noiseKeywords.length; i++) {
      if (lowerDescription.indexOf(this.noiseKeywords[i]) !== -1) {
        this.keywordExcludedCount++;
        this.excludedCount++;
        return true;
      }
    }

    return false;
  },

  getSummary: function() {
    return this.excludedCount + ' excluded (keyword filter): ' + this.keywordExcludedCount + ' matched noise keywords';
  },

  _splitProp: function(propName) {
    var value = gs.getProperty(propName, '');
    if (!value || value.trim() === '') {
      return [];
    }

    var parts = value.split(',');
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      var trimmed = parts[i].trim();
      if (trimmed !== '') {
        result.push(trimmed);
      }
    }
    return result;
  },

  type: 'ORINoiseFilter'
};
