# Legal Dispute Check

## When to Use

Use for every Screening target after registry/domain/public-footprint checks and before final scoring. This skill checks whether public sources show lawsuits, court cases, insolvency, bankruptcy, regulatory enforcement, or other material legal disputes that would affect a seller's decision to extend credit, ship goods, or invest sales resources.

## Procedure

1. Normalize search identity before searching:
   - legal/company name, trading name, domain, country, city/region, registry number, and known address;
   - remove generic suffixes only after keeping the full legal-name query;
   - keep every query string in evidence or coverage notes.
2. Pick country sources first, then run general web search:
   - GB: Companies House profile/filings for insolvency or charges, The Gazette insolvency notices, The National Archives Find Case Law, and BAILII as a public legal database.
   - US: PACER for official federal dockets when access is available, CourtListener/RECAP as a free public docket copy source, SEC litigation releases/enforcement pages for public or regulated companies, bankruptcy court/federal court search where available, and state court portals when state is known.
   - FR: Cour de cassation Judilibre/case-law search, BODACC legal/insolvency notices, Pappers Justice only as public aggregation when official source is not directly usable.
   - DE: Insolvenzbekanntmachungen for insolvency notices, Rechtsprechung im Internet and state/federal court decision portals for judgments, Unternehmensregister/Bundesanzeiger for public company announcements where applicable.
   - ES: CENDOJ/Poder Judicial jurisprudence search and Registro Publico Concursal or BOE-linked insolvency notices.
   - IT: Portale dei Servizi Telematici / Ministero della Giustizia public services, Registro Imprese / procedure concorsuali where accessible, and official court/ministry pages before public aggregators.
   - BR: CNJ DataJud public API or tribunal consulta-processual portals where party-name search is supported, official state/federal court portals, and terms `recuperacao judicial`, `falencia`, `processo`, `acao`, `execucao`; Jusbrasil is public aggregation only.
   - MX: IFECOM/concurso mercantil sources, federal/state Poder Judicial portals, boletines/listas de acuerdos where available, and terms `demanda`, `juicio`, `expediente`, `amparo`, `concurso mercantil`; coverage is fragmented by state.
   - JP: Courts in Japan judgment database and official court pages; party-name coverage is limited, so pair with web search terms `訴訟`, `裁判`, `破産`, `倒産`, `民事再生`.
   - KR: Korean court public case access where available, DART material litigation/disclosure for listed companies, insolvency/rehabilitation court notices where public, and Korean terms `소송`, `판결`, `회생`, `파산`.
3. Build bounded web searches:
   - `"<company legal name>" lawsuit OR litigation OR court OR case`
   - `"<company legal name>" bankruptcy OR insolvency OR liquidation OR administration`
   - `"<company legal name>" fraud OR enforcement OR regulatory action`
   - country-language equivalents from the source matrix.
4. Classify each result:
   - `confirmed_material_dispute`: official docket/judgment/insolvency/regulatory source exact-matches the target company, registry number, domain, or address.
   - `probable_material_dispute`: reputable legal database or multiple public sources strongly match the target but one identity field is missing.
   - `possible_name_collision`: result names a similar company but location/domain/registry fields do not prove it is the target.
   - `no_material_public_hit`: searched applicable public sources and found no target-specific material dispute.
   - `not_checked_or_low_coverage`: source unavailable, paywalled, blocked, country portal lacks party-name search, or target identity is too weak.
5. Write evidence items under `layer="legal_disputes"` and `score_block="legal_disputes"`.
   - Use `source_type="official_court_search"` for official docket/court-search pages.
   - Use `source_type="official_case_law"` for official judgment or case-law databases.
   - Use `source_type="official_insolvency_notice"` for official insolvency, bankruptcy, liquidation, administration, or concurso/recuperacao notices.
   - Use `source_type="regulatory_enforcement"` for regulator litigation, enforcement, sanction, or penalty pages.
   - Use `source_type="public_legal_database"` for public legal databases or aggregators such as CourtListener/RECAP, BAILII, Pappers Justice, Jusbrasil, or similar.
6. Decision-ready finding text must include:
   - country or jurisdiction and source searched;
   - search keywords used;
   - court, tribunal, registry, regulator, or notice source;
   - case number/docket/notice id when public;
   - parties and how they match the target;
   - date/status/outcome/proceeding type;
   - whether it is a material seller risk or only a name-collision/coverage note.
   Write this as normal Simplified Chinese for a non-technical sales user. Do not expose raw labels such as `jurisdiction`, `query`, `docket`, `source_type`, or enum values in the customer-facing finding.

## Confidence And Scoring

- Official court docket, judgment, insolvency notice, bankruptcy record, or regulator page exact-matching the target: confidence 0.9-1.0.
- Official search no-hit with clear jurisdiction/query and reasonable coverage: confidence 0.65-0.8 as coverage support, not proof of no disputes.
- Public legal databases such as CourtListener/RECAP, BAILII, Pappers Justice, or Jusbrasil with exact party/source linkage: confidence 0.6-0.8.
- Generic media, snippets, complaints, forum posts, or search-result text: confidence 0.35-0.6 and cannot alone justify a high-risk conclusion.
- `legal_disputes` max 15 points:
  - 13-15: applicable public legal/adverse searches show no material target-specific dispute and coverage is adequate for the country.
  - 9-12: limited coverage, old/minor/irrelevant disputes, or non-material name-collision risks.
  - 4-8: unresolved probable legal dispute, repeated public complaints, or partial official hit needing human review.
  - 0-3: confirmed recent/material lawsuit, insolvency, bankruptcy, regulatory enforcement, fraud judgment, unpaid debt enforcement, counterfeit/IP case, sanctions/compliance action, or similar seller-risk event.
- Missing accessible legal sources are `unavailable_api` or `pending_human_input`; they reduce coverage but must not be written as "no disputes".
- A confirmed material legal dispute is a forced-downgrade candidate even if other blocks score well.

## Safety

Do not accuse a company of fraud or illegality from snippets or name collisions. Use cautious wording: `公开资料显示...`, `本次公开来源未发现...`, or `名称相似但无法确认同一主体...`. Keep private/paywalled docket content out of the report unless the operator supplied authorized access.
