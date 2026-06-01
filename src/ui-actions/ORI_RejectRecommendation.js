// UI Action: ORI - Reject Recommendation
// Table:       x_ori_ai_recommendation
// Action name: ori_reject
// Form button: true
// Condition:   current.state == 'pending'
// Onclick:     (client script below)

// CLIENT SCRIPT - paste into "Onclick" field:
/*
var reason = prompt('Rejection reason (required):');
if (!reason || reason.trim() === '') {
    alert('A rejection reason is required.');
    return;
}
g_form.setValue('rejection_reason', reason);
gsftSubmit(null, g_form, 'ori_reject');
*/

// SERVER SCRIPT - Runs when action is submitted:
(function() {
    current.setValue('state', 'rejected');
    current.update();
    action.setRedirectURL(current);
})();
