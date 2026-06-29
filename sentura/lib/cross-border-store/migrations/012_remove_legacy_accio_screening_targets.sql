-- Remove legacy Accio/memory-derived Screening targets and reports.
-- Accio imports, summaries, transcripts, and memory facts are intentionally untouched.

create temporary table tmp_legacy_accio_screening_targets on commit drop as
select distinct st.id
from screening_targets st
where st.source = 'accio_memory'
   or exists (
     select 1
     from screening_reports sr
     where sr.screening_target_id = st.id
       and coalesce(sr.report_json->'target'->>'source', sr.report_json->>'target_source', '') = 'accio_memory'
   );

create temporary table tmp_legacy_accio_screening_reports on commit drop as
select distinct sr.id
from screening_reports sr
where sr.screening_target_id in (select id from tmp_legacy_accio_screening_targets)
   or coalesce(sr.report_json->'target'->>'source', sr.report_json->>'target_source', '') = 'accio_memory';

delete from screening_batch_targets
where screening_target_id in (select id from tmp_legacy_accio_screening_targets);

delete from screening_address_locations
where screening_report_id in (select id from tmp_legacy_accio_screening_reports)
   or screening_target_id in (select id from tmp_legacy_accio_screening_targets);

delete from screening_score_blocks
where screening_report_id in (select id from tmp_legacy_accio_screening_reports);

delete from screening_evidence
where screening_report_id in (select id from tmp_legacy_accio_screening_reports);

delete from screening_reports
where id in (select id from tmp_legacy_accio_screening_reports);

delete from screening_targets
where id in (select id from tmp_legacy_accio_screening_targets);
