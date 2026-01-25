export const DEMO_TRANSACTIONS = [
  // Janeiro 2026
  { id: 'd1', amount_cents: 250000, description: 'Salário Mensal', category_id: 'income_cat', transaction_date: '2026-01-01' },
  { id: 'd2', amount_cents: 85000, description: 'Renda Casa', category_id: 'rent_cat', transaction_date: '2026-01-05' },
  { id: 'd3', amount_cents: 4500, description: 'Netflix', category_id: 'subs_cat', transaction_date: '2026-01-10' },
  { id: 'd4', amount_cents: 12000, description: 'Supermercado', category_id: 'food_cat', transaction_date: '2026-01-12' },
  { id: 'd5', amount_cents: 3500, description: 'Jantar Fora', category_id: 'food_cat', transaction_date: '2026-01-15' },
  { id: 'd6', amount_cents: 50000, description: 'Dividendos', category_id: 'income_cat', transaction_date: '2026-01-18' },
  { id: 'd7', amount_cents: 6500, description: 'Gasolina', category_id: 'transport_cat', transaction_date: '2026-01-20' },
  { id: 'd8', amount_cents: 1500, description: 'Spotify', category_id: 'subs_cat', transaction_date: '2026-01-15' },
  { id: 'd9', amount_cents: 4200, description: 'Farmácia', category_id: 'health_cat', transaction_date: '2026-01-18' },
  { id: 'd_inv1', amount_cents: 20000, description: 'Reforço PPR', category_id: 'invest_cat', transaction_date: '2026-01-20' },
  { id: 'd_em1', amount_cents: 10000, description: 'Fundo de Emergência', category_id: 'em_cat', transaction_date: '2026-01-22' },

  // Dezembro 2025
  { id: 'd10', amount_cents: 250000, description: 'Salário Mensal', category_id: 'income_cat', transaction_date: '2025-12-01' },
  { id: 'd11', amount_cents: 50000, description: 'Bónus Natal', category_id: 'income_cat', transaction_date: '2025-12-15' },
  { id: 'd12', amount_cents: 85000, description: 'Renda Casa', category_id: 'rent_cat', transaction_date: '2025-12-05' },
  { id: 'd13', amount_cents: 20000, description: 'Prendas Natal', category_id: 'leisure_cat', transaction_date: '2025-12-20' },
  { id: 'd14', amount_cents: 15000, description: 'Jantar Natal', category_id: 'food_cat', transaction_date: '2025-12-24' },
  { id: 'd15', amount_cents: 6000, description: 'Gasolina', category_id: 'transport_cat', transaction_date: '2025-12-10' },
  { id: 'd16', amount_cents: 4500, description: 'Netflix', category_id: 'subs_cat', transaction_date: '2025-12-10' },

  // Novembro 2025
  { id: 'd17', amount_cents: 250000, description: 'Salário Mensal', category_id: 'income_cat', transaction_date: '2025-11-01' },
  { id: 'd18', amount_cents: 85000, description: 'Renda Casa', category_id: 'rent_cat', transaction_date: '2025-11-05' },
  { id: 'd19', amount_cents: 10000, description: 'Ginásio', category_id: 'health_cat', transaction_date: '2025-11-02' },
  { id: 'd20', amount_cents: 30000, description: 'Compra Telemóvel', category_id: 'leisure_cat', transaction_date: '2025-11-15' },
  { id: 'd21', amount_cents: 12000, description: 'Supermercado', category_id: 'food_cat', transaction_date: '2025-11-10' },
  { id: 'd22', amount_cents: 5500, description: 'Gasolina', category_id: 'transport_cat', transaction_date: '2025-11-20' },

  // Outubro 2025
  { id: 'd23', amount_cents: 250000, description: 'Salário Mensal', category_id: 'income_cat', transaction_date: '2025-10-01' },
  { id: 'd24', amount_cents: 85000, description: 'Renda Casa', category_id: 'rent_cat', transaction_date: '2025-10-05' },
  { id: 'd25', amount_cents: 45000, description: 'Concerto', category_id: 'leisure_cat', transaction_date: '2025-10-12' },
  { id: 'd26', amount_cents: 15000, description: 'Supermercado', category_id: 'food_cat', transaction_date: '2025-10-15' },
  { id: 'd27', amount_cents: 7000, description: 'Restaurante Sushi', category_id: 'food_cat', transaction_date: '2025-10-20' },
];

