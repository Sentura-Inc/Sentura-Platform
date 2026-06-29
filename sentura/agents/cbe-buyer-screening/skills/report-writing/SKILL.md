# Report Writing

## When to Use

Use at the end of every Screening run.

## Procedure

1. Produce a short Chinese executive summary:
   - risk tier,
   - normalized score,
   - evidence coverage,
   - recommended sales next action.
2. Produce one JSON `ScreeningReport` per target:
   - `report_id`
   - `lead_id`
   - `target_source`
   - `company_name`
   - `company_scale_assessment`
   - `risk_tier`
   - `normalized_score`
   - `evidence_coverage`
   - `recommended_action`
   - `score_blocks`
   - `evidence`
   - `address_footprint`
   - `open_questions`
   - `missing_or_unavailable_evidence`
   - `created_at`
   In Phase 2 production child runs, this normally means exactly one object in the marker array.
3. Evidence items must include:
   - `layer`
   - `source_type`
   - `source`
   - `url`
   - `finding`
   - `confidence`
   - `fetched_at`
   - `cost_usd`
   - `score_block`
   - `score_impact`
4. All report-facing text must be natural Simplified Chinese for non-technical sales users:
   - This applies to `finding`, `score_blocks.summary`, `score_blocks.reason`, `company_scale_assessment.rationale`, `recommended_action`, `open_questions`, `coverage_gaps.reason`, and `coverage_gaps.action`.
   - Keep only company names, source names, URLs/domains, emails, registry numbers, case numbers, and unavoidable legal/product terms in their original language.
   - Do not expose machine/tool/schema wording such as API, JSON, payload, endpoint, provider, field_mask, RDAP, DNS, MX, SPF, DMARC, business_status, relationship_status, source_type, query, score_block, or raw enum values in customer-facing prose. Translate them into normal language.
   - Bad: `RDAP shows domain active; MX/SPF/DMARC present; business_status OPERATIONAL; query no result`.
   - Good: `公开域名记录显示该官网仍正常使用，邮箱域名已配置收信和防冒用记录；Google Maps 显示该门店目前营业中。本次按公司名称检索公开案件来源，未发现与目标主体精确匹配的重大案件。`
5. Evidence `finding` text must be useful without opening the link:
   - Official registry evidence: say in Chinese which official register was checked, what company name/registration number/status/address was found, and whether it matches the target.
   - Domain/email evidence: say in Chinese which website/email domain was checked, when the domain appears to have been registered or whether it is active, whether the email domain can receive mail, whether anti-spoofing records are configured, and whether the domain/email matches the company.
   - Official website/contact evidence: say in Chinese which page was checked, what company/address/contact/product facts were found, and whether it appears to be the company's own website.
   - Google Maps evidence: say in Chinese whether the public listing is operating, what name/address/category/website/phone was found, and why the address is confirmed, probable, possible, or rejected.
   - Legal dispute evidence: say in Chinese which country/source was searched, what search keywords were used, whether the result matches the same company, what court/regulator/notice/case/date/status was found when public, and whether it is a material seller risk, a possible name collision, a no-hit, or low coverage.
   - Trade/financial evidence: say in Chinese whether the source is not applicable, unavailable, no-hit, or shows concrete shipment/filing facts such as product, counterparty, and date.
   - Do not write generic findings such as "核验通过", "信息较完整", or "仍需进一步验证" unless the sentence also states the concrete field values behind that conclusion.
6. Confidence rules:
   - `official_api` or `official_registry_page` for Companies House, SEC, state registry, or equivalent official registry source with matching company/country/status: 0.95-1.0. A public Companies House profile page is primary evidence, not low-confidence web evidence.
   - Company-owned official website/contact/about page that matches name/domain/country: 0.75-0.9.
   - RDAP/DNS/email evidence that matches the claimed domain/company: 0.75-0.9.
   - Google Maps confirmed/probable operational physical location: 0.65-0.85. It can support small local/offline existence, but not formal legal ownership.
   - Official court docket, judgment, insolvency/bankruptcy notice, or regulator page exact-matching the target: 0.9-1.0. Public legal databases with exact party/source linkage: 0.6-0.8. Generic snippets, media, forums, or uncorroborated complaint pages stay below 0.6 and cannot alone support a high-risk legal conclusion.
   - Generic public web, directory, social, marketplace, or uncorroborated search snippets should stay below primary-source confidence unless corroborated.
   - Missing API, missing paid source, no hit, or not-applicable source has no positive confidence; record it as source status or a coverage limitation.
