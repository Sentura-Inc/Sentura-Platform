update screening_reports
set report_json = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        report_json,
        '{score_blocks}',
        coalesce((
          select jsonb_agg(item)
          from jsonb_array_elements(coalesce(report_json->'score_blocks', '[]'::jsonb)) as item
          where item::text not like '%conversation_behavior%'
            and item::text not like '%accio_behavior%'
            and coalesce(item->>'layer', '') <> 'behavior'
        ), '[]'::jsonb),
        true
      ),
      '{evidence}',
      coalesce((
        select jsonb_agg(item)
        from jsonb_array_elements(coalesce(report_json->'evidence', '[]'::jsonb)) as item
        where item::text not like '%conversation_behavior%'
          and item::text not like '%accio_behavior%'
          and coalesce(item->>'layer', '') <> 'behavior'
      ), '[]'::jsonb),
      true
    ),
    '{coverage_gaps}',
    coalesce((
      select jsonb_agg(item)
      from jsonb_array_elements(coalesce(report_json->'coverage_gaps', '[]'::jsonb)) as item
      where item::text not like '%conversation_behavior%'
        and item::text not like '%accio_behavior%'
        and coalesce(item->>'layer', '') <> 'behavior'
    ), '[]'::jsonb),
    true
  ),
  '{open_questions}',
  coalesce((
    select jsonb_agg(item)
    from jsonb_array_elements(coalesce(report_json->'open_questions', '[]'::jsonb)) as item
    where item::text not like '%conversation_behavior%'
      and item::text not like '%accio_behavior%'
      and item::text not like '%聊天记录%'
      and item::text not like '%销售对话%'
      and item::text not like '%行为记录%'
  ), '[]'::jsonb),
  true
)
where report_json::text like '%conversation_behavior%'
   or report_json::text like '%accio_behavior%'
   or report_json::text like '%聊天记录%'
   or report_json::text like '%销售对话%'
   or report_json::text like '%行为记录%';
