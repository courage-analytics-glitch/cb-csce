# Accounting Policy and Control Notes

The initial functional currency is GHS. Transaction currency and reporting currency are preserved separately. No unlike currencies are summed as though they were equivalent. Translation requires an explicit rate snapshot with source, observed timestamp, valuation timestamp, and rate type.

A posted journal has at least two lines and balances independently in every currency represented by the journal. Debit and credit amounts are positive decimal strings; a line cannot carry both sides. Posted records cannot be edited or deleted. Corrections are reversing journals followed by a replacement posting. Idempotency keys protect retries.

The illustrative demonstration fixtures include a USD commodity purchase: debit inventory USD 100,000 and credit trade payables USD 100,000; and a USD payment: debit trade payables USD 100,000 and credit cash USD 100,000. These are synthetic records and do not evidence an actual transaction.
