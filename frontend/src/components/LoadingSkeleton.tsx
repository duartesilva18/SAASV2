'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function ChartSkeleton() {
  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-5 h-5 bg-slate-700 rounded-lg" />
        <div className="h-4 bg-slate-700 rounded w-48" />
      </div>
      <div className="space-y-3">
        <div className="h-32 bg-slate-800 rounded-xl" />
        <div className="h-4 bg-slate-700 rounded w-3/4" />
        <div className="h-4 bg-slate-700 rounded w-1/2" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 bg-slate-800 rounded-xl w-64" />
        <div className="h-10 bg-slate-800 rounded-xl w-32" />
      </div>

      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6"
          >
            <div className="h-4 bg-slate-700 rounded w-24 mb-4" />
            <div className="h-8 bg-slate-800 rounded w-32 mb-2" />
            <div className="h-3 bg-slate-700 rounded w-20" />
          </motion.div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Transactions Skeleton */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6">
        <div className="h-6 bg-slate-700 rounded w-48 mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-700 rounded-xl" />
                <div>
                  <div className="h-4 bg-slate-700 rounded w-32 mb-2" />
                  <div className="h-3 bg-slate-800 rounded w-24" />
                </div>
              </div>
              <div className="h-4 bg-slate-700 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TransactionSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-transparent animate-pulse"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-700 rounded-xl" />
            <div>
              <div className="h-4 bg-slate-700 rounded w-32 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-24" />
            </div>
          </div>
          <div className="h-4 bg-slate-700 rounded w-20" />
        </motion.div>
      ))}
    </div>
  );
}

