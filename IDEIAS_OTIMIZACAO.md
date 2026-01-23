# 🚀 Ideias de Otimização - Performance Máxima

**Data:** 2025-01-27  
**Objetivo:** Reduzir tempo de carregamento das páginas ao máximo

---

## 🔥 PRIORIDADE 1: Crítico (Alto Impacto, Fácil Implementação)

### 1.1 Usar `/dashboard/snapshot` em vez de múltiplas chamadas

**Problema atual:**
```typescript
// Dashboard faz 4 chamadas separadas
const [profileRes, transRes, catRes, invoicesRes] = await Promise.all([
  api.get('/auth/me'),
  api.get('/transactions/?limit=100'),
  api.get('/categories/'),
  api.get('/stripe/invoices')
]);
```

**Solução:**
```typescript
// 1 chamada otimizada
const snapshotRes = await api.get('/dashboard/snapshot');
const { snapshot, collections, currency } = snapshotRes.data;
// Usar snapshot calculado pelo backend (sem cálculos no frontend)
```

**Ganho:** 75% menos chamadas API, ~300ms mais rápido

---

### 1.2 Remover `minLoadingTime` artificial

**Problema atual:**
```typescript
const minLoadingTime = new Promise(resolve => setTimeout(resolve, 1000));
await minLoadingTime; // Força 1 segundo de loading mesmo com cache
```

**Solução:**
```typescript
// Remover completamente
// Se dados estão prontos, mostrar imediatamente
```

**Ganho:** 1 segundo instantâneo se cache hit

---

### 1.3 Implementar React Query ou SWR

**Problema atual:**
- Sem cache inteligente entre páginas
- Refetch desnecessário
- Sem deduplicação de requests

**Solução:**
```typescript
import useSWR from 'swr';

// Cache automático, deduplicação, refetch inteligente
const { data: snapshot } = useSWR('/dashboard/snapshot', api.get, {
  revalidateOnFocus: false,
  dedupingInterval: 60000, // 1 minuto
  refreshInterval: 0 // Não auto-refresh
});
```

**Ganho:** Cache entre páginas, 0ms se já carregado

---

### 1.4 Lazy Loading de Componentes Pesados

**Problema atual:**
- Todos os componentes carregam de uma vez
- Charts (Recharts) bloqueiam renderização

**Solução:**
```typescript
// Lazy load de charts
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

// Lazy load de modais
const PricingModal = dynamic(() => import('@/components/PricingModal'), {
  ssr: false
});
```

**Ganho:** 50-70% menos bundle inicial, renderização mais rápida

---

## ⚡ PRIORIDADE 2: Alto Impacto (Médio Esforço)

### 2.1 Code Splitting por Rota

**Problema atual:**
- Toda a aplicação carrega no primeiro load
- Analytics, FIRE, Vault carregam mesmo sem visitar

**Solução:**
```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
  // Code splitting automático por rota já existe no Next.js
  // Mas podemos otimizar mais:
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
        recharts: {
          test: /[\\/]node_modules[\\/]recharts[\\/]/,
          name: 'recharts',
          priority: 20,
        },
      },
    };
    return config;
  },
};
```

**Ganho:** 40-60% menos bundle inicial

---

### 2.2 Virtualização de Listas Longas

**Problema atual:**
- Transactions page renderiza todas as transações
- Analytics renderiza todos os pontos do gráfico

**Solução:**
```typescript
import { FixedSizeList } from 'react-window';

// Renderizar apenas items visíveis
<FixedSizeList
  height={600}
  itemCount={transactions.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <TransactionRow transaction={transactions[index]} />
    </div>
  )}
</FixedSizeList>
```

**Ganho:** 90% menos DOM nodes, scroll mais fluido

---

### 2.3 Memoização Agressiva

**Problema atual:**
- Cálculos repetidos em cada render
- Componentes re-renderizam desnecessariamente

**Solução:**
```typescript
// Memoizar cálculos pesados
const stats = useMemo(() => {
  return calculateStats(transactions, categories);
}, [transactions, categories]);

// Memoizar componentes
const TransactionRow = React.memo(({ transaction }) => {
  // ...
}, (prev, next) => prev.transaction.id === next.transaction.id);

// Memoizar callbacks
const handleDelete = useCallback((id: string) => {
  // ...
}, []);
```

**Ganho:** 30-50% menos re-renders

---

### 2.4 Debounce em Pesquisas e Filtros

**Problema atual:**
- Cada keystroke dispara filtro
- Recalcula lista inteira

**Solução:**
```typescript
import { useDebouncedValue } from '@mantine/hooks';

const [searchTerm, setSearchTerm] = useState('');
const [debouncedSearch] = useDebouncedValue(searchTerm, 300);

// Usar debouncedSearch nos filtros
const filtered = useMemo(() => {
  return transactions.filter(t => 
    t.description.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
}, [transactions, debouncedSearch]);
```

**Ganho:** 80% menos cálculos durante digitação

---

## 🎯 PRIORIDADE 3: Médio Impacto (Baixo Esforço)

### 3.1 Prefetch de Dados em Background

**Problema atual:**
- Dados só carregam quando página é visitada
- Navegação entre páginas é lenta

**Solução:**
```typescript
// Prefetch ao hover no link
<Link 
  href="/analytics"
  onMouseEnter={() => {
    router.prefetch('/analytics');
    // Prefetch dados também
    api.get('/insights/composite').then(data => {
      // Guardar em cache
      cache.set('analytics_data', data);
    });
  }}
>
  Analytics
</Link>
```

**Ganho:** Páginas carregam instantaneamente ao clicar

---

### 3.2 Service Worker para Cache Offline

**Problema atual:**
- Sem cache offline
- Recarrega tudo a cada visita

