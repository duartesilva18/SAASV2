"""
Script de teste para Stripe Connect
Simula um pagamento com divisão automática
"""
import os
import sys
import stripe
from dotenv import load_dotenv

load_dotenv()

# Configurar Stripe
stripe.api_key = os.getenv('STRIPE_API_KEY')

if not stripe.api_key:
    print("[ERRO] STRIPE_API_KEY nao configurado no .env")
    sys.exit(1)

print("Teste de Stripe Connect - Divisao Automatica")
print("=" * 50)

# Opção: Usar conta existente (descomenta e coloca o ID de uma conta que já completou onboarding)
# Se não colocar nada, vai criar uma nova conta
connect_account_id = None  # Coloca aqui o ID de uma conta existente, ou None para criar nova

# 1. Criar ou usar conta Stripe Connect Express
if connect_account_id:
    print(f"\n[1] Usando conta existente: {connect_account_id}")
    print("   Verificando status...")
    try:
        account = stripe.Account.retrieve(connect_account_id)
        details_submitted = account.get('details_submitted', False)
        charges_enabled = account.get('charges_enabled', False)
        print(f"   Status: details_submitted={details_submitted}, charges_enabled={charges_enabled}")
        if not details_submitted or not charges_enabled:
            print(f"   [AVISO] Esta conta ainda nao completou o onboarding!")
            print(f"   Completa o onboarding primeiro ou usa outra conta.")
            sys.exit(1)
    except Exception as e:
        print(f"   [ERRO] Erro ao verificar conta: {e}")
        sys.exit(1)
else:
    print("\n[1] Criando conta Stripe Connect Express...")
    print("   DICA: Depois de completar onboarding, edita o script e coloca o account_id aqui!")
    try:
        account = stripe.Account.create(
            type='express',
            country='PT',
            email='test-affiliate@example.com',
            capabilities={
                'card_payments': {'requested': True},  # Adicionado para evitar erro
                'transfers': {'requested': True},
            },
        )
        connect_account_id = account.id
        print(f"[OK] Conta criada: {connect_account_id}")
        details_submitted = account.get('details_submitted', False)
        charges_enabled = account.get('charges_enabled', False)
        payouts_enabled = account.get('payouts_enabled', False)
        print(f"   Status: details_submitted={details_submitted}, charges_enabled={charges_enabled}, payouts_enabled={payouts_enabled}")
        
        # Se o onboarding não está completo, criar link
        if not details_submitted or not charges_enabled:
            print(f"\n[AVISO] Onboarding nao completo! Criando link de onboarding...")
            try:
                account_link = stripe.AccountLink.create(
                    account=connect_account_id,
                    refresh_url='https://example.com/reauth',
                    return_url='https://example.com/return',
                    type='account_onboarding',
                )
                print(f"[OK] Link de onboarding criado!")
                print(f"   URL: {account_link.url}")
                print(f"\nProximos passos:")
                print(f"   1. Acede ao link acima")
                print(f"   2. Completa o onboarding (modo teste)")
                print(f"   3. Volta a executar este script")
                print(f"\n   OU usa uma conta existente que já tenha onboarding completo!")
                sys.exit(0)
            except Exception as e:
                print(f"[ERRO] Erro ao criar link de onboarding: {e}")
                print(f"   Podes criar manualmente via frontend: /affiliate/stripe-connect")
                sys.exit(1)
    except stripe.error.InvalidRequestError as e:
        error_msg = str(e)
        if 'responsibilities' in error_msg.lower() or 'platform-profile' in error_msg.lower():
            print(f"[ERRO] Erro: Precisa aceitar as responsabilidades do Stripe Connect primeiro!")
            print(f"\nPassos para resolver:")
            print(f"   1. Acede: https://dashboard.stripe.com/settings/connect/platform-profile")
            print(f"   2. Lê e aceita as responsabilidades")
            print(f"   3. Volta a executar este script")
        elif 'approval' in error_msg.lower() or 'card_payments' in error_msg.lower():
            print(f"[ERRO] Erro: Plataforma precisa de aprovacao para transfers sem card_payments")
            print(f"\nSolucoes:")
            print(f"   1. Contacta Stripe Support: https://support.stripe.com/contact")
            print(f"   2. OU usa uma conta Stripe Connect existente criada via frontend")
            print(f"      - Edita o script e descomenta a linha 'connect_account_id = ...'")
            print(f"      - Coloca o ID de uma conta existente da BD")
        else:
            print(f"[ERRO] Erro ao criar conta: {e}")
        print(f"\n   Alternativa: Usa uma conta existente do frontend!")
        sys.exit(1)
    except Exception as e:
        print(f"[ERRO] Erro ao criar conta: {e}")
        print(f"\nAlternativa: Usa uma conta Stripe Connect existente!")
        print(f"   - Cria uma via frontend (/affiliate/stripe-connect)")
        print(f"   - Copia o stripe_connect_account_id da BD")
        print(f"   - Edita o script e coloca o ID manualmente")
        sys.exit(1)

# 2. Criar Customer de teste
print("\n[2] Criando customer de teste...")
try:
    customer = stripe.Customer.create(
        email='test-customer@example.com',
        metadata={'user_id': 'test-user-123'}
    )
    customer_id = customer.id
    print(f"[OK] Customer criado: {customer_id}")
except Exception as e:
    print(f"[ERRO] Erro ao criar customer: {e}")
    sys.exit(1)

