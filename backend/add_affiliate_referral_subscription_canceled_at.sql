-- Data de cancelamento/reembolso na referência de afiliado (para atualizar dados quando há reembolso)
ALTER TABLE affiliate_referrals
ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN affiliate_referrals.subscription_canceled_at IS 'Data em que a subscrição do referido foi cancelada ou reembolsada';
