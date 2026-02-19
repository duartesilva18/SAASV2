-- Script para identificar quem tentou criar a transação com erro
-- Parâmetros da transação:
-- workspace_id: '54b4ebdb-734f-4836-a0a3-ea2b6b32ae10'
-- category_id: '04b90a40-2fce-4a42-b32b-ebbc0fc82356'
-- amount_cents: 9999999900
-- description: 'pablo és um trengo, nao uses bots para programar, nao sabes o que fazes'

-- 1. Identificar o owner do workspace
SELECT 
    w.id AS workspace_id,
    w.name AS workspace_name,
    u.id AS user_id,
    u.email AS user_email,
    u.full_name AS user_name,
    u.phone_number,
    u.created_at AS user_created_at
FROM workspaces w
JOIN users u ON w.owner_id = u.id
WHERE w.id = '54b4ebdb-734f-4836-a0a3-ea2b6b32ae10';

-- 2. Verificar se há audit logs recentes relacionados com create_transaction para este workspace
SELECT 
    al.id,
    al.user_id,
    u.email AS user_email,
    u.full_name AS user_name,
    al.action,
    al.details,
    al.ip_address,
    al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.action = 'create_transaction'
  AND al.details LIKE '%9999999900%'
  AND al.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY al.created_at DESC
LIMIT 10;

-- 3. Verificar se há transações pendentes do Telegram com este valor
SELECT 
    tpt.id,
    tpt.chat_id,
    tpt.workspace_id,
    w.owner_id,
    u.email AS owner_email,
    u.full_name AS owner_name,
    tpt.amount_cents,
    tpt.description,
    tpt.transaction_date,
    tpt.created_at
FROM telegram_pending_transactions tpt
JOIN workspaces w ON tpt.workspace_id = w.id
JOIN users u ON w.owner_id = u.id
WHERE tpt.workspace_id = '54b4ebdb-734f-4836-a0a3-ea2b6b32ae10'
  AND tpt.amount_cents = 9999999900
ORDER BY tpt.created_at DESC
LIMIT 10;

-- 4. Verificar todas as tentativas recentes de criar transações com valores muito grandes (> 1 bilhão de cêntimos)
SELECT 
    al.id,
    al.user_id,
    u.email AS user_email,
    u.full_name AS user_name,
    al.action,
    al.details,
    al.ip_address,
    al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.action = 'create_transaction'
  AND (al.details LIKE '%9999999900%' OR al.details LIKE '%99999999%')
  AND al.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY al.created_at DESC;

-- 5. Verificar admin_error_logs para erros relacionados com integer out of range
SELECT 
    ael.id,
    ael.path,
    ael.message,
    ael.exc_type,
    ael.created_at
FROM admin_error_logs ael
WHERE ael.message LIKE '%integer out of range%'
   OR ael.message LIKE '%NumericValueOutOfRange%'
   OR ael.message LIKE '%9999999900%'
   OR ael.path LIKE '%/transactions%'
ORDER BY ael.created_at DESC
LIMIT 20;

-- 6. Verificar logs de erro relacionados com o workspace específico (através do path ou message)
SELECT 
    ael.id,
    ael.path,
    ael.message,
    ael.exc_type,
    ael.created_at
FROM admin_error_logs ael
WHERE ael.message LIKE '%54b4ebdb-734f-4836-a0a3-ea2b6b32ae10%'
   OR ael.message LIKE '%pablo%'
ORDER BY ael.created_at DESC
LIMIT 20;
