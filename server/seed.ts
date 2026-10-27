export type Provenance = "DEMO_SYNTHETIC" | "MANAGED_DATABASE" | "UNVERIFIED";

export type Trade = {
  id: string;
  tradeReference: string;
  contractNumber: string;
  buyer: string;
  seller: string;
  commodity: string;
  quantity: string;
  unit: string;
  contractValue: string;
  contractCurrency: "GHS" | "USD" | "AED" | "CNY" | "RUB";
  originCountry: string;
  destinationCountry: string;
  loadingPort: string;
  destinationPort: string;
  status: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readiness: number;
  blockers: string[];
  updatedAt: string;
};

export const trades: Trade[] = [
  {
    id: "trade_1001",
    tradeReference: "GH-COC-26041",
    contractNumber: "GCC-2026-041",
    buyer: "Alpine Meridian FZE",
    seller: "Kumasi Origin Cooperative",
    commodity: "Cocoa beans",
    quantity: "1,250",
    unit: "MT",
    contractValue: "4280000",
    contractCurrency: "USD",
    originCountry: "Ghana",
    destinationCountry: "United Arab Emirates",
    loadingPort: "Tema Port",
    destinationPort: "Jebel Ali",
    status: "READY_FOR_EXPORT",
    riskLevel: "LOW",
    readiness: 92,
    blockers: ["Final vessel nomination pending"],
    updatedAt: "2026-10-27T15:12:00Z"
  },
  {
    id: "trade_1002",
    tradeReference: "GH-MNG-26018",
    contractNumber: "GMC-2026-018",
    buyer: "Sino-Atlantic Materials Ltd",
    seller: "Ashanti Minerals Exporters",
    commodity: "Manganese concentrate",
    quantity: "8,400",
    unit: "MT",
    contractValue: "3920000",
    contractCurrency: "CNY",
    originCountry: "Ghana",
    destinationCountry: "China",
    loadingPort: "Takoradi Port",
    destinationPort: "Qingdao",
    status: "DOCUMENTATION_IN_PROGRESS",
    riskLevel: "MEDIUM",
    readiness: 68,
    blockers: ["Phytosanitary certificate expires in 6 days", "Beneficial owner rescreen due"],
    updatedAt: "2026-10-27T13:38:00Z"
  },
  {
    id: "trade_1003",
    tradeReference: "GH-SHE-26009",
    contractNumber: "GSC-2026-009",
    buyer: "Nile Crescent Foods LLC",
    seller: "Northern Savannah Processors",
    commodity: "Shea butter",
    quantity: "620",
    unit: "MT",
    contractValue: "1170000",
    contractCurrency: "AED",
    originCountry: "Ghana",
    destinationCountry: "United Arab Emirates",
    loadingPort: "Tema Port",
    destinationPort: "Khalifa Port",
    status: "ON_HOLD",
    riskLevel: "HIGH",
    readiness: 41,
    blockers: ["Potential counterparty match requires independent review", "Escrow release condition incomplete"],
    updatedAt: "2026-10-27T11:04:00Z"
  },
  {
    id: "trade_1004",
    tradeReference: "GH-COC-25987",
    contractNumber: "GCC-2026-008",
    buyer: "Northstar Commodity Trading AG",
    seller: "Kumasi Origin Cooperative",
    commodity: "Cocoa beans",
    quantity: "900",
    unit: "MT",
    contractValue: "2960000",
    contractCurrency: "USD",
    originCountry: "Ghana",
    destinationCountry: "Switzerland",
    loadingPort: "Tema Port",
    destinationPort: "Antwerp",
    status: "SETTLEMENT_PENDING",
    riskLevel: "LOW",
    readiness: 100,
    blockers: ["Awaiting checker approval for final release"],
    updatedAt: "2026-10-26T16:44:00Z"
  }
];