# 3. Criar Price de teste (9.99€)
print("\n[3] Criando price de teste...")
try:
    price = stripe.Price.create(
        unit_amount=999,  # 9.99€ em cêntimos
        currency='eur',
        recurring={'interval': 'month'},
        product_data={'name': 'Pro Plan Test'},
    )
    price_id = price.id
    print(f"[OK] Price criado: {price_id}")
except Exception as e:
    print(f"[ERRO] Erro ao criar price: {e}")
    sys.exit(1)

# 4. Verificar se a conta está pronta para transfers
print("\n[4] Verificando se a conta esta pronta para transfers...")
try:
    account = stripe.Account.retrieve(connect_account_id)
    details_submitted = account.get('details_submitted', False)
    charges_enabled = account.get('charges_enabled', False)
    payouts_enabled = account.get('payouts_enabled', False)
    
    if not details_submitted or not charges_enabled:
        print(f"[ERRO] Conta nao esta pronta! Onboarding incompleto.")
        print(f"   details_submitted: {details_submitted}")
        print(f"   charges_enabled: {charges_enabled}")
        print(f"   payouts_enabled: {payouts_enabled}")
        print(f"\nCriando link de onboarding...")
        try:
            # Usar URL do frontend se disponível, senão usar localhost
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
            account_link = stripe.AccountLink.create(
                account=connect_account_id,
                refresh_url=f'{frontend_url}/affiliate/stripe-connect?refresh=true',
                return_url=f'{frontend_url}/affiliate/stripe-connect?success=true',
                type='account_onboarding',
            )
            print(f"[OK] Link de onboarding criado!")
            print(f"   URL: {account_link.url}")
            print(f"\nProximos passos:")
            print(f"   1. Acede ao link acima")
            print(f"   2. Completa o onboarding (modo teste - pode usar dados ficticios)")
            print(f"   3. Quando aparecer 'Example Domain', podes fechar a pagina")
            print(f"   4. Volta a executar este script")
            print(f"\n   OU usa uma conta existente que já tenha onboarding completo!")
        except Exception as e:
            print(f"[ERRO] Erro ao criar link: {e}")
            print(f"   Cria uma conta via frontend: /affiliate/stripe-connect")
        sys.exit(1)
    
    print(f"[OK] Conta esta pronta!")
    print(f"   details_submitted: {details_submitted}")
    print(f"   charges_enabled: {charges_enabled}")
    print(f"   payouts_enabled: {payouts_enabled}")
except Exception as e:
    print(f"[ERRO] Erro ao verificar conta: {e}")

# 5. Criar Checkout Session com divisão automática
print("\n[5] Criando checkout session com divisao automatica...")
print(f"   Comissão: 20% (200 cêntimos)")
print(f"   Transfer para: {connect_account_id}")
try:
    # Comissão do afiliado = 20%; plataforma retém 80% (application_fee_percent = percentagem da plataforma)
    total_amount = 999  # 9.99€
    commission_percentage = 20.0
    platform_fee_percent = 100 - commission_percentage  # 80% fica na plataforma, 20% vai para o afiliado
    
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=['card'],
        line_items=[{
            'price': price_id,
            'quantity': 1,
        }],
        mode='subscription',
        subscription_data={
            'application_fee_percent': platform_fee_percent,
            'transfer_data': {
                'destination': connect_account_id,
            },
            'metadata': {
                'user_id': 'test-user-123',
                'referrer_id': 'test-affiliate-123',
                'commission_percentage': str(commission_percentage),
            }
        },
        success_url='https://example.com/success',
        cancel_url='https://example.com/cancel',
    )
    print(f"[OK] Checkout session criada: {session.id}")
    print(f"   URL: {session.url}")
    print("\n" + "=" * 50)
    print("PROXIMOS PASSOS (IMPORTANTE!):")
    print("=" * 50)
    print("1. ABRE ESTA URL NO BROWSER:")
    print(f"   {session.url}")
    print("\n2. USA CARTAO DE TESTE:")
    print("   Numero: 4242 4242 4242 4242")
    print("   Data: 12/34 (qualquer data futura)")
    print("   CVC: 123 (qualquer 3 digitos)")
    print("\n3. COMPLETA O PAGAMENTO")
    print("\n4. VERIFICA OS LOGS DO BACKEND:")
    print("   Deves ver:")
    print("   - 'Evento Stripe recebido: payment_intent.succeeded'")
    print("   - '[OK] Comissao marcada como paga via divisao automatica...'")
    print("   - 'Evento Stripe recebido: transfer.created'")
    print("   - '[OK] Transfer ID capturado: tr_xxx...'")
    print("\n[AVISO] OS WEBHOOKS SO APARECEM DEPOIS DE COMPLETARES O PAGAMENTO!")
except Exception as e:
    print(f"[ERRO] Erro ao criar checkout session: {e}")
    print(f"   Detalhes: {str(e)}")
    sys.exit(1)

print("\n" + "=" * 50)
print("[OK] Teste configurado com sucesso!")
print(f"\nInformacoes importantes:")
print(f"   Connect Account ID: {connect_account_id}")
print(f"   Customer ID: {customer_id}")
print(f"   Price ID: {price_id}")
print(f"   Checkout Session ID: {session.id}")
print(f"\nURL do Checkout: {session.url}")
print("\nProximos passos:")
print("   1. Acede a URL acima e completa o pagamento")
print("   2. Verifica os logs do backend para ver os webhooks")
print("   3. Verifica se a comissao foi criada na BD")

