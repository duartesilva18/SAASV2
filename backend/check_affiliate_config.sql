-- Verificar se a tua conta (afiliado) está bem configurada

-- 0) Ver todos os afiliados (para encontrar o teu email na BD)
SELECT id, email, full_name, is_affiliate, affiliate_code,
       stripe_connect_account_id IS NOT NULL AS tem_connect,
       stripe_connect_onboarding_completed,
       stripe_connect_account_status
FROM users
WHERE is_affiliate = true
ORDER BY email;

-- Se deu vazio acima, ver todos os users com email (para ver o que existe):
-- SELECT id, email, full_name, is_affiliate, affiliate_code FROM users ORDER BY email;

-- 1) Configuração do teu user (afiliado) – substitui o email pelo teu
SELECT
  id,
  email,
  full_name,
  is_affiliate,
  affiliate_code,
  stripe_connect_account_id,
  stripe_connect_onboarding_completed,
  stripe_connect_account_status,
  affiliate_payout_enabled,
  created_at
FROM users
WHERE email = 'larissajf07@gmail.com';

-- 2) Referências que tens (quem usou o teu link) – substitui o email
SELECT
  r.id,
  r.referral_code,
  r.has_subscribed,
  r.subscription_date,
  r.created_at,
  u.email AS referred_email,
  u.full_name AS referred_name
FROM affiliate_referrals r
JOIN users u ON u.id = r.referred_user_id
JOIN users aff ON aff.id = r.referrer_id
WHERE aff.email = 'larissajf07@gmail.com'
ORDER BY r.created_at DESC;

-- 3) Comissões registadas para ti – substitui o email
SELECT
  month,
  total_revenue_cents,
  commission_percentage,
  commission_amount_cents,
  conversions_count,
  is_paid,
  paid_at,
  stripe_transfer_id,
  transfer_status
FROM affiliate_commissions c
JOIN users u ON u.id = c.affiliate_id
WHERE u.email = 'larissajf07@gmail.com'
ORDER BY month DESC;

-- Alternativa: usar user ID em vez de email (se souberes o teu id)
-- WHERE u.id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- Resumo: está bem configurado se:
-- - is_affiliate = true
-- - affiliate_code preenchido (ex: DD218VYO)
-- - stripe_connect_account_id preenchido (ac_...)
-- - stripe_connect_onboarding_completed = true (após Stripe ativar)
-- O Stripe pode demorar a ativar; o estado real (charges_enabled) vê-se na API no momento do checkout.
