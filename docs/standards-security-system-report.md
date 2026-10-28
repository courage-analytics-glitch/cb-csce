# CB-CSCE Standards, Security, and System Readiness Report

**Assessment date:** 28 October 2026  
**System:** Cross-Border Commodity Settlement & Compliance Engine (CB-CSCE)  
**Assessment basis:** Repository review, local execution, automated checks, live API security tests, published-route evidence from the prior verification run, and comparison with authoritative international frameworks.

## Conclusion

CB-CSCE is **not gap-free and is not production-ready for live cross-border settlement, payment release, sanctions clearance, or regulated financial operation**. The current implementation is a coherent synthetic/demo control plane. It has useful accounting-domain controls, explicit synthetic provenance, a complete route shell, typed API validation, idempotent in-memory journal behavior, and a documented production boundary. It does not yet provide the durable identity, authorization, database, audit, integration, reconciliation, resilience, or regulated-operating evidence required for a production settlement system.

A material security defect was found and fixed in this assessment: before remediation, anonymous callers could invoke state-changing demo endpoints, and actor/organization values were accepted from request headers. The current code denies all state-changing demo requests unless a server-side `CSCE_DEMO_MUTATION_TOKEN` is configured and the caller supplies the matching header. This is a containment measure for a synthetic environment, not enterprise authentication or authorization.

No certification or compliance claim is supported. A code review and test run cannot establish ISO/IEC 27001 conformity, PCI DSS compliance, NIST CSF achievement, OWASP ASVS verification, FATF effectiveness, or ISO 20022 conformity. Those claims require an approved scope, implemented and operating controls, jurisdictional analysis, evidence, testing, risk acceptance, and—where applicable—independent assessment.

## Evidence reviewed

The repository currently reports `DEMO_SYNTHETIC` mode and `synthetic_repository` persistence. The implementation-status document explicitly states that durable database persistence, application authentication, server-derived actor identity, tenant scoping, role enforcement, maker-checker authorization, provider ingestion, object storage, queues, reconciliation, complete settlement workflows, and administrative APIs remain open. That disclosure is correct and has been preserved.

The accounting package uses Decimal arithmetic and tests balanced journals, unbalanced rejection, account/currency compatibility, precision, idempotency, duplicate business references, and reversal-based correction. The current repository is in-memory, so those controls do not yet prove durable atomicity or restart safety.

## Security controls verified in this assessment

The following controls are now present in the code or verified by execution:

- Anonymous state-changing demo requests are denied with `503 DEMO_MUTATIONS_DISABLED` unless a server-side demo token is configured.
- Demo mutation tokens are compared with constant-time comparison and are never embedded in the client bundle.
- JSON requests are bounded to 256 KB and strict JSON parsing is enabled.
- API responses send `Cache-Control: no-store`.
- Responses include a request ID, `X-Content-Type-Options: nosniff`, a restrictive referrer policy, a permissions policy, DNS-prefetch suppression, and a CSP.
- A bounded in-process rate limiter protects read and write API classes. This is suitable only for the single-process demo slice; production requires an edge or distributed limiter.
- JSON/oversize request errors return controlled error codes rather than stack traces.
- CI now runs type checks, unit tests, production build, high-severity dependency audit, and tracked credential-pattern scanning.
- Synthetic provenance remains explicit in health and operational API responses.

The CSP intentionally avoids `frame-ancestors` and `X-Frame-Options` so the managed Preview iframe remains compatible. The policy still includes `unsafe-inline` for the current build; a production hardening pass should remove inline script/style requirements after confirming the generated asset strategy and use nonces or hashes where necessary.

## Test evidence

The following commands passed after remediation:

- `pnpm check`
- `pnpm test`: **10/10 tests passed**
- `pnpm build`
- `pnpm audit --audit-level=high`: **no known vulnerabilities found**
- `git diff --check`
- tracked credential-pattern scan: no common credential patterns found

Live tests on the clean hardened service passed:

