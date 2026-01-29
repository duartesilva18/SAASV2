'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Mail, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

export default function TermsPage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const lastUpdated = '2026-01-15';
  const terms = t.legal.terms;
  const dateLocale = language === 'pt' ? 'pt-PT' : language === 'fr' ? 'fr-FR' : 'en-US';

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Back button - mobile only */}
      <div className="md:hidden fixed top-4 left-4 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 text-white hover:bg-slate-700/80 transition-colors"
          aria-label={t.auth?.login?.backToHome ?? 'Voltar'}
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/10 rounded-2xl mb-6 border border-blue-500/20">
            <FileText size={32} className="text-blue-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 uppercase">
            {terms.title.split(' ')[0]} <span className="text-blue-500 italic">{terms.titleAccent}</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            {terms.lastUpdated} {new Date(lastUpdated).toLocaleDateString(dateLocale, { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-slate-300 leading-relaxed">
          {/* Introdução */}
          <section className="bg-slate-900/30 border border-slate-800 rounded-[32px] p-8">
            <p className="text-base leading-relaxed">
              {terms.introduction}
            </p>
          </section>

          {/* 1. Definições */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">1.</span>
              {terms.sections.definitions.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.definitions.service.title}</p>
                <p>{terms.sections.definitions.service.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.definitions.user.title}</p>
                <p>{terms.sections.definitions.user.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.definitions.we.title}</p>
                <p>{terms.sections.definitions.we.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.definitions.account.title}</p>
                <p>{terms.sections.definitions.account.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.definitions.content.title}</p>
                <p>{terms.sections.definitions.content.text}</p>
              </div>
            </div>
          </section>

          {/* 2. Aceitação dos Termos */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">2.</span>
              {terms.sections.acceptance.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{terms.sections.acceptance.text}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {terms.sections.acceptance.items.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* 3. Descrição do Serviço */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">3.</span>
              {terms.sections.service.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{terms.sections.service.text}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {terms.sections.service.items.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="mt-4">{terms.sections.service.note}</p>
            </div>
          </section>

          {/* 4. Planos e Pagamentos */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">4.</span>
              {terms.sections.plans.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.plans.available.title}</p>
                <p>{terms.sections.plans.available.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.plans.payments.title}</p>
                <p>{terms.sections.plans.payments.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.plans.renewal.title}</p>
                <p>{terms.sections.plans.renewal.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.plans.cancellation.title}</p>
                <p>{terms.sections.plans.cancellation.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.plans.refunds.title}</p>
                <p>{terms.sections.plans.refunds.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.plans.priceChanges.title}</p>
                <p>{terms.sections.plans.priceChanges.text}</p>
              </div>
            </div>
          </section>

          {/* 5. Privacidade e Dados */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">5.</span>
              {terms.sections.privacy.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{terms.sections.privacy.text1} <Link href="/privacy" className="text-blue-500 hover:text-blue-400 underline">{terms.sections.privacy.privacyLink}</Link>.</p>
              <p>{terms.sections.privacy.text2}</p>
              <p>{terms.sections.privacy.text3}</p>
              <p>{terms.sections.privacy.text4}</p>
            </div>
          </section>

          {/* 6. Responsabilidades do Utilizador */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">6.</span>
              {terms.sections.responsibilities.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.responsibilities.properUse.title}</p>
                <p>{terms.sections.responsibilities.properUse.text}</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                  {terms.sections.responsibilities.properUse.items.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.responsibilities.accuracy.title}</p>
                <p>{terms.sections.responsibilities.accuracy.text}</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{terms.sections.responsibilities.security.title}</p>
                <p>{terms.sections.responsibilities.security.text}</p>
              </div>
            </div>
          </section>

          {/* 7. Propriedade Intelectual */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">7.</span>
              {terms.sections.intellectual.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{terms.sections.intellectual.text1}</p>
              <p>{terms.sections.intellectual.text2}</p>
              <p>{terms.sections.intellectual.text3}</p>
            </div>
          </section>

          {/* 8. Limitação de Responsabilidade */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">8.</span>
              {terms.sections.liability.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{terms.sections.liability.text1}</p>
              <p>{terms.sections.liability.text2}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {terms.sections.liability.items.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="mt-4">{terms.sections.liability.text3}</p>
            </div>
          </section>

          {/* 9. Modificações do Serviço */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">9.</span>
              {terms.sections.modifications.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{terms.sections.modifications.text1}</p>
              <p>{terms.sections.modifications.text2}</p>
              <p>{terms.sections.modifications.text3}</p>
            </div>
          </section>

          {/* 10. Rescisão */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">10.</span>
              {terms.sections.termination.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{terms.sections.termination.text1}</p>
              <p>{terms.sections.termination.text2}</p>
              <p>{terms.sections.termination.text3}</p>
              <p>{terms.sections.termination.text4}</p>
            </div>
          </section>

          {/* 11. Lei Aplicável */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">11.</span>
              {terms.sections.law.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6">
              <p>{terms.sections.law.text1}</p>
              <p>{terms.sections.law.text2}</p>
            </div>
          </section>

          {/* 12. Contacto */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">12.</span>
              {terms.sections.contact.title}
            </h2>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-[24px] p-6">
              <p className="mb-4">{terms.sections.contact.text}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-blue-500" />
                  <a href={`mailto:${terms.sections.contact.email}`} className="text-blue-400 hover:text-blue-300 underline">
                    {terms.sections.contact.email}
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            <p>{terms.footer.copyright.replace('{year}', new Date().getFullYear().toString())}</p>
            <div className="flex justify-center gap-6 mt-4">
              <Link href="/privacy" className="text-blue-500 hover:text-blue-400 underline">
                {terms.footer.privacyLink}
              </Link>
              <Link href="/terms" className="text-blue-500 hover:text-blue-400 underline">
                {terms.footer.termsLink}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
