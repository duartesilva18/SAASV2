-- Comissões por plano: Plus 20%, Pro 25%. Admin pode alterar em /admin/affiliates.
-- Os afiliados ganham esta comissão em cada cobrança (mensal/anual) enquanto o referido continuar subscrito.

INSERT INTO system_settings (id, key, value, description)
SELECT gen_random_uuid(), 'affiliate_commission_percentage_plus', '20', 'Comissão afiliados plano Plus (ex: 20 = 20%)'
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'affiliate_commission_percentage_plus');

INSERT INTO system_settings (id, key, value, description)
SELECT gen_random_uuid(), 'affiliate_commission_percentage_pro', '25', 'Comissão afiliados plano Pro (ex: 25 = 25%)'
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'affiliate_commission_percentage_pro');
