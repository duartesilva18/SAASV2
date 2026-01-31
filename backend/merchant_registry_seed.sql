-- Seed inicial de merchants (opcional)
INSERT INTO merchant_registry (alias, canonical_name, category_name, transaction_type, usage_count, confidence, is_active)
VALUES
('continente', 'continente', 'Alimentação', 'expense', 1, 0.8, TRUE),
('continente hiper', 'continente', 'Alimentação', 'expense', 1, 0.8, TRUE),
('continente.pt', 'continente', 'Alimentação', 'expense', 1, 0.8, TRUE),
('pingo doce', 'pingo doce', 'Alimentação', 'expense', 1, 0.8, TRUE),
('lidl', 'lidl', 'Alimentação', 'expense', 1, 0.8, TRUE),
('auchan', 'auchan', 'Alimentação', 'expense', 1, 0.8, TRUE),
('uber', 'uber', 'Transportes', 'expense', 1, 0.8, TRUE),
('bolt', 'bolt', 'Transportes', 'expense', 1, 0.8, TRUE),
('cp', 'cp', 'Transportes', 'expense', 1, 0.8, TRUE),
('metro', 'metro', 'Transportes', 'expense', 1, 0.8, TRUE),
('edp', 'edp', 'Habitação', 'expense', 1, 0.8, TRUE),
('meo', 'meo', 'Habitação', 'expense', 1, 0.8, TRUE),
('nos', 'nos', 'Habitação', 'expense', 1, 0.8, TRUE),
('vodafone', 'vodafone', 'Habitação', 'expense', 1, 0.8, TRUE),
('netflix', 'netflix', 'Entretenimento', 'expense', 1, 0.8, TRUE),
('spotify', 'spotify', 'Entretenimento', 'expense', 1, 0.8, TRUE),
('amazon', 'amazon', 'Compras', 'expense', 1, 0.8, TRUE),
('salario', 'salario', 'Salário', 'income', 1, 0.8, TRUE),
('ordenado', 'ordenado', 'Salário', 'income', 1, 0.8, TRUE),
('vencimento', 'vencimento', 'Salário', 'income', 1, 0.8, TRUE);