export const journalFixtures = [
  {
    journalId: "jrnl_demo_1",
    journalNumber: "JRN-1042",
    businessReference: "GH-COC-25987-PURCHASE",
    transactionType: "COMMODITY_PURCHASE",
    description: "Illustrative USD commodity purchase; synthetic demonstration record",
    effectiveAt: "2026-10-19T09:00:00Z",
    postedAt: "2026-10-19T09:03:00Z",
    status: "POSTED",
    currency: "USD",
    debit: "100000.00",
    credit: "100000.00",
    provenance: "DEMO_SYNTHETIC" as Provenance
  },
  {
    journalId: "jrnl_demo_2",
    journalNumber: "JRN-1043",
    businessReference: "GH-COC-25987-PAYMENT",
    transactionType: "TRADE_PAYABLE_SETTLEMENT",
    description: "Illustrative USD payment; synthetic demonstration record",
    effectiveAt: "2026-10-25T12:40:00Z",
    postedAt: "2026-10-25T12:41:00Z",
    status: "POSTED",
    currency: "USD",
    debit: "100000.00",
    credit: "100000.00",
    provenance: "DEMO_SYNTHETIC" as Provenance
  },
  {
    journalId: "jrnl_demo_3",
    journalNumber: "JRN-1044",
    businessReference: "GH-SHE-26009-ESCROW",
    transactionType: "ESCROW_RESERVATION",
    description: "Restricted funds reservation pending compliance release",
    effectiveAt: "2026-10-26T08:20:00Z",
    postedAt: "2026-10-26T08:21:00Z",
    status: "POSTED",
    currency: "AED",
    debit: "410000.00",
    credit: "410000.00",
    provenance: "DEMO_SYNTHETIC" as Provenance
  }
];

export const complianceCases = [
  { id: "case_2001", subject: "Nile Crescent Foods LLC", tradeReference: "GH-SHE-26009", status: "REVIEW_REQUIRED", severity: "HIGH", reason: "Potential beneficial-owner similarity; human review required", age: "3h", owner: "A. Mensah", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "case_2002", subject: "Sino-Atlantic Materials Ltd", tradeReference: "GH-MNG-26018", status: "STALE", severity: "MEDIUM", reason: "Rescreening source is stale beyond configured tolerance", age: "1d", owner: "Unassigned", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "case_2003", subject: "Tema Ocean Logistics", tradeReference: "GH-COC-26041", status: "CLEAR", severity: "LOW", reason: "No match on last synthetic screening run", age: "6h", owner: "E. Owusu", provenance: "DEMO_SYNTHETIC" as Provenance }
];

export const documents = [
  { id: "doc_3001", name: "Export permit · GH-COC-26041", type: "EXPORT_PERMIT", status: "VERIFIED", version: "v3", hash: "8af1…c92e", updated: "42m ago", owner: "Ops Control", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "doc_3002", name: "Phytosanitary certificate · GH-MNG-26018", type: "PHYTOSANITARY", status: "EXPIRING", version: "v1", hash: "c42d…19aa", updated: "1d ago", owner: "Compliance", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "doc_3003", name: "Commercial invoice · GH-SHE-26009", type: "COMMERCIAL_INVOICE", status: "HASH_MISMATCH", version: "v4", hash: "mismatch", updated: "3h ago", owner: "Trade Desk", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "doc_3004", name: "Bill of lading · GH-COC-25987", type: "BILL_OF_LADING", status: "PENDING_REVIEW", version: "v2", hash: "9f70…a102", updated: "5h ago", owner: "Shipping", provenance: "DEMO_SYNTHETIC" as Provenance }
];

export const settlements = [
  { id: "set_4001", settlementReference: "STL-26087", tradeReference: "GH-COC-25987", method: "L/C", currency: "USD", amount: "2960000", received: "2960000", status: "AWAITING_APPROVAL", condition: "Checker approval", route: "Verified sandbox route", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "set_4002", settlementReference: "STL-26088", tradeReference: "GH-SHE-26009", method: "Escrow", currency: "AED", amount: "1170000", received: "410000", status: "CONDITION_PENDING", condition: "Counterparty review + document hash", route: "NO_ELIGIBLE_ROUTE", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "set_4003", settlementReference: "STL-26089", tradeReference: "GH-COC-26041", method: "Advance T/T", currency: "USD", amount: "1284000", received: "642000", status: "PARTIALLY_RECEIVED", condition: "Balance due before release", route: "Indicative route only", provenance: "DEMO_SYNTHETIC" as Provenance }
];

export const shipments = [
  { id: "ship_5001", vessel: "MV Meridian Star", tradeReference: "GH-COC-26041", origin: "Tema Port", destination: "Jebel Ali", milestone: "DOCUMENTS_READY", eta: "2026-11-08", status: "ON_TRACK", demurrage: "USD 0", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "ship_5002", vessel: "MV Keta Horizon", tradeReference: "GH-MNG-26018", origin: "Takoradi Port", destination: "Qingdao", milestone: "INSPECTION_PENDING", eta: "2026-11-14", status: "WATCH", demurrage: "USD 18,400 est.", provenance: "DEMO_SYNTHETIC" as Provenance },
  { id: "ship_5003", vessel: "MV Savannah Pearl", tradeReference: "GH-SHE-26009", origin: "Tema Port", destination: "Khalifa Port", milestone: "HOLD_RELEASE", eta: "2026-11-18", status: "AT_RISK", demurrage: "AED 74,000 est.", provenance: "DEMO_SYNTHETIC" as Provenance }
];

