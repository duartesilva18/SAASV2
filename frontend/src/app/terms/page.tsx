import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, FileText, Calendar, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos e Condições',
  description: 'Termos e Condições de utilização do Finly - Gestão Financeira Pessoal',
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsPage() {
  const lastUpdated = '2026-01-15';

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/10 rounded-2xl mb-6 border border-blue-500/20">
            <FileText size={32} className="text-blue-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 uppercase">
            Termos e <span className="text-blue-500 italic">Condições</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Última atualização: {new Date(lastUpdated).toLocaleDateString('pt-PT', { 
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
              Bem-vindo ao <strong className="text-white">Finly</strong>. Ao acederes e utilizares a nossa plataforma, 
              concordas em cumprir e estar vinculado aos seguintes Termos e Condições. Se não concordares com 
              qualquer parte destes termos, não deves utilizar os nossos serviços.
            </p>
          </section>

          {/* 1. Definições */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">1.</span>
              Definições
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">1.1. "Serviço" ou "Plataforma"</p>
                <p>Refere-se ao Finly, incluindo o website, aplicação web, bot do Telegram e todos os serviços relacionados.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">1.2. "Utilizador" ou "Tu"</p>
                <p>Refere-se à pessoa que acede ou utiliza o Serviço.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">1.3. "Nós", "Nosso" ou "Finly"</p>
                <p>Refere-se à entidade que fornece o Serviço.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">1.4. "Conta"</p>
                <p>Refere-se à conta criada pelo Utilizador para aceder ao Serviço.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">1.5. "Conteúdo"</p>
                <p>Refere-se a todos os dados, informações, textos, gráficos e outros materiais fornecidos através do Serviço.</p>
              </div>
            </div>
          </section>

          {/* 2. Aceitação dos Termos */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">2.</span>
              Aceitação dos Termos
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>2.1. Ao criar uma conta, aceder ou utilizar o Finly, confirmas que:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Tens pelo menos 18 anos de idade ou tens autorização de um responsável legal;</li>
                <li>Tens capacidade legal para celebrar contratos vinculativos;</li>
                <li>Vais fornecer informações precisas, atuais e completas durante o registo;</li>
                <li>Vais manter a segurança da tua conta e palavra-passe;</li>
                <li>És responsável por todas as atividades que ocorram sob a tua conta.</li>
              </ul>
            </div>
          </section>

          {/* 3. Descrição do Serviço */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">3.</span>
              Descrição do Serviço
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>3.1. O Finly é uma plataforma de gestão financeira pessoal que permite:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Registar despesas e receitas através do Telegram ou interface web;</li>
                <li>Visualizar gráficos e análises dos teus dados financeiros;</li>
                <li>Categorizar transações automaticamente;</li>
                <li>Gerir orçamentos e metas de poupança;</li>
                <li>Exportar dados financeiros.</li>
              </ul>
              <p className="mt-4">3.2. O Finly não é um serviço bancário, não processa pagamentos e não tem acesso às tuas contas bancárias.</p>
            </div>
          </section>

          {/* 4. Planos e Pagamentos */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">4.</span>
              Planos e Pagamentos
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">4.1. Planos Disponíveis</p>
                <p>O Finly oferece planos gratuitos e pagos. Os detalhes dos planos, preços e funcionalidades estão disponíveis na página de preços.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">4.2. Pagamentos</p>
                <p>Os pagamentos são processados através do Stripe. Ao subscreveres um plano pago, autorizas-nos a cobrar o valor na periodicidade escolhida (mensal ou anual).</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">4.3. Renovação Automática</p>
                <p>As subscrições renovam-se automaticamente no final de cada período, a menos que canceles antes da data de renovação.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">4.4. Cancelamento</p>
                <p>Podes cancelar a tua subscrição a qualquer momento através das definições da conta. O cancelamento entra em vigor no final do período pago atual.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">4.5. Reembolsos</p>
                <p>Oferecemos uma garantia de reembolso de 7 dias a partir da data de subscrição inicial. Após este período, não são oferecidos reembolsos, exceto quando exigido por lei.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">4.6. Alterações de Preço</p>
                <p>Reservamo-nos o direito de alterar os preços a qualquer momento. As alterações não afetam subscrições já ativas durante o período pago.</p>
              </div>
            </div>
          </section>

          {/* 5. Privacidade e Dados */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">5.</span>
              Privacidade e Proteção de Dados
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>5.1. O tratamento dos teus dados pessoais é regido pela nossa <Link href="/privacy" className="text-blue-500 hover:text-blue-400 underline">Política de Privacidade</Link>.</p>
              <p>5.2. Utilizamos encriptação de ponta a ponta para proteger os teus dados financeiros.</p>
              <p>5.3. Nunca solicitamos ou armazenamos palavras-passe bancárias ou dados de cartões de crédito (exceto através do Stripe para pagamentos).</p>
              <p>5.4. Os teus dados financeiros são privados e não são partilhados com terceiros, exceto conforme descrito na Política de Privacidade.</p>
            </div>
          </section>

          {/* 6. Responsabilidades do Utilizador */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">6.</span>
              Responsabilidades do Utilizador
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">6.1. Uso Adequado</p>
                <p>Concordas em utilizar o Serviço apenas para fins legais e de acordo com estes Termos. Não deves:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                  <li>Utilizar o Serviço de forma fraudulenta ou ilegal;</li>
                  <li>Tentar aceder não autorizado a contas de outros utilizadores;</li>
                  <li>Interferir ou perturbar o funcionamento do Serviço;</li>
                  <li>Transmitir vírus, malware ou código malicioso;</li>
                  <li>Copiar, modificar ou criar trabalhos derivados do Serviço sem autorização.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">6.2. Precisão dos Dados</p>
                <p>És responsável pela precisão e integridade dos dados que introduzes no Finly. Não nos responsabilizamos por decisões tomadas com base em dados incorretos ou incompletos.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">6.3. Segurança da Conta</p>
                <p>És responsável por manter a confidencialidade da tua palavra-passe e por todas as atividades que ocorram sob a tua conta.</p>
              </div>
            </div>
          </section>

          {/* 7. Propriedade Intelectual */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">7.</span>
              Propriedade Intelectual
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>7.1. Todo o conteúdo do Finly, incluindo mas não limitado a texto, gráficos, logos, ícones, imagens, software e código, é propriedade do Finly ou dos seus fornecedores de conteúdo e está protegido por leis de direitos autorais.</p>
              <p>7.2. És concedido uma licença limitada, não exclusiva e não transferível para aceder e utilizar o Serviço para uso pessoal e não comercial.</p>
              <p>7.3. Os teus dados financeiros são da tua propriedade. Concedes-nos uma licença para utilizar, processar e armazenar estes dados apenas para fornecer o Serviço.</p>
            </div>
          </section>

          {/* 8. Limitação de Responsabilidade */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">8.</span>
              Limitação de Responsabilidade
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>8.1. O Finly é fornecido "como está" e "conforme disponível". Não garantimos que o Serviço será ininterrupto, livre de erros ou completamente seguro.</p>
              <p>8.2. Não nos responsabilizamos por:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Perda de dados resultante de falhas técnicas ou de segurança;</li>
                <li>Decisões financeiras tomadas com base nos dados do Finly;</li>
                <li>Danos indiretos, incidentais ou consequenciais;</li>
                <li>Interrupções temporárias do Serviço devido a manutenção ou atualizações.</li>
              </ul>
              <p className="mt-4">8.3. A nossa responsabilidade total não excederá o valor pago por ti nos últimos 12 meses.</p>
            </div>
          </section>

          {/* 9. Modificações do Serviço */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">9.</span>
              Modificações do Serviço e Termos
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>9.1. Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer parte do Serviço a qualquer momento, com ou sem aviso prévio.</p>
              <p>9.2. Podemos atualizar estes Termos periodicamente. As alterações significativas serão comunicadas através do email associado à tua conta ou através de um aviso no Serviço.</p>
              <p>9.3. O uso continuado do Serviço após alterações constitui aceitação dos novos Termos.</p>
            </div>
          </section>

          {/* 10. Rescisão */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">10.</span>
              Rescisão
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>10.1. Podes encerrar a tua conta a qualquer momento através das definições da conta.</p>
              <p>10.2. Podemos suspender ou encerrar a tua conta imediatamente se violares estes Termos ou se utilizares o Serviço de forma ilegal ou fraudulenta.</p>
              <p>10.3. Após a rescisão, o teu acesso ao Serviço será imediatamente revogado. Podes solicitar uma cópia dos teus dados antes do encerramento da conta.</p>
              <p>10.4. As secções que por natureza devem sobreviver (incluindo Propriedade Intelectual, Limitação de Responsabilidade) continuarão em vigor após a rescisão.</p>
            </div>
          </section>

          {/* 11. Lei Aplicável */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">11.</span>
              Lei Aplicável e Jurisdição
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6">
              <p>11.1. Estes Termos são regidos pelas leis de Portugal.</p>
              <p>11.2. Qualquer disputa relacionada com estes Termos será resolvida nos tribunais competentes de Portugal.</p>
            </div>
          </section>

          {/* 12. Contacto */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">12.</span>
              Contacto
            </h2>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-[24px] p-6">
              <p className="mb-4">Para questões sobre estes Termos e Condições, podes contactar-nos:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-blue-500" />
                  <a href="mailto:legal@finly.pt" className="text-blue-400 hover:text-blue-300 underline">
                    legal@finly.pt
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            <p>© {new Date().getFullYear()} Finly. Todos os direitos reservados.</p>
            <div className="flex justify-center gap-6 mt-4">
              <Link href="/privacy" className="text-blue-500 hover:text-blue-400 underline">
                Política de Privacidade
              </Link>
              <Link href="/terms" className="text-blue-500 hover:text-blue-400 underline">
                Termos e Condições
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
