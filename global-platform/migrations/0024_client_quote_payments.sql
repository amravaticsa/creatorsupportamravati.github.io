-- 0024: Client quote payment policy and payment-to-quote linkage.
-- Advance percentage stays NULL until Super Admin explicitly configures it.
ALTER TABLE csa_pricing_policies ADD COLUMN client_advance_bps INTEGER CHECK(client_advance_bps BETWEEN 1 AND 10000);
ALTER TABLE client_quotes ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','partial','paid'));
ALTER TABLE payments ADD COLUMN quote_id TEXT REFERENCES client_quotes(id);
CREATE INDEX IF NOT EXISTS idx_payments_quote ON payments(quote_id,payment_type,status);
