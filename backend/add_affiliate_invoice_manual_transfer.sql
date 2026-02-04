-- =====================================================
-- AFFILIATE INVOICE MANUAL TRANSFER
-- Evita pagamento duplo: um Transfer manual por invoice_id (1ª invoice sem split).
-- =====================================================

CREATE TABLE IF NOT EXISTS affiliate_invoice_manual_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR(255) NOT NULL UNIQUE,
    transfer_id VARCHAR(255) NOT NULL,
    affiliate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_invoice_manual_transfers_invoice_id ON affiliate_invoice_manual_transfers(invoice_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_invoice_manual_transfers_affiliate_id ON affiliate_invoice_manual_transfers(affiliate_id);

COMMENT ON TABLE affiliate_invoice_manual_transfers IS 'Transfer manual por 1ª invoice sem split Connect; evita duplicar pagamento ao afiliado';