**Solução:**
```typescript
// next.config.ts
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\./,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60, // 1 hora
        },
      },
    },
  ],
});
```

**Ganho:** Carregamento instantâneo em visitas subsequentes

---

### 3.3 Otimizar Imagens e Assets

**Problema atual:**
- Imagens não otimizadas
- Ícones grandes

**Solução:**
```typescript
// Usar next/image para otimização automática
import Image from 'next/image';

<Image
  src="/logo.png"
  width={200}
  height={50}
  priority // Para above-the-fold
  alt="Logo"
/>

// Usar SVG para ícones (já está a usar lucide-react ✅)
```

**Ganho:** 20-40% menos dados transferidos

---

### 3.4 Remover Intervalos Desnecessários

**Problema atual:**
```typescript
// Transactions page atualiza a cada 60s mesmo sem necessidade
const interval = setInterval(() => {
  fetchData();
}, 60000);
```

**Solução:**
```typescript
// Apenas atualizar se página está visível
useEffect(() => {
  if (document.hidden) return;
  
  const interval = setInterval(() => {
    if (!document.hidden) {
      fetchData();
    }
  }, 60000);
  
  return () => clearInterval(interval);
}, []);
```

**Ganho:** Menos requests desnecessários

---

## 🔧 PRIORIDADE 4: Melhorias Técnicas

### 4.1 Streaming SSR (Next.js 13+)

**Problema atual:**
- SSR bloqueia até tudo estar pronto

**Solução:**
```typescript
// Usar Suspense e streaming
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
```

**Ganho:** Time to First Byte mais rápido

---

### 4.2 Bundle Analysis

**Problema atual:**
- Não sabemos o que está a pesar no bundle

**Solução:**
```bash
# Instalar
npm install --save-dev @next/bundle-analyzer

# next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

# Executar
ANALYZE=true npm run build
```

**Ganho:** Identificar e remover dependências pesadas

---

### 4.3 Otimizar Recharts

**Problema atual:**
- Recharts é pesado (~200KB)
- Carrega mesmo quando não usado

**Solução:**
```typescript
// Tree-shaking agressivo
import AreaChart from 'recharts/es6/chart/AreaChart';
import Area from 'recharts/es6/cartesian/Area';
// Em vez de import { AreaChart, Area } from 'recharts';

// Ou usar alternativa mais leve
import { LineChart, Line } from 'chart.js/react-chartjs-2'; // Mais leve
```

**Ganho:** 50-70% menos bundle se usar alternativa

---

## 📊 Priorização por Impacto vs Esforço

| Otimização | Impacto | Esforço | Prioridade |
|------------|---------|---------|------------|
| Usar `/dashboard/snapshot` | 🔥🔥🔥 | ⚡⚡ | **1** |
| Remover `minLoadingTime` | 🔥🔥🔥 | ⚡ | **1** |
| React Query/SWR | 🔥🔥🔥 | ⚡⚡ | **1** |
| Lazy Loading | 🔥🔥 | ⚡⚡ | **1** |
| Code Splitting | 🔥🔥 | ⚡⚡⚡ | **2** |
| Virtualização | 🔥🔥 | ⚡⚡⚡ | **2** |
| Memoização | 🔥 | ⚡⚡ | **2** |
| Debounce | 🔥 | ⚡ | **2** |
| Prefetch | 🔥 | ⚡⚡ | **3** |
| Service Worker | 🔥 | ⚡⚡⚡ | **3** |
| Otimizar Imagens | 🔥 | ⚡ | **3** |

---

## 🎯 Plano de Ação Recomendado

### Semana 1 (Quick Wins)
1. ✅ Usar `/dashboard/snapshot`
2. ✅ Remover `minLoadingTime`
3. ✅ Implementar React Query/SWR
4. ✅ Lazy loading de charts

**Ganho esperado:** 60-70% mais rápido

### Semana 2 (Otimizações Médias)
5. ✅ Code splitting otimizado
6. ✅ Memoização agressiva
7. ✅ Debounce em pesquisas
8. ✅ Remover intervalos desnecessários

**Ganho esperado:** +20-30% mais rápido

### Semana 3 (Polimento)
9. ✅ Virtualização de listas
10. ✅ Prefetch inteligente
11. ✅ Bundle analysis e otimização
12. ✅ Service Worker (opcional)

**Ganho esperado:** +10-20% mais rápido

---

## 📈 Métricas de Sucesso

**Antes:**
- Dashboard: ~2-3s primeiro load
- Analytics: ~3-4s primeiro load
- Navegação: ~1-2s entre páginas

**Depois (objetivo):**
- Dashboard: ~0.5-1s primeiro load
- Analytics: ~1-1.5s primeiro load
- Navegação: ~0.2-0.5s entre páginas

**Ganho total esperado:** 70-80% mais rápido

---

## 🚨 Problemas Identificados

### 1. Múltiplas Chamadas API
- Dashboard: 4 chamadas
- Analytics: 2 chamadas
- Transactions: 2 chamadas
- **Solução:** Usar endpoints compostos

### 2. Cálculos no Frontend
- Dashboard recalcula tudo do zero
- Analytics recalcula tudo do zero
- **Solução:** Usar snapshot do backend

### 3. Sem Cache Inteligente
- Cada página busca dados novamente
- Sem deduplicação
- **Solução:** React Query/SWR

### 4. Bundle Grande
- Recharts pesado
- Framer Motion pesado
- **Solução:** Lazy loading + code splitting

### 5. Re-renders Desnecessários
- Componentes re-renderizam sem necessidade
- Cálculos repetidos
- **Solução:** Memoização

---

**Documento criado em:** 2025-01-27