- Health endpoint returned HTTP 200.
- API response included request ID, `Cache-Control: no-store`, CSP, `Permissions-Policy`, and `X-Content-Type-Options`.
- Anonymous trade-hold mutation returned HTTP 503 with `DEMO_MUTATIONS_DISABLED`.
- An isolated token-enabled demo instance accepted a controlled authorized hold and emitted `TRADE_HOLD_APPLIED` audit output.
- A wrong token returned HTTP 503.

The previously published application had also passed a 30-route HTTP sweep and 16-tab browser navigation check. Those earlier published checks validate the prior published checkpoint; the security remediation in this report is currently a local workspace change until it is checkpointed and published.

## International standards gap assessment

### NIST Cybersecurity Framework 2.0

NIST CSF 2.0 is a useful governance and risk-outcome framework with six concurrent Functions: Govern, Identify, Protect, Detect, Respond, and Recover. It is not a financial rulebook, AML/sanctions standard, accounting framework, payment-message specification, or certification scheme. NIST states that it does not provide CSF certification or conformity assessment. [1] [2] [3]

**CB-CSCE status:** partial at the design/documentation level; insufficient operating evidence. The project has explicit provider provenance and production gates, but no verified Current Profile, Target Profile, risk register, control owners, centralized monitoring, incident evidence, recovery objectives, or supply-chain assurance.

**Required closure:** establish Current and Target Profiles; inventory assets and dependencies; define risk ownership and legal scope; implement identity, tenant isolation, secure SDLC, provider controls, logging, monitoring, incident response, backups, RTO/RPO, restoration, and continuous assurance.

### ISO/IEC 27001:2022 and ISO/IEC 27002:2022

ISO/IEC 27001 is the ISMS requirements standard. ISO/IEC 27002 is implementation guidance and is not itself certifiable. The current ISO catalogue identifies ISO/IEC 27001:2022 and its 2024 amendment as the relevant published baseline. [4] [5] [6]

**CB-CSCE status:** not evidenced as an ISMS and not certifiable from this implementation. Missing evidence includes scope, interested parties, risk treatment, Statement of Applicability, access reviews, secure development records, supplier controls, incident management, backup/restore tests, internal audit, management review, corrective actions, and operating effectiveness.

**Required closure:** create an ISMS scope covering the application, repository and CI/CD, cloud/runtime, identity, database, storage, queues, providers, operations, support, tenants, payment interfaces, and relevant third parties. Map risks to selected controls and retain evidence rather than treating the application checklist as certification.

### OWASP ASVS 5.0.0

OWASP ASVS 5.0.0 is the current stable technical verification baseline for web applications. It is directly applicable to the React/Vite and Express API surface. High-value settlement, privileged administration, payment-release, and integration paths should target the strongest practical verification level, with a version-pinned requirements matrix. [7] [8] [9]

**CB-CSCE status:** partial. The implementation validates several accounting inputs and has CSP/security headers, but authentication, secure sessions, MFA/step-up, server-side function/object/field authorization, tenant isolation, secure secrets, cryptographic key lifecycle, provider message integrity, logging, resilience, and secure release evidence are not complete.

**Required closure:** create an ASVS matrix; implement trusted-layer authorization and negative IDOR/BOLA/BOPLA tests; protect high-risk actions with reauthentication and dual control; enforce secure session and credential lifecycle; add threat modeling, dependency/SAST/DAST/secret scanning, signed build provenance, parser hardening, and security regression tests.

### PCI DSS v4.0.1

PCI DSS applies conditionally. It is relevant if CB-CSCE stores, processes, transmits, or can impact cardholder data or sensitive authentication data. If the application handles only non-card commodity settlement data and uses properly scoped tokenized/payment-provider flows, the scope may be narrower, but that must be documented. PCI DSS is not an AML, sanctions, accounting, trade-control, ISO 20022, or general settlement standard. PCI DSS v4.0.1 is the active version after v4.0 retirement. [10] [11] [12]

