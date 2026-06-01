// UI Action: ORI - Approve Recommendation
// Table:       x_ori_ai_recommendation
// Action name: ori_approve
// Form button: true
// Condition:   current.state == 'pending'
// Onclick:     gsftSubmit(null, g_form, 'ori_approve')

(function() {
    current.setValue('state', 'approved');
    current.update();
    action.setRedirectURL(current);
})();
