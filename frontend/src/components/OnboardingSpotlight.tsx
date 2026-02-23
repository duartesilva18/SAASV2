'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

const STORAGE_KEY = 'onboarding_spotlight_seen';

export function hasSeenOnboardingSpotlight(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function setOnboardingSpotlightSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, '1');
}

export type OnboardingStep = {
  target: string;
  message: string;
  buttonLabel?: string;
};

interface OnboardingSpotlightProps {
  onComplete: () => void | Promise<void>;
  steps: OnboardingStep[];
}

function findVisibleElement(selector: string, requireVisibleSize: boolean): { el: Element; rect: DOMRect } | null {
  const candidates = document.querySelectorAll(selector);
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i].getBoundingClientRect();
    if (!requireVisibleSize || (r.width >= 4 && r.height >= 4)) {
      return { el: candidates[i], rect: r };
    }
  }
  return null;
}

function computeCardPosition(rect: DOMRect) {
  const gap = 16;
  const cardWidth = 280;
  const cardHeight = 120;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;

  let top = rect.top + rect.height / 2 - cardHeight / 2;
  let left = rect.right + gap;

  if (left + cardWidth > vw - 16) left = rect.left - cardWidth - gap;
  if (left < 16) left = 16;
  if (rect.left + rect.width / 2 > vw / 2) {
    left = rect.left - cardWidth - gap;
    if (left < 16) left = Math.max(16, rect.left - cardWidth / 2 + rect.width / 2);
  }
  if (top + cardHeight > vh - 24) top = vh - cardHeight - 24;
  if (top < 24) top = 24;

  return { top, left };
}

export default function OnboardingSpotlight({
  onComplete,
  steps,
}: OnboardingSpotlightProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null);
  const [ready, setReady] = useState(false);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  if (!steps?.length) {
    return null;
  }

  const step = steps[currentStep];
  const selector = step ? `[data-onboarding-target="${step.target}"]` : '';

  const tryMeasure = useCallback(() => {
    const stepsList = stepsRef.current;
    if (currentStep >= stepsList.length || !selector) return;

    // Sidebar e "plans" (badge na sidebar): só elemento visível. Bot/mobile/support: aceitar primeiro match.
    const stepTarget = stepsList[currentStep]?.target ?? '';
    const requireVisible = stepTarget.startsWith('sidebar-') || stepTarget === 'plans';
    const found = findVisibleElement(selector, requireVisible);
    if (found) {
      const padding = 8;
      const tr = new DOMRect(
        found.rect.left - padding,
        found.rect.top - padding,
        found.rect.width + padding * 2,
        found.rect.height + padding * 2
      );
      setTargetRect(tr);
      setCardPosition(computeCardPosition(found.rect));
      return;
    }

    // Elemento não encontrado ou não visível: avançar ou terminar
    if (currentStep < stepsList.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setTargetRect(null);
      setCardPosition(null);
    } else {
      onComplete();
    }
  }, [currentStep, selector, onComplete]);

  // Dar tempo ao DOM (sidebar, header) antes de medir
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || currentStep >= steps.length) return;
    tryMeasure();
    const t1 = setTimeout(tryMeasure, 200);
    const t2 = setTimeout(tryMeasure, 500);
    const t3 = setTimeout(tryMeasure, 900);
    const onResize = () => tryMeasure();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', onResize);
    };
  }, [ready, currentStep, steps.length, tryMeasure]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setTargetRect(null);
      setCardPosition(null);
    } else {
      onComplete();
    }
  };

  if (currentStep >= steps.length || !step || !targetRect || !cardPosition) {
    return null;
  }

  const usePillShape = step.target.startsWith('sidebar-') || step.target === 'upgrade-pro';
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const w = Number(targetRect.width) || 0;
  const h = Number(targetRect.height) || 0;

  // Sidebar e Modo Demo (upgrade-pro): pílula à volta do bloco. Resto: círculo.
  if (usePillShape) {
    const ringPad = 6;
    const holeL = targetRect.left - ringPad;
    const holeT = targetRect.top - ringPad;
    const holeW = w + ringPad * 2;
    const holeH = h + ringPad * 2;
    const pillRx = Math.min(holeW, holeH) / 2;
    const maskId = `spotlight-pill-${currentStep}`;

    return (
      <div
        className="fixed inset-0 z-[10000] pointer-events-auto"
        aria-hidden
      >
        <style>{`[data-onboarding-target] { outline: none !important; box-shadow: none !important; }`}</style>
        <svg width="100%" height="100%" viewBox={`0 0 ${vw} ${vh}`} className="absolute left-0 top-0 pointer-events-none" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          <defs>
            <mask id={maskId}>
              <rect x={0} y={0} width={vw} height={vh} fill="white" />
              <rect x={holeL} y={holeT} width={holeW} height={holeH} rx={pillRx} ry={pillRx} fill="black" />
            </mask>
          </defs>
        </svg>
        <motion.div
          key={currentStep}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/75"
          style={{ WebkitMaskImage: `url(#${maskId})`, maskImage: `url(#${maskId})`, maskSize: '100% 100%' }}
        />
        <motion.div
          key={`ring-${currentStep}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute pointer-events-none"
          style={{
            left: holeL,
            top: holeT,
            width: holeW,
            height: holeH,
            borderRadius: pillRx,
            boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.55)',
            background: 'transparent',
          }}
        />
        <motion.div
          key={`card-${currentStep}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="absolute z-10 pointer-events-auto w-[280px] rounded-2xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-md p-4 shadow-xl"
          style={{ top: cardPosition.top, left: cardPosition.left }}
        >
          <p className="text-sm text-slate-300 leading-snug mb-4">{step.message}</p>
          <button
            type="button"
            onClick={handleNext}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {step.buttonLabel ?? 'Entendi'}
          </button>
        </motion.div>
      </div>
    );
  }

  // Bot / mobile / support: círculo
  const pad = 12;
  const cx = targetRect.left + w / 2;
  const cy = targetRect.top + h / 2;
  const baseSize = Math.max(w, h, 24);
  const ringSize = baseSize + pad * 2;
  const holeR = Math.max(12, ringSize / 2);
  const holeL = cx - holeR;
  const holeT = cy - holeR;
  const maskValue = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${holeR}px, black ${holeR + 1}px)`;

  return (
    <div
      className="fixed inset-0 z-[10000] pointer-events-auto"
      aria-hidden
    >
      <style>{`[data-onboarding-target] { outline: none !important; box-shadow: none !important; }`}</style>
      <motion.div
        key={currentStep}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/75"
        style={{ WebkitMaskImage: maskValue, maskImage: maskValue }}
      />
      <motion.div
        key={`ring-${currentStep}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute pointer-events-none rounded-full"
        style={{
          left: holeL,
          top: holeT,
          width: ringSize,
          height: ringSize,
          boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.55)',
          background: 'transparent',
        }}
      />
      <motion.div
        key={`card-${currentStep}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="absolute z-10 pointer-events-auto w-[280px] rounded-2xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-md p-4 shadow-xl"
        style={{ top: cardPosition.top, left: cardPosition.left }}
      >
        <p className="text-sm text-slate-300 leading-snug mb-4">{step.message}</p>
        <button
          type="button"
          onClick={handleNext}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          {step.buttonLabel ?? 'Entendi'}
        </button>
      </motion.div>
    </div>
  );
}
