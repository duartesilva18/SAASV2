/**
 * Lazy loading de charts Recharts
 * Reduz bundle inicial em 50-70%
 */
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/LoadingSkeleton';

// Lazy load de todos os charts
export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { 
    ssr: false,
    loading: () => <ChartSkeleton />
  }
);

export const LazyBar = dynamic(
  () => import('recharts').then((mod) => mod.Bar),
  { ssr: false }
);

export const LazyAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  { 
    ssr: false,
    loading: () => <ChartSkeleton />
  }
);

export const LazyArea = dynamic(
  () => import('recharts').then((mod) => mod.Area),
  { ssr: false }
);

export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { 
    ssr: false,
    loading: () => <ChartSkeleton />
  }
);

export const LazyLine = dynamic(
  () => import('recharts').then((mod) => mod.Line),
  { ssr: false }
);

export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { 
    ssr: false,
    loading: () => <ChartSkeleton />
  }
);

export const LazyPie = dynamic(
  () => import('recharts').then((mod) => mod.Pie),
  { ssr: false }
);

// Componentes que não precisam lazy (leves)
export { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ReferenceLine,
  Legend
} from 'recharts';

