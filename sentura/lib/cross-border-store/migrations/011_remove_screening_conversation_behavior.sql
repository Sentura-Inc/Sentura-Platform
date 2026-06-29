-- Remove legacy chat/conversation behavior artifacts from Screening reports.
-- Accio / memory-organization records are intentionally untouched.

delete from screening_score_blocks
where block = 'conversation_behavior';

delete from screening_evidence
where score_block = 'conversation_behavior'
   or layer in ('behavior', 'accio_behavior');

update screening_reports sr
set report_json = jsonb_set(
  jsonb_set(
    jsonb_set(
      sr.report_json,
      '{score_blocks}',
      (
        select coalesce(jsonb_agg(item), '[]'::jsonb)
        from jsonb_array_elements(
          case
            when jsonb_typeof(sr.report_json->'score_blocks') = 'array' then sr.report_json->'score_blocks'
            else '[]'::jsonb
          end
        ) item
        where coalesce(item->>'block', item->>'score_block', '') <> 'conversation_behavior'
      ),
      true
    ),
    '{evidence}',
    (
      select coalesce(jsonb_agg(item), '[]'::jsonb)
      from jsonb_array_elements(
        case
          when jsonb_typeof(sr.report_json->'evidence') = 'array' then sr.report_json->'evidence'
          else '[]'::jsonb
        end
      ) item
      where coalesce(item->>'score_block', item->>'scoreBlock', '') <> 'conversation_behavior'
        and coalesce(item->>'layer', '') not in ('behavior', 'accio_behavior')
    ),
    true
  ),
  '{coverage_gaps}',
  (
    select coalesce(jsonb_agg(item), '[]'::jsonb)
    from jsonb_array_elements(
      case
        when jsonb_typeof(sr.report_json->'coverage_gaps') = 'array' then sr.report_json->'coverage_gaps'
        else '[]'::jsonb
      end
    ) item
    where coalesce(item->>'block', item->>'score_block', item->>'scoreBlock', '') <> 'conversation_behavior'
  ),
  true
)
where jsonb_typeof(sr.report_json->'score_blocks') = 'array'
   or jsonb_typeof(sr.report_json->'evidence') = 'array'
   or jsonb_typeof(sr.report_json->'coverage_gaps') = 'array';
