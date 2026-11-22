# CSA Global — India launch legal evidence register

**Research snapshot:** 22 November 2026  
**Market under review:** India  
**Status:** Research pack prepared; legal review and country activation remain pending.  
**Important:** This is a source register and issue-spotting aid, not a legal opinion or a substitute for review by an Indian advocate, CA/CS, or other appropriately qualified professional.

## 1. Launch decision and control

India remains `setup` / `not_started` in the CSA Country Registry. Do not change it to `active` or mark legal review `approved` solely on the basis of this document. The Super Admin workflow requires an actual evidence reference and a human reviewer. No legal-review database row, approval, or country assignment was created by this research.

## 2. Primary-source register

| Topic | Primary source | Relevance to CSA Global | Review status |
|---|---|---|---|
| Digital personal data | [Digital Personal Data Protection Act, 2023 — Gazette of India](https://egazette.gov.in/WriteReadData/2023/248045.pdf) | Client/editor account data, identity/KYC records, contact details, work files, payment and activity records | Counsel review required |
| DPDP commencement | [G.S.R. 843(E), 13 November 2025 — Gazette](https://egazette.gov.in/WriteReadData/2025/267647.pdf) | Phased commencement dates for provisions of the DPDP Act | Timeline extracted below |
| DPDP Rules | [G.S.R. 846(E), 13 November 2025 — Gazette](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) | Notice, security safeguards, breach notifications, retention, rights, grievance mechanisms and other operational rules | Counsel review required |
| DPDP Rules publication index | [MeitY — DPDP Rules 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025) | Official rules, corrigendum and enforcement-timeline documents | Check for later corrigenda/orders before approval |
| E-commerce services | [Consumer Protection (E-Commerce) Rules, 2020 — Department of Consumer Affairs](https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules.pdf) | Rules expressly cover services bought or sold over digital/electronic networks and marketplace/inventory models; assess whether CSA is an e-commerce entity or marketplace | Applicability to be determined |
| E-commerce amendment | [Consumer Protection (E-Commerce) (Amendment) Rules, 2021](https://consumeraffairs.nic.in/sites/default/files/Consumer%20Protection%20%28E-Commerce%29%20%28Amendment%29%20Rules%2C%202021.pdf) | Includes resident-in-India nodal officer / alternate senior designated functionary requirement for specified entities | Entity-form applicability to be determined |
| Intermediary rules | [Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 — updated 10 February 2026, MeitY](https://www.meity.gov.in/static/uploads/2026/02/550681ab908f8afb135b0ad42816a1c9.pdf) | Assess if hosting user-uploaded media, messages, profiles or other third-party information makes CSA an intermediary and what due-diligence/grievance duties apply | Applicability to be determined |
| GST / e-commerce operator | [CBIC GST Sectoral FAQs](https://cbic-gst.gov.in/hindi/sectoral-faq.html) | CBIC explains Section 52 TCS for taxable supplies by other suppliers through an ECO where consideration is collected by the operator; own-account supplies are treated differently | CA review required |
| CGST Act, Section 52 | [CBIC — Central GST Act text](https://cbic-gst.gov.in/hindi/CGST-bill-e.html) | Primary statutory basis for e-commerce operator TCS | CA review required |
| Payment aggregation | [RBI Master Direction on Regulation of Payment Aggregator (updated 11 November 2026)](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896) | Assess whether CSA only uses a regulated PA (e.g. a gateway) or itself receives, pools and settles customer funds; domestic and cross-border flows need separate review | CA / payments counsel review required |

## 3. DPDP commencement timeline

The commencement notification G.S.R. 843(E) and Rules notification G.S.R. 846(E) use phased dates. Based on the Gazette dates printed as 13 November 2025:

- **In force from 13 November 2025:** Act section 1(2), section 2, sections 18–26, 35, 38–43, and section 44(1) and (3); Rules 1, 2 and 17–21.
- **In force from 13 November 2026:** Act section 6(9) and section 27(1)(d); Rule 4.
- **Scheduled from 13 May 2027:** Act sections 3–5, section 6(1)–(8) and (10), sections 7–17, section 27 except clause (d), sections 28–34, 36–37, and section 44(2); Rules 3, 5–16, 22 and 23.

The platform should be designed now for the full regime rather than waiting for the later commencement date. Counsel must check the latest Gazette corrigenda, removal-of-difficulties orders and any subsequent notifications before signing off.

## 4. CSA Global applicability questions for counsel

1. **Business model:** Is CSA the direct supplier of editing/production services, a marketplace connecting independent editors with clients, an agent, or a combination? The answer affects consumer, GST, TCS, contract and payment treatment.
2. **Money flow:** Does the payment gateway settle directly to CSA, directly to each editor, or does CSA receive and later split/settle funds? Do not operate an unlicensed payment-aggregation or escrow-like model. Obtain a written flow-of-funds opinion from the payment provider and counsel.
3. **GST:** Determine who is supplier/recipient for each service, whether Section 52 TCS applies to third-party editor supplies, invoicing responsibility, place-of-supply, export-of-service treatment and GST registration obligations.
4. **Consumer rules:** Confirm whether CSA is an e-commerce entity / marketplace and implement required entity details, seller/editor disclosures, grievance handling, refunds/cancellations, pricing transparency and complaint tracking as applicable.
5. **Intermediary status:** Determine whether CSA merely provides neutral hosting/communication or is itself the service provider/editorial decision-maker. Map notice-and-takedown, prohibited content, complaint handling and record-preservation duties as applicable.
6. **Privacy:** Inventory each data category and purpose: Google identity, email/mobile, profile, country, editor KYC, uploaded media, messages, location/attendance evidence, payment metadata, audit logs and support tickets. Define retention, deletion, access/correction/grievance channels, processor contracts, breach response and security safeguards.
7. **Cross-border operations:** Identify where users, editors, customers, data processors and payment settlement banks are located. Assess DPDP transfer rules, FEMA, export-of-service/GST, RBI PA-CB requirements and sanctions screening before enabling each country.
8. **Entity details:** Confirm the contracting legal entity, constitution, registered address, PAN/GSTIN, authorised signatory and public grievance contact. The brand name alone is not sufficient evidence of the contracting entity.
9. **Age / minors:** Decide whether minors may create accounts or appear in submitted media; set age restrictions and consent controls where required.
10. **IP and content rights:** Define client ownership/licence, editor assignment rights, music/stock/font licences, portfolio permissions, takedown process, confidentiality and post-termination deletion.

## 5. Technical controls to map to legal requirements

- Publish a standalone privacy notice that identifies data categories, purposes, processors, retention, user-rights channels and grievance contact.
- Capture and version consent / notices, and make withdrawal as accessible as consent where required.
- Implement account export, correction, deletion and grievance workflows, subject to statutory retention exceptions.
- Keep security and processing logs with documented retention; the DPDP Rules include security safeguards, access visibility, backup and breach-response requirements.
- Maintain a data breach playbook, affected-person notification templates, Board-notification responsibility and a 72-hour detailed-update process where required by the Rules.
- Maintain processor/subprocessor inventory and written security clauses.
- Separate payment-gateway token/transaction references from card credentials; do not store raw card credentials.
- Maintain a documented GST invoice, refund, chargeback and editor-payout reconciliation model.
- Keep user-generated content complaints, takedown evidence and response timelines where intermediary rules apply.

## 6. Evidence required before India activation

- Written legal opinion from an Indian advocate addressing the applicability questions above and the correct entity/contracting structure.
- CA opinion on GST registration, place-of-supply, export-of-service, Section 52 TCS and invoice/settlement model.
- Payment provider's written confirmation of merchant/marketplace onboarding category and settlement flow; RBI-authorisation status of the payment provider should be independently checked.
- Approved India-specific Terms of Service, Privacy Notice, Refund/Cancellation Policy, Editor Agreement, Client Agreement, IP/licensing and grievance procedure.
- Named India grievance/nodal contact with a real, monitored business email and escalation process.
- Real, authorised Regional Admin identity and email for the India region, verified through the invitation and acceptance workflow.
- Evidence references (official Gazette, legal opinion, CA opinion, payment-provider documents and policy versions) attached to the Super Admin legal review.

## 7. Platform state at research time

- India country registry: `status=setup`, `legal_review_status=not_started`.
- No India legal approval has been entered.
- Existing two active Client accounts have no verified country assignment; both remain `needs_verified_country`.
- The immutable country assignment audit is enabled in canonical Global Staging D1. A Super Admin must use the verified-country workflow with actual evidence after the legal review is approved.
- No Regional Admin was created and no placeholder email was inserted.
- This file is not itself approval evidence and must not be used to mark India active.

## 8. Approval checklist

- [ ] Indian advocate legal opinion received and reviewed
- [ ] CA/GST opinion received and reviewed
- [ ] Payment-provider flow and regulatory category confirmed
- [ ] Privacy notice and DPDP implementation reviewed
- [ ] E-commerce / intermediary applicability resolved
- [ ] Consumer grievance and refund workflow verified
- [ ] Contracting legal entity and public contact details confirmed
- [ ] Real India Regional Admin email and identity verified
- [ ] Super Admin legal review completed with real evidence references
- [ ] India country activation approved by Super Admin