export const fxRates = [
  { pair: "USD / GHS", rate: "12.84", source: "Indicative synthetic feed", freshness: "12m", status: "INDICATIVE", observedAt: "2026-10-27T20:12:00Z" },
  { pair: "AED / USD", rate: "0.2723", source: "Contractual snapshot", freshness: "2h", status: "CONTRACTUAL", observedAt: "2026-10-27T18:20:00Z" },
  { pair: "CNY / USD", rate: "0.1401", source: "Accounting rate", freshness: "1d", status: "STALE", observedAt: "2026-10-26T16:00:00Z" },
  { pair: "RUB / USD", rate: "0.0111", source: "Provider unavailable", freshness: "unknown", status: "UNAVAILABLE", observedAt: "unknown" }
];

export const auditEvents: { id: string; time: string; action: string; actor: string; entity: string; result: string; metadata?: Record<string, unknown>; provenance?: Provenance }[] = [
  { id: "audit_6001", time: "20:14:08", action: "SCREENING_MARKED_STALE", actor: "system:screening-refresh", entity: "case_2002", result: "REVIEW_REQUIRED" },
  { id: "audit_6002", time: "19:48:27", action: "DOCUMENT_HASH_MISMATCH", actor: "system:integrity-check", entity: "doc_3003", result: "BLOCKED" },
  { id: "audit_6003", time: "18:42:10", action: "JOURNAL_POSTED", actor: "ops.mensah", entity: "jrnl_demo_3", result: "POSTED" },
  { id: "audit_6004", time: "17:26:51", action: "TRADE_STATUS_CHANGED", actor: "rm.owusu", entity: "trade_1003", result: "ON_HOLD" }
];

export const summary = {
  kpis: {
    activeTradeValue: [{ currency: "USD", value: "7.24M" }, { currency: "CNY", value: "3.92M" }, { currency: "AED", value: "1.17M" }],
    volumeInTransit: "11,170 MT",
    availableCash: [{ currency: "GHS", value: "GHS 4.82M" }, { currency: "USD", value: "USD 1.16M" }, { currency: "AED", value: "AED 0.41M" }],
    receivables: "USD 1.93M",
    payables: "USD 0.86M",
    restrictedFunds: "AED 410K",
    awaitingApproval: 4,
    complianceReview: 2,
    documentsPending: 3,
    demurrageRisk: "USD 18.4K",
    fxExposure: "GHS 9.6M"
  },
  tradeByCommodity: [{ name: "Cocoa", value: 7.24 }, { name: "Manganese", value: 3.92 }, { name: "Shea", value: 1.17 }],
  settlementByCurrency: [{ currency: "USD", value: 4.244 }, { currency: "AED", value: 1.17 }, { currency: "CNY", value: 3.92 }],
  cashMovement: [{ day: "21 Oct", inflow: 0.42, outflow: 0.28 }, { day: "22 Oct", inflow: 0.36, outflow: 0.19 }, { day: "23 Oct", inflow: 0.82, outflow: 0.47 }, { day: "24 Oct", inflow: 0.51, outflow: 0.32 }, { day: "25 Oct", inflow: 0.64, outflow: 0.41 }, { day: "26 Oct", inflow: 0.22, outflow: 0.33 }, { day: "27 Oct", inflow: 0.71, outflow: 0.29 }],
  fxExposure: [{ pair: "USD/GHS", exposure: 4.8, shock: 0.42 }, { pair: "AED/USD", exposure: 2.1, shock: 0.17 }, { pair: "CNY/USD", exposure: 1.7, shock: -0.09 }, { pair: "RUB/USD", exposure: 1.0, shock: -0.21 }],
  pipeline: [{ label: "Trade approval", count: 5 }, { label: "Docs in progress", count: 3 }, { label: "Ready for export", count: 2 }, { label: "In transit", count: 2 }, { label: "Settlement pending", count: 2 }],
  alerts: [
    { id: "alert_1", tone: "critical", title: "Document integrity exception", text: "Commercial invoice hash mismatch on GH-SHE-26009.", action: "Review document", href: "/documents" },
    { id: "alert_2", tone: "warning", title: "Screening source stale", text: "Sino-Atlantic rescreening is beyond the 24-hour policy window.", action: "Open case", href: "/compliance/cases" },
    { id: "alert_3", tone: "warning", title: "Demurrage exposure", text: "MV Keta Horizon has an estimated USD 18.4K exposure.", action: "View shipment", href: "/shipments/ship_5002" },
    { id: "alert_4", tone: "info", title: "Release queue", text: "Four settlements are awaiting independent approval.", action: "Open queue", href: "/settlements" }
  ]
};
