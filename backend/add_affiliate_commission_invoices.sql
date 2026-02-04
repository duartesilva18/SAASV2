-- =====================================================
-- AFFILIATE COMMISSION INVOICES (idempotência)
-- Evita duplicar comissão se o webhook invoice.paid for reenviado.
-- =====================================================

CREATE TABLE IF NOT EXISTS affiliate_commission_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR(255) NOT NULL UNIQUE,
    affiliate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    base_amount_cents INTEGER NOT NULL,
    commission_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commission_invoices_invoice_id ON affiliate_commission_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commission_invoices_affiliate_id ON affiliate_commission_invoices(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commission_invoices_month ON affiliate_commission_invoices(month);

COMMENT ON TABLE affiliate_commission_invoices IS 'Invoices já creditadas em AffiliateCommission; evita duplicar comissão em reenvios do webhook invoice.paid';
