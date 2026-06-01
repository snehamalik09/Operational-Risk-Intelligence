// Scheduled Job: ORI Monthly Analysis
// Application:   x_ori (Operational Risk Intelligence)
// Run:           Monthly
// Day:           1
// Time:          02:00:00
// Active:        true

var engine = new ORIAnalysisEngine();
engine.runMonthlyAnalysis();