export const DEMO_CATEGORIES = [
  { id: 'income_cat', name: 'Rendimentos', type: 'income', color_hex: '#10b981', vault_type: 'none' },
  { id: 'rent_cat', name: 'Habitação', type: 'expense', color_hex: '#3b82f6', vault_type: 'none' },
  { id: 'subs_cat', name: 'Subscrições', type: 'expense', color_hex: '#8b5cf6', vault_type: 'none' },
  { id: 'food_cat', name: 'Alimentação', type: 'expense', color_hex: '#f59e0b', vault_type: 'none' },
  { id: 'transport_cat', name: 'Transporte', type: 'expense', color_hex: '#ef4444', vault_type: 'none' },
  { id: 'health_cat', name: 'Saúde e Bem-estar', type: 'expense', color_hex: '#10b981', vault_type: 'none' },
  { id: 'leisure_cat', name: 'Lazer e Compras', type: 'expense', color_hex: '#ec4899', vault_type: 'none' },
  { id: 'invest_cat', name: 'Investimentos', type: 'expense', color_hex: '#6366f1', vault_type: 'investment' },
  { id: 'em_cat', name: 'Reserva de Emergência', type: 'expense', color_hex: '#06b6d4', vault_type: 'emergency' },
];

export const DEMO_INSIGHTS = {
  insights: [
    {
      type: 'success',
      title: 'Ecossistema em Expansão',
      message: 'O teu património líquido cresceu 12% nos últimos 3 meses. Estás no caminho certo para a tua meta de poupança.',
      icon: 'sparkles',
    },
    {
      type: 'info',
      title: 'Otimização de Subscrições',
      message: 'Identificámos 4 subscrições ativas (Netflix, Spotify, etc). Se mudares para planos anuais, podes poupar cerca de 24€ por ano.',
      icon: 'zap',
    },
    {
      type: 'warning',
      title: 'Alerta de Lazer',
      message: 'Os teus gastos em "Lazer e Compras" este mês já excedem em 15% a tua média histórica. Considera um período de "No Spend".',
      icon: 'alert-circle',
    },
    {
      type: 'success',
      title: 'Ritmo Semanal Zen',
      message: 'Conseguiste manter os teus gastos de Terça a Quinta abaixo dos 10€ diários. Um excelente hábito de micro-poupança!',
      icon: 'sparkles',
    },
    {
      type: 'info',
      title: 'Dica de Investimento',
      message: 'Com o teu excedente mensal atual, podes atingir a tua meta de Fundo de Emergência 2 meses antes do previsto.',
      icon: 'brain',
    },
  ],
  summary: 'O teu ecossistema financeiro demonstra uma resiliência notável. O foco estratégico deve agora virar-se para a otimização de gastos variáveis e consolidação do fundo de reserva.',
  health_score: 88,
};

export const DEMO_RECURRING = [
  { id: 'r1', description: 'Renda Casa', amount_cents: 85000, day_of_month: 5, process_automatically: true },
  { id: 'r2', description: 'Netflix', amount_cents: 1499, day_of_month: 10, process_automatically: true },
  { id: 'r3', description: 'Spotify', amount_cents: 999, day_of_month: 15, process_automatically: true },
  { id: 'r4', description: 'Ginásio', amount_cents: 3500, day_of_month: 2, process_automatically: false },
  { id: 'r5', description: 'Internet/TV', amount_cents: 4500, day_of_month: 20, process_automatically: true },
];

