-- =====================================================
-- AFFILIATE CHARGE REFUND TRACKING
-- Refund parcial múltiplo: amount_refunded é acumulado; só revertemos o delta por charge.
-- =====================================================

CREATE TABLE IF NOT EXISTS affiliate_charge_refund_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charge_id VARCHAR(255) NOT NULL UNIQUE,
    base_refunded_reversed_cents INTEGER NOT NULL DEFAULT 0,
    conversions_decremented BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_charge_refund_tracking_charge_id ON affiliate_charge_refund_tracking(charge_id);

COMMENT ON TABLE affiliate_charge_refund_tracking IS 'Por charge: base já revertida; refunds parciais múltiplos usam soma acumulada (só revertemos o delta)';