7. Score blocks and coverage gaps must be reconciled before final output:
   - If a block is `scored`, do not also list that block in `coverage_gaps` unless there is an explicit contradiction, mismatch, fraud/scam risk, or material ambiguity.
   - If a block is `not_applicable`, do not list it in `coverage_gaps`; mention it only in block reason or optional limitations.
   - For small private/local buyers, missing trade/customs, SEC, or financial filings are normally `not_applicable` or `optional` unless the target claims importer/distributor/public-company scale.
   - `coverage_gaps` are for unresolved, human-actionable work. Each item should include `block`, `status`, `reason`, `action`, and `severity` (`blocking`, `recommended`, or `optional`).
   - Bad gap example: "域名信息不完整，建议补充域名" when RDAP/DNS/domain evidence was already scored. Good gap example: "provided email uses gmail.com and no official domain was supplied; ask operator for official website or business email."
8. For Google Maps evidence:
   - use layer `google_maps_local_presence` or `address_validation`;
   - use source types `google_maps_places`, `google_maps_geocoding`, or `google_maps_address_validation`;
   - keep `google_place_id` and `google_maps_uri` in structured fields when available, but do not put endpoint, field mask profile, provider status, or other tool metadata inside customer-facing `finding`/summary text;
   - do not include raw review text, photos, raw Google responses, or API keys.
9. For legal-dispute evidence:
   - use layer `legal_disputes`;
   - use source types `official_court_search`, `official_case_law`, `official_insolvency_notice`, `regulatory_enforcement`, `public_legal_database`, or `public_web`;
   - preserve the searched country, search keywords, court/regulator/source name, case/notice number when public, parties, date/status/outcome, and target-match rationale, but phrase all of it in natural Chinese;
   - phrase no-hit results as `本次公开来源未发现目标主体的重大法律纠纷` and include the searched source scope.
10. Add a dedicated `address_footprint` object for the `Google Maps 地址版图` report section:
   - `section_title`: always `Google Maps 地址版图`.
   - `coverage_status`: `found`, `partial`, `not_found`, `unavailable_api`, or `not_checked`.
   - `search_scope`: include `queries_run`, `countries`, `capped`, and `limitations`.
   - `summary`: include total, confirmed/probable/possible, operational/closed, country, and city counts.
   - `locations`: one row per discovered Google Maps place kept after dedupe. Each row includes `google_place_id`, `display_name`, `address_type`, `relationship_status`, `formatted_address`, `city`, `region`, `country`, `business_status`, `types`, `website_uri`, `domain_match`, `phone_match`, `address_validation`, `google_maps_uri`, `match_confidence`, `match_reasons`, `source_type`, and `fetched_at`.
   - `open_questions`: include coverage limitations such as capped search, ambiguous franchise/brand matches, missing store locator, or API unavailability.
   - Do not merge this object into generic evidence cards; the Dashboard renders it as a standalone section before evidence details.
11. Add `company_scale_assessment`:
   - `scale_class`: `listed_or_public`, `medium_large_registered`, `small_local_offline`, `small_online_only`, or `unknown_scale`.
   - `confidence`: 0-1.
   - `rationale`: concise Chinese explanation of why this scale class was chosen.
   - `first_block_strategy`: `registry_disclosure_primary_maps_support`, `maps_physical_address_primary`, `domain_public_source_primary`, or `try_registry_and_maps`.
12. Address-footprint evidence may support `public_footprint`, `domain_email`, `business_fit`, and the first `legal_identity` / `公司注册与线下门店/地址` block for `small_local_offline` companies with an `OPERATIONAL` matched physical address and no contradictory evidence. For listed/public or medium-large companies, address-footprint evidence must be fused with registry/disclosure evidence and must not replace formal KYB/trade/financial evidence.
13. When Maps satisfies the first block for a small local/offline company, phrase it as `线下经营真实性由 Google Maps 公开门店/地址证据支持`; do not write `官方注册已验证`.
14. If coverage is low, say "证据不足，建议补充..." rather than "客户很差".
15. Mask personal emails in customer-facing summaries unless the operator explicitly requests the internal full report.

## Safety

Reports may be exported as JSON/Markdown. They must not send outreach or write external systems.