**CB-CSCE status:** card-data scope is undetermined, so no PCI conclusion is possible. If in scope, the repository lacks evidence for CDE diagrams, PAN/SAD data flows, network segmentation, secure configurations, Req. 6 SDLC evidence, MFA and least privilege, cryptographic key management, Req. 10 centralized logs, vulnerability testing, incident response, third-party responsibility matrices, and payment-page script/tamper controls where applicable.

**Required closure:** make and approve a card-data-flow and CDE-scope decision; document tokenization and provider boundaries; then select the appropriate ROC/AOC/SAQ path with the acquirer, payment brand, or QSA. Do not use a successful `pnpm audit` as PCI evidence.

### FATF Recommendations

FATF is the central international AML/CFT risk-based framework, implemented through jurisdictional law and supervision. The most relevant areas are risk assessment, CDD and beneficial ownership, records and suspicious-transaction reporting, targeted financial sanctions, proliferation-financing risk, new technology, payment transparency, and correspondent relationships. FATF is not a software certification scheme. Its 2025 Recommendation 16 revision should be considered in forward design, while local transposition and current payment rules remain controlling. [13] [14] [15]

**CB-CSCE status:** substantial gap. Synthetic compliance rows are not operating AML/CFT controls. There is no evidenced jurisdiction matrix, regulated-role analysis, risk assessment, beneficial-owner lifecycle, authoritative list governance, matching quality, investigation/case management, suspicious-transaction workflow, tipping-off controls, record retention, payment-chain integrity, or competent-authority evidence.

**Required closure:** identify the legal entities, regulated activities, corridors, currencies, commodities, payment rails, FIUs, sanctions regimes, privacy requirements, and record-retention rules in scope. Implement risk-based onboarding, UBO evidence, list provenance/freshness, screening and rescreening, holds/blocks, case workflows, independent overrides, transaction monitoring, reporting, and immutable records.

### ISO 20022

ISO 20022 is a financial-message semantic and interoperability standard. The ISO catalogue and community/network profiles must be pinned to exact message families, versions, code sets, and market practices. ISO 20022 has no official certification authority and does not itself provide authentication, authorization, sanctions compliance, settlement finality, or secure development. [16] [17] [18]

**CB-CSCE status:** design intent only. There is no demonstrated message-family/profile selection, schema and code-set pinning, Business Application Header handling, conformance tests, parser hardening, end-to-end acknowledgements/returns, or bank/correspondent reconciliation.

**Required closure:** select applicable `pain`, `pacs`, `camt`, investigation, return, and status profiles; define canonical mappings; validate schemas and business rules; preserve message IDs and hashes; authenticate transport and counterparties; implement replay/idempotency, outbox/inbox, returns, suspense, reconciliation, and controlled version migration.

## Critical production gaps that must remain open

The following are blockers for live use and were not falsely marked complete:

1. **Authentication and identity.** Replace demo headers with a trusted IdP, MFA/step-up, secure sessions, service identities, lifecycle management, privileged access, revocation, and server-derived actor identity.
2. **Tenant and authorization isolation.** Enforce tenant context server-side on every query, object, field, export, file, queue, cache, log, and callback. Add cross-tenant negative tests.
3. **Durable persistence.** Wire the repository to transactional database persistence with constraints, migrations, locking/concurrency behavior, idempotency, foreign keys, durable audit events, and restart tests.
4. **Maker-checker and settlement authorization.** Prevent self-approval, bind approvals to immutable exact terms, separate create/approve/release/reconcile/admin duties, enforce limits, expire approvals, and audit overrides.
5. **Financial integrity and reconciliation.** Implement durable ledger, payment/settlement state machine, returns and reversals, suspense and exceptions, independent bank/provider reconciliation, and finality rules.
6. **Provider and message security.** Authenticate providers, validate signatures and schemas, pin versions, prevent replay/duplicates, quarantine failures, monitor freshness/outage, preserve raw evidence, and reconcile acknowledgements.
7. **Compliance operations.** Implement lawful sanctions/AML/KYC/UBO controls, list governance, case management, stale/error-safe behavior, holds and blocks, reporting, retention, and jurisdiction-specific rules.
8. **Data protection.** Classify data, minimize it, encrypt it, manage keys and secrets, isolate tenants and regions, define retention/deletion/legal hold, restrict exports, and test restoration confidentiality.
9. **Resilience and incident response.** Define RTO/RPO and integrity objectives; implement durable queues, backups, restore/failover, kill switches, incident playbooks, evidence preservation, notifications, exercises, and lessons learned.
10. **Secure SDLC and supply chain.** Add threat models, pinned dependencies, SBOM/provenance, protected branches, peer review, SAST/DAST/SCA/secret scanning, container/IaC scanning, signed artifacts, vulnerability SLAs, penetration testing, and controlled rollback.
11. **Operational assurance.** Establish centralized time-synchronized tamper-evident logging, monitoring, alerting, SIEM/forensic retrieval, access review, control testing, risk acceptance, and independent assurance.

