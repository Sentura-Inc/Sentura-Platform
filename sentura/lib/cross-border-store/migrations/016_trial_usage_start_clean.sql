delete from cbe_trial_usage_events
where metadata_json->>'backfilled_from' in ('lead_run_results', 'screening_reports');
