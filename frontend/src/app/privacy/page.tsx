'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

export default function PrivacyPage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const lastUpdated = '2026-01-15';
  const privacy = t.legal.privacy;
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
            <ShieldCheck size={32} className="text-blue-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 uppercase">
            {privacy.title.split(' ')[0]} de <span className="text-blue-500 italic">{privacy.titleAccent}</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            {privacy.lastUpdated} {new Date(lastUpdated).toLocaleDateString(dateLocale, { 
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
              {privacy.introduction}
            </p>
          </section>

          {/* 1. Informações que Recolhemos */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">1.</span>
              {privacy.sections.information.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">{privacy.sections.information.account.title}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {privacy.sections.information.account.items.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{privacy.sections.information.financial.title}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {privacy.sections.information.financial.items.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{privacy.sections.information.technical.title}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {privacy.sections.information.technical.items.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{privacy.sections.information.payment.title}</p>
                <p className="ml-4">
                  {privacy.sections.information.payment.text}
                </p>
              </div>
            </div>
          </section>

          {/* 2. Como Utilizamos as Informações */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">2.</span>
              {privacy.sections.usage.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">{privacy.sections.usage.service.title}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {privacy.sections.usage.service.items.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{privacy.sections.usage.improvements.title}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {privacy.sections.usage.improvements.items.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{privacy.sections.usage.communication.title}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {privacy.sections.usage.communication.items.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">{privacy.sections.usage.security.title}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {privacy.sections.usage.security.items.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 3. Base Legal para o Tratamento */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">3.</span>
              {privacy.sections.legalBasis.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{privacy.sections.legalBasis.text}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {privacy.sections.legalBasis.items.map((item: string, index: number) => (
                  <li key={index}><strong className="text-white">{item.split(':')[0]}:</strong> {item.split(':').slice(1).join(':')}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* 4. Partilha de Informações */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">4.</span>
              {privacy.sections.sharing.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <p className="font-semibold text-white mb-2">{privacy.sections.sharing.noSale.title}</p>
              <p>{privacy.sections.sharing.noSale.text}</p>
              
              <div className="mt-4">
                <p className="font-semibold text-white mb-2">{privacy.sections.sharing.providers.title}</p>
                <p>{privacy.sections.sharing.providers.text}</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                  {privacy.sections.sharing.providers.items.map((item: string, index: number) => (
                    <li key={index}><strong className="text-white">{item.split(':')[0]}:</strong> {item.split(':').slice(1).join(':')}</li>
                  ))}
                </ul>
                <p className="mt-2">{privacy.sections.sharing.providers.note}</p>
              </div>

              <div className="mt-4">
                <p className="font-semibold text-white mb-2">{privacy.sections.sharing.legal.title}</p>
                <p>{privacy.sections.sharing.legal.text}</p>
              </div>

              <div className="mt-4">
                <p className="font-semibold text-white mb-2">{privacy.sections.sharing.transfer.title}</p>
                <p>{privacy.sections.sharing.transfer.text}</p>
              </div>
            </div>
          </section>

          {/* 5. Segurança dos Dados */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">5.</span>
              {privacy.sections.security.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{privacy.sections.security.text}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {privacy.sections.security.items.map((item: string, index: number) => (
                  <li key={index}><strong className="text-white">{item.split(':')[0]}:</strong> {item.split(':').slice(1).join(':')}</li>
                ))}
              </ul>
              <p className="mt-4 text-amber-400">
                {privacy.sections.security.warning}
              </p>
            </div>
          </section>

          {/* 6. Retenção de Dados */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">6.</span>
              {privacy.sections.retention.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{privacy.sections.retention.text1}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {privacy.sections.retention.items.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="mt-4">{privacy.sections.retention.text2}</p>
              <p>{privacy.sections.retention.text3}</p>
            </div>
          </section>

          {/* 7. Os Teus Direitos (RGPD) */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">7.</span>
              {privacy.sections.rights.title}
            </h2>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-[24px] p-6 space-y-4">
              <p className="font-semibold text-white">{privacy.sections.rights.intro}</p>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-blue-400 mb-1">{privacy.sections.rights.access.title}</p>
                  <p>{privacy.sections.rights.access.text}</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">{privacy.sections.rights.rectification.title}</p>
                  <p>{privacy.sections.rights.rectification.text}</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">{privacy.sections.rights.erasure.title}</p>
                  <p>{privacy.sections.rights.erasure.text}</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">{privacy.sections.rights.portability.title}</p>
                  <p>{privacy.sections.rights.portability.text}</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">{privacy.sections.rights.objection.title}</p>
                  <p>{privacy.sections.rights.objection.text}</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">{privacy.sections.rights.restriction.title}</p>
                  <p>{privacy.sections.rights.restriction.text}</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">{privacy.sections.rights.withdraw.title}</p>
                  <p>{privacy.sections.rights.withdraw.text}</p>
                </div>
              </div>
              <p className="mt-4 text-sm">
                {privacy.sections.rights.contact} <a href={`mailto:${privacy.sections.contact.email}`} className="text-blue-400 hover:text-blue-300 underline">{privacy.sections.contact.email}</a>
              </p>
            </div>
          </section>

          {/* 8. Cookies */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">8.</span>
              {privacy.sections.cookies.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>{privacy.sections.cookies.text1}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {privacy.sections.cookies.items.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="mt-4">{privacy.sections.cookies.text2}</p>
              <p>{privacy.sections.cookies.text3}</p>
            </div>
          </section>

          {/* 9. Transferências Internacionais */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">9.</span>
              {privacy.sections.transfers.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6">
              <p>{privacy.sections.transfers.text1}</p>
              <p className="mt-2">{privacy.sections.transfers.text2}</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                {privacy.sections.transfers.items.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* 10. Menores de Idade */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">10.</span>
              {privacy.sections.minors.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6">
              <p>{privacy.sections.minors.text1}</p>
              <p className="mt-2">{privacy.sections.minors.text2}</p>
            </div>
          </section>

          {/* 11. Alterações à Política */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">11.</span>
              {privacy.sections.changes.title}
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6">
              <p>{privacy.sections.changes.text1}</p>
              <p className="mt-2">{privacy.sections.changes.text2}</p>
              <p className="mt-2">{privacy.sections.changes.text3}</p>
            </div>
          </section>

          {/* 12. Contacto */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">12.</span>
              {privacy.sections.contact.title}
            </h2>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-[24px] p-6">
              <p className="mb-4">{privacy.sections.contact.text}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-blue-500" />
                  <a href={`mailto:${privacy.sections.contact.email}`} className="text-blue-400 hover:text-blue-300 underline">
                    {privacy.sections.contact.email}
                  </a>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                {privacy.sections.contact.complaint}
              </p>
            </div>
          </section>

          {/* Footer */}
          <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            <p>{privacy.footer.copyright.replace('{year}', new Date().getFullYear().toString())}</p>
            <div className="flex justify-center gap-6 mt-4">
              <Link href="/privacy" className="text-blue-500 hover:text-blue-400 underline">
                {privacy.footer.privacyLink}
              </Link>
              <Link href="/terms" className="text-blue-500 hover:text-blue-400 underline">
                {privacy.footer.termsLink}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
