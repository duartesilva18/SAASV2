#!/usr/bin/env python3
"""
Script para criar um novo produto e preço no Stripe
"""
import os
import sys
import stripe
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configurar Stripe
stripe.api_key = os.getenv('STRIPE_API_KEY')

if not stripe.api_key:
    print("ERRO: STRIPE_API_KEY nao encontrada no .env")
    print("Adiciona: STRIPE_API_KEY=sk_test_...")
    sys.exit(1)

def create_product_and_price():
    """Cria um novo produto e preço no Stripe"""
    
    print("=" * 60)
    print("CRIAR NOVO PRODUTO E PRECO NO STRIPE")
    print("=" * 60)
    print()
    
    # 1. Informações do Produto
    print("1. INFORMACOES DO PRODUTO")
    print("-" * 60)
    product_name = input("Nome do produto (ex: Finly Pro): ").strip()
    if not product_name:
        product_name = "Finly Pro"
        print(f"   Usando nome padrao: {product_name}")
    
    product_description = input("Descricao do produto (opcional): ").strip()
    
    print()
    
    # 2. Informações do Preço
    print("2. INFORMACOES DO PRECO")
    print("-" * 60)
    
    # Valor
    while True:
        try:
            price_value = input("Valor (ex: 9.99 para 9.99€): ").strip()
            price_cents = int(float(price_value) * 100)
            print(f"   Valor em centimos: {price_cents}")
            break
        except ValueError:
            print("   ERRO: Valor invalido. Usa formato: 9.99")
    
    # Moeda
    currency = input("Moeda (EUR, USD, etc) [EUR]: ").strip().upper() or "EUR"
    print(f"   Moeda: {currency}")
    
    # Intervalo
    print()
    print("   Intervalo de cobranca:")
    print("   1. Mensal (month)")
    print("   2. Anual (year)")
    print("   3. Semanal (week)")
    print("   4. Diario (day)")
    
    interval_choice = input("   Escolha (1-4) [1]: ").strip() or "1"
    interval_map = {
        "1": "month",
        "2": "year",
        "3": "week",
        "4": "day"
    }
    interval = interval_map.get(interval_choice, "month")
    print(f"   Intervalo: {interval}")
    
    print()
    print("=" * 60)
    print("RESUMO:")
    print(f"  Produto: {product_name}")
    if product_description:
        print(f"  Descricao: {product_description}")
    print(f"  Valor: {price_value} {currency}")
    print(f"  Intervalo: {interval}")
    print("=" * 60)
    print()
    
    confirm = input("Confirmar criacao? (s/N): ").strip().lower()
    if confirm != 's':
        print("Cancelado.")
        return
    
    print()
    print("A criar produto e preco no Stripe...")
    print()
    
    try:
        # Criar Produto
        product_params = {
            'name': product_name,
            'type': 'service',  # ou 'good' para produtos físicos
        }
        
        if product_description:
            product_params['description'] = product_description
        
        product = stripe.Product.create(**product_params)
        print(f"[OK] Produto criado:")
        print(f"     Product ID: {product.id}")
        print(f"     Nome: {product.name}")
        
        # Criar Preço
        price_params = {
            'product': product.id,
            'unit_amount': price_cents,
            'currency': currency,
            'recurring': {
                'interval': interval
            }
        }
        
        price = stripe.Price.create(**price_params)
        print(f"[OK] Preco criado:")
        print(f"     Price ID: {price.id}")
        print(f"     Valor: {price.unit_amount / 100} {price.currency}")
        print(f"     Intervalo: {price.recurring['interval']}")
        
        print()
        print("=" * 60)
        print("SUCESSO!")
        print("=" * 60)
        print()
        print("COPIA ESTES IDs PARA O TEU CODIGO:")
        print(f"  Product ID: {product.id}")
        print(f"  Price ID: {price.id}")
        print()
        print("Exemplo de uso no frontend:")
        print(f'  priceId: "{price.id}",')
        print()
        
    except stripe.error.StripeError as e:
        print(f"[ERRO] Erro do Stripe: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERRO] Erro inesperado: {e}")
        sys.exit(1)

if __name__ == '__main__':
    try:
        create_product_and_price()
    except KeyboardInterrupt:
        print("\n\nCancelado pelo utilizador.")
        sys.exit(0)


