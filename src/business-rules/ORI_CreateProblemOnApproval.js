// Business Rule: ORI - Create Problem on Approval
// Table:  x_ori_ai_recommendation
// When:   after
// Update: true
// Condition: current.state.changesTo('approved')

(function executeRule(current, previous) {
    if (current.state.changesTo('approved')) {
        var creator = new ORIProblemCreator();
        creator.createProblem(current.getUniqueValue());
    }
})(current, previous);
