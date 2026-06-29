update screening_reports
set report_json = replace(
  replace(
    replace(
      replace(
        report_json::text,
        '聊天记录',
        '额外资料'
      ),
      '销售对话',
      '额外资料'
    ),
    '行为记录',
    '额外资料'
  ),
  'Accio',
  '记忆整理'
)::jsonb
where report_json::text like '%聊天记录%'
   or report_json::text like '%销售对话%'
   or report_json::text like '%行为记录%'
   or report_json::text like '%Accio%';