## Cybersecurity confirmation

**Current conclusion:** the application has a meaningful defensive baseline and the immediate anonymous-demo-write exposure is fixed and regression-tested. The current system is not secure enough to process live regulated settlement or payment instructions because its strongest security properties—identity, tenant authorization, durable audit, provider authentication, recovery, and operational monitoring—are not yet implemented and evidenced.

The correct security statement is therefore: **securely constrained synthetic demo; not production-secure for live financial operation**. The demo banner, synthetic provenance, disabled external execution, and mutation-token gate must remain until the production gates above are closed and independently tested.

## Recommended release decision

Do not authorize live settlement, payment release, sanctions clearance, or production customer data. Authorize only synthetic/demo use and controlled engineering testing. A production release should require signed evidence for identity and tenant isolation, durable transaction and audit persistence, maker-checker, provider/message controls, reconciliation, backup/restore, incident exercises, jurisdictional compliance, and independent security/controls review.

## References

[1]: https://csrc.nist.gov/pubs/cswp/29/the-nist-cybersecurity-framework-csf-20/final "NIST Cybersecurity Framework 2.0 official publication"
[2]: https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf "NIST CSF 2.0 official PDF"
[3]: https://www.nist.gov/cyberframework/faqs "NIST CSF official frequently asked questions"
[4]: https://www.iso.org/standard/27001 "ISO/IEC 27001:2022 official catalogue"
[5]: https://www.iso.org/standard/75652.html "ISO/IEC 27002:2022 official catalogue"
[6]: https://www.iso.org/standard/88435.html "ISO/IEC 27001:2022 Amendment 1:2024 official catalogue"
[7]: https://owasp.org/www-project-application-security-verification-standard/ "OWASP Application Security Verification Standard official project"
[8]: https://asvs.owasp.org/ "OWASP ASVS official standard site"
[9]: https://github.com/OWASP/ASVS/tree/v5.0.0 "OWASP ASVS 5.0.0 official tagged release"
[10]: https://www.pcisecuritystandards.org/standards/pci-dss/ "PCI Security Standards Council PCI DSS official page"
[11]: https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1 "PCI SSC PCI DSS v4.0.1 publication announcement"
[12]: https://www.pcisecuritystandards.org/document_library/ "PCI SSC official document library"
[13]: https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html "FATF Recommendations official page"
[14]: https://www.fatf-gafi.org/en/publications/Fatfrecommendations/update-Recommendation-16-payment-transparency-june-2025.html "FATF Recommendation 16 payment transparency update"
[15]: https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-Beneficial-Ownership-Legal-Persons.html "FATF beneficial ownership guidance"
[16]: https://www.iso20022.org/about-iso-20022 "ISO 20022 official overview"
[17]: https://www.iso20022.org/catalogue-messages "ISO 20022 official message catalogue"
[18]: https://www.iso20022.org/faq "ISO 20022 official FAQ"
