import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Lock, Eye, Database, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Política de Privacidade do Finly - Como protegemos e tratamos os teus dados pessoais',
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPage() {
  const lastUpdated = '2026-01-15';

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/10 rounded-2xl mb-6 border border-blue-500/20">
            <ShieldCheck size={32} className="text-blue-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 uppercase">
            Política de <span className="text-blue-500 italic">Privacidade</span>
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
              No <strong className="text-white">Finly</strong>, a tua privacidade é uma prioridade. Esta Política de Privacidade 
              explica como recolhemos, utilizamos, protegemos e partilhamos os teus dados pessoais quando utilizas o nosso serviço. 
              Ao utilizares o Finly, concordas com as práticas descritas nesta política.
            </p>
          </section>

          {/* 1. Informações que Recolhemos */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">1.</span>
              Informações que Recolhemos
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">1.1. Informações da Conta</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Nome completo</li>
                  <li>Endereço de email</li>
                  <li>Número de telemóvel (opcional, para integração com Telegram)</li>
                  <li>Palavra-passe (encriptada)</li>
                  <li>Preferências de moeda e idioma</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">1.2. Dados Financeiros</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Transações (despesas e receitas)</li>
                  <li>Categorias de transações</li>
                  <li>Orçamentos e metas de poupança</li>
                  <li>Análises e insights gerados</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">1.3. Dados Técnicos</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Endereço IP</li>
                  <li>Tipo de navegador e dispositivo</li>
                  <li>Registos de atividade (logs)</li>
                  <li>Cookies e tecnologias similares</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">1.4. Dados de Pagamento</p>
                <p className="ml-4">
                  Os dados de pagamento (cartões de crédito) são processados exclusivamente pelo Stripe. 
                  Não armazenamos nem temos acesso a informações completas de cartões de crédito.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Como Utilizamos as Informações */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">2.</span>
              Como Utilizamos as Informações
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">2.1. Fornecimento do Serviço</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Criar e gerir a tua conta</li>
                  <li>Processar e armazenar os teus dados financeiros</li>
                  <li>Gerar análises e insights personalizados</li>
                  <li>Fornecer suporte ao cliente</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">2.2. Melhorias e Desenvolvimento</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Melhorar a funcionalidade e experiência do utilizador</li>
                  <li>Desenvolver novas funcionalidades</li>
                  <li>Analisar padrões de utilização (de forma agregada e anonimizada)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">2.3. Comunicação</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Enviar notificações sobre o serviço</li>
                  <li>Responder a pedidos de suporte</li>
                  <li>Enviar atualizações e novidades (com o teu consentimento)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">2.4. Segurança e Conformidade Legal</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Detetar e prevenir fraudes ou atividades ilegais</li>
                  <li>Cumprir obrigações legais</li>
                  <li>Proteger os direitos e segurança dos utilizadores</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. Base Legal para o Tratamento */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">3.</span>
              Base Legal para o Tratamento (RGPD)
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>Tratamos os teus dados pessoais com base em:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Execução de contrato:</strong> Para fornecer o serviço que solicitaste</li>
                <li><strong className="text-white">Consentimento:</strong> Para marketing e comunicações opcionais</li>
                <li><strong className="text-white">Interesse legítimo:</strong> Para melhorar o serviço e segurança</li>
                <li><strong className="text-white">Obrigações legais:</strong> Para cumprir requisitos legais</li>
              </ul>
            </div>
          </section>

          {/* 4. Partilha de Informações */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">4.</span>
              Partilha de Informações
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <p className="font-semibold text-white mb-2">4.1. Não Vendemos os Teus Dados</p>
              <p>Nunca vendemos os teus dados pessoais ou financeiros a terceiros.</p>
              
              <div className="mt-4">
                <p className="font-semibold text-white mb-2">4.2. Prestadores de Serviços</p>
                <p>Podemos partilhar dados com prestadores de serviços confiáveis que nos ajudam a operar:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                  <li><strong className="text-white">Stripe:</strong> Processamento de pagamentos</li>
                  <li><strong className="text-white">Serviços de hospedagem:</strong> Armazenamento e infraestrutura</li>
                  <li><strong className="text-white">Serviços de email:</strong> Envio de notificações</li>
                  <li><strong className="text-white">Telegram:</strong> Integração do bot (apenas dados necessários)</li>
                </ul>
                <p className="mt-2">Estes prestadores estão obrigados a proteger os teus dados e não podem utilizá-los para outros fins.</p>
              </div>

              <div className="mt-4">
                <p className="font-semibold text-white mb-2">4.3. Requisitos Legais</p>
                <p>Podemos divulgar informações se exigido por lei, ordem judicial ou processo legal.</p>
              </div>

              <div className="mt-4">
                <p className="font-semibold text-white mb-2">4.4. Transferências de Negócio</p>
                <p>Em caso de fusão, aquisição ou venda de ativos, os teus dados podem ser transferidos, mas continuarão protegidos por esta política.</p>
              </div>
            </div>
          </section>

          {/* 5. Segurança dos Dados */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">5.</span>
              Segurança dos Dados
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>Implementamos medidas de segurança técnicas e organizacionais para proteger os teus dados:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Encriptação:</strong> Dados em trânsito (HTTPS/TLS) e em repouso</li>
                <li><strong className="text-white">Autenticação:</strong> Palavras-passe encriptadas e autenticação de dois fatores (quando disponível)</li>
                <li><strong className="text-white">Acesso limitado:</strong> Apenas pessoal autorizado tem acesso aos dados</li>
                <li><strong className="text-white">Monitorização:</strong> Sistemas de deteção de intrusão e monitorização contínua</li>
                <li><strong className="text-white">Backups seguros:</strong> Cópias de segurança encriptadas e regulares</li>
              </ul>
              <p className="mt-4 text-amber-400">
                ⚠️ Apesar das nossas medidas, nenhum sistema é 100% seguro. És responsável por manter a segurança da tua conta e palavra-passe.
              </p>
            </div>
          </section>

          {/* 6. Retenção de Dados */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">6.</span>
              Retenção de Dados
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>6.1. Mantemos os teus dados enquanto a tua conta estiver ativa e durante o período necessário para:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Fornecer o serviço</li>
                <li>Cumprir obrigações legais</li>
                <li>Resolver disputas</li>
                <li>Aplicar os nossos acordos</li>
              </ul>
              <p className="mt-4">6.2. Quando encerrares a conta, eliminaremos ou anonimizaremos os teus dados pessoais, exceto quando a retenção for exigida por lei.</p>
              <p>6.3. Podes solicitar a eliminação dos teus dados a qualquer momento através das definições da conta ou contactando-nos.</p>
            </div>
          </section>

          {/* 7. Os Teus Direitos (RGPD) */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">7.</span>
              Os Teus Direitos
            </h2>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-[24px] p-6 space-y-4">
              <p className="font-semibold text-white">De acordo com o RGPD, tens os seguintes direitos:</p>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-blue-400 mb-1">7.1. Direito de Acesso</p>
                  <p>Podes solicitar uma cópia dos teus dados pessoais.</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">7.2. Direito de Retificação</p>
                  <p>Podes corrigir dados incorretos ou incompletos.</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">7.3. Direito ao Apagamento</p>
                  <p>Podes solicitar a eliminação dos teus dados (direito ao esquecimento).</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">7.4. Direito à Portabilidade</p>
                  <p>Podes exportar os teus dados num formato estruturado e comummente utilizado.</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">7.5. Direito de Oposição</p>
                  <p>Podes opor-te ao tratamento dos teus dados para certos fins.</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">7.6. Direito de Limitação</p>
                  <p>Podes solicitar a limitação do tratamento dos teus dados.</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-400 mb-1">7.7. Direito de Retirar Consentimento</p>
                  <p>Podes retirar o teu consentimento a qualquer momento.</p>
                </div>
              </div>
              <p className="mt-4 text-sm">
                Para exerceres estes direitos, contacta-nos em <a href="mailto:privacy@finly.pt" className="text-blue-400 hover:text-blue-300 underline">privacy@finly.pt</a>
              </p>
            </div>
          </section>

          {/* 8. Cookies */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">8.</span>
              Cookies e Tecnologias Similares
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6 space-y-3">
              <p>8.1. Utilizamos cookies e tecnologias similares para:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Manter a tua sessão ativa</li>
                <li>Lembrar as tuas preferências</li>
                <li>Analisar o uso do serviço (de forma anonimizada)</li>
                <li>Melhorar a experiência do utilizador</li>
              </ul>
              <p className="mt-4">8.2. Podes gerir as preferências de cookies através do banner de cookies ou nas definições do navegador.</p>
              <p>8.3. Alguns cookies são essenciais para o funcionamento do serviço e não podem ser desativados.</p>
            </div>
          </section>

          {/* 9. Transferências Internacionais */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">9.</span>
              Transferências Internacionais de Dados
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6">
              <p>9.1. Os teus dados podem ser processados e armazenados em servidores localizados fora do Espaço Económico Europeu (EEE).</p>
              <p className="mt-2">9.2. Quando transferimos dados para fora do EEE, garantimos proteções adequadas através de:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>Cláusulas contratuais padrão aprovadas pela Comissão Europeia</li>
                <li>Outros mecanismos legais adequados</li>
              </ul>
            </div>
          </section>

          {/* 10. Menores de Idade */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">10.</span>
              Menores de Idade
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6">
              <p>10.1. O Finly não é destinado a menores de 18 anos.</p>
              <p className="mt-2">10.2. Não recolhemos intencionalmente dados pessoais de menores. Se descobrirmos que recolhemos dados de um menor sem consentimento parental, eliminaremos esses dados imediatamente.</p>
            </div>
          </section>

          {/* 11. Alterações à Política */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">11.</span>
              Alterações a Esta Política
            </h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-[24px] p-6">
              <p>11.1. Podemos atualizar esta Política de Privacidade periodicamente. A data da última atualização está indicada no topo desta página.</p>
              <p className="mt-2">11.2. Alterações significativas serão comunicadas através de email ou de um aviso proeminente no serviço.</p>
              <p className="mt-2">11.3. O uso continuado do serviço após alterações constitui aceitação da política atualizada.</p>
            </div>
          </section>

          {/* 12. Contacto */}
          <section>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              <span className="text-blue-500">12.</span>
              Contacto e Encarregado de Proteção de Dados
            </h2>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-[24px] p-6">
              <p className="mb-4">Para questões sobre privacidade ou para exerceres os teus direitos, contacta-nos:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-blue-500" />
                  <a href="mailto:privacy@finly.pt" className="text-blue-400 hover:text-blue-300 underline">
                    privacy@finly.pt
                  </a>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Também tens o direito de apresentar uma queixa junto da autoridade de proteção de dados (CNPD - Comissão Nacional de Proteção de Dados) 
                se considerares que o tratamento dos teus dados viola o RGPD.
              </p>
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
