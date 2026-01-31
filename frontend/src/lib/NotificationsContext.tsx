'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@/lib/UserContext';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';

const DISMISSED_KEY = 'sidebar_dismissed_notification_ids';
const DISMISSED_MAX = 200;

function getDismissedIds(): string[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(DISMISSED_KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.slice(-DISMISSED_MAX) : [];
  } catch {
    return [];
  }
}

function addDismissedIds(ids: string[]) {
  if (ids.length === 0) return;
  const current = getDismissedIds();
  const next = [...new Set([...current, ...ids])].slice(-DISMISSED_MAX);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
}

interface NotificationsContextValue {
  notifications: any[];
  hasCritical: boolean;
  showNotifications: boolean;
  setShowNotifications: (v: boolean) => void;
  handleMarkAsRead: (id: string) => void;
  handleClearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasCritical, setHasCritical] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleMarkAsRead = useCallback((id: string) => {
    addDismissedIds([id]);
    setNotifications(prev => {
      const next = prev.filter(n => n.id !== id);
      setHasCritical(next.some((n: any) => n.type === 'danger'));
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setNotifications(prev => {
      const ids = prev.map(n => n.id).filter(Boolean);
      addDismissedIds(ids);
      setHasCritical(false);
      return [];
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = typeof window !== 'undefined' && (localStorage.getItem('token') || sessionStorage.getItem('token'));
    if (!token) return;

    const formatPrice = (val: number) =>
      new Intl.NumberFormat('pt-PT', { style: 'currency', currency: user?.currency || 'EUR' }).format(val);

    const fetchNotifications = async () => {
      try {
        const [insightsRes, recurringRes, invoicesRes, goalsRes] = await Promise.all([
          api.get('/insights/'),
          api.get('/recurring/'),
          api.get('/stripe/invoices'),
          api.get('/goals/').catch(() => ({ data: [] })),
        ]);

        const newNotifications: any[] = [];
        const s = t?.dashboard?.sidebar;

        (insightsRes.data?.insights || []).forEach((ins: any) => {
          if (ins.type === 'danger' || ins.type === 'warning' || ins.type === 'info') {
            newNotifications.push({
              id: `ins-${ins.title}-${(ins.message || '').slice(0, 8)}`,
              title: ins.title,
              message: ins.message,
              type: ins.type,
              icon: ins.icon,
              date: s?.now || 'Agora',
              section: '/analytics',
            });
          }
        });

        const today = new Date().getDate();
        (recurringRes.data || []).forEach((rec: any) => {
          const diff = rec.day_of_month - today;
          if (diff >= 0 && diff <= 7) {
            newNotifications.push({
              id: `rec-${rec.id}`,
              title: diff === 0 ? (s?.dueToday || 'Vence hoje') : (s?.dueInDays || 'Vence em {days} dias').replace('{days}', String(diff)),
              message: (s?.subscriptionDue || '{description} - {amount}')
                .replace('{description}', rec.description)
                .replace('{amount}', formatPrice(rec.amount_cents / 100)),
              type: diff <= 1 ? 'warning' : 'info',
              icon: 'clock',
              date: s?.next || 'Próximo',
              section: '/recurring',
            });
          }
        });

        const hasUnpaid = (invoicesRes.data || []).some((inv: any) =>
          inv.status?.toLowerCase() === 'unpaid' || (inv.status?.toLowerCase() === 'open' && inv.amount_due > 0)
        );
        if (hasUnpaid) {
          newNotifications.push({
            id: 'stripe-unpaid',
            title: s?.paymentFailed || 'Pagamento em falha',
            message: s?.unpaidInvoice || 'Tens uma fatura em aberto.',
            type: 'danger',
            icon: 'credit-card',
            date: s?.urgent || 'Urgente',
            section: '/billing',
          });
        }

        const completedGoals = (goalsRes.data || []).filter(
          (g: any) => g.target_amount_cents > 0 && g.current_amount_cents >= g.target_amount_cents
        );
        completedGoals.forEach((goal: any) => {
          const goalAmount = formatPrice(goal.target_amount_cents / 100);
          newNotifications.push({
            id: `goal-completed-${goal.id}`,
            title: t.dashboard.goals.notificationTitle || '🎯 Meta Concluída!',
            message: (t.dashboard.goals.notificationMessage || 'Parabéns! Atingiste a meta "{name}" de {amount}')
              .replace('{name}', goal.name)
              .replace('{amount}', goalAmount),
            type: 'success',
            icon: 'trophy',
            date: s?.now || (t.dashboard?.page?.now || 'Agora'),
            section: '/goals',
          });
        });

        (goalsRes.data || []).forEach((goal: any) => {
          if (!goal.target_amount_cents || goal.target_amount_cents <= 0) return;
          const pct = Math.round((goal.current_amount_cents / goal.target_amount_cents) * 100);
          if (pct >= 80 && pct < 100 && !completedGoals?.some((g: any) => g.id === goal.id)) {
            newNotifications.push({
              id: `goal-almost-${goal.id}`,
              title: s?.goalAlmostReached || 'Meta quase atingida',
              message: (s?.goalAlmostReachedMessage || '{name} está a {pct}% do objetivo.')
                .replace('{name}', goal.name || '')
                .replace('{pct}', String(pct)),
              type: 'info',
              icon: 'target',
              date: s?.next || 'Próximo',
              section: '/goals',
            });
          }
        });

        const dismissedIds = getDismissedIds();
        const filtered = newNotifications.filter((n: any) => !dismissedIds.includes(n.id));

        if (filtered.length === 0 && !dismissedIds.includes('welcome')) {
          filtered.push({
            id: 'welcome',
            title: s?.systemOperational || 'Sistema operacional',
            message: s?.zenHarmony || 'Tudo em harmonia.',
            type: 'success',
            icon: 'sparkles',
            date: s?.now || 'Agora',
          });
        }

        setNotifications(filtered);
        setHasCritical(filtered.some((n: any) => n.type === 'danger'));
      } catch (err: any) {
        if (err?.response?.status === 401) return;
        console.error('Erro ao carregar notificações:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user, t]);

  const value: NotificationsContextValue = {
    notifications,
    hasCritical,
    showNotifications,
    setShowNotifications,
    handleMarkAsRead,
    handleClearAll,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
