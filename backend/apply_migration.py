#!/usr/bin/env python3
"""
Script para aplicar a migração SQL na base de dados do Render

Uso:
    python apply_migration.py
    python apply_migration.py "postgresql://user:pass@host:port/db"
    DATABASE_URL="postgresql://..." python apply_migration.py
"""
import os
import sys
import psycopg2
from psycopg2 import sql

# NUNCA coloques a connection string no código. Usa variável de ambiente ou argumento.
if len(sys.argv) > 1:
    DATABASE_URL = sys.argv[1]
elif os.getenv('DATABASE_URL'):
    DATABASE_URL = os.getenv('DATABASE_URL')
else:
    print("Erro: define DATABASE_URL no ambiente ou passa como argumento.", file=sys.stderr)
    print("Exemplo: DATABASE_URL='postgresql://...' python apply_migration.py", file=sys.stderr)
    sys.exit(1)

def apply_migration():
    """Aplica a migração SQL na base de dados"""
    try:
        # Conectar à base de dados
        print("[*] A conectar à base de dados...")
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Ler o ficheiro SQL
        print("[*] A ler o ficheiro de migração...")
        with open('render_migration.sql', 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        # Executar o script SQL
        print("[*] A executar a migração...")
        cursor.execute(migration_sql)
        
        print("[OK] Migração aplicada com sucesso!")
        print("\n[*] Verificando colunas criadas...")
        
        # Verificar se as colunas foram criadas
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN (
                'is_affiliate', 
                'affiliate_code', 
                'referrer_id', 
                'stripe_connect_account_id'
            )
            ORDER BY column_name;
        """)
        
        columns = cursor.fetchall()
        if columns:
            print("\n[OK] Colunas encontradas:")
            for col in columns:
                print(f"   - {col[0]}")
        else:
            print("\n[!] Nenhuma coluna encontrada (pode ser normal se já existirem)")
        
        # Verificar tabelas criadas
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'affiliate_referrals', 
                'affiliate_commissions', 
                'system_settings'
            )
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        if tables:
            print("\n[OK] Tabelas encontradas:")
            for table in tables:
                print(f"   - {table[0]}")
        
        cursor.close()
        conn.close()
        
        print("\n[OK] Tudo pronto! Podes reiniciar o backend no Render.")
        
    except FileNotFoundError:
        print("[ERRO] Ficheiro 'render_migration.sql' não encontrado!")
        print("   Certifica-te de que estás na pasta 'backend' e que o ficheiro existe.")
        sys.exit(1)
    except psycopg2.Error as e:
        print(f"[ERRO] Erro ao executar a migração: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERRO] Erro inesperado: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("APLICAR MIGRACAO NA BASE DE DADOS DO RENDER")
    print("=" * 60)
    print()
    print(f"Connection String: {DATABASE_URL.split('@')[0]}@***")
    print()
    
    # Verificar se o ficheiro SQL existe
    if not os.path.exists('render_migration.sql'):
        print("[ERRO] Ficheiro 'render_migration.sql' não encontrado!")
        print("   Certifica-te de que estás na pasta 'backend' e que o ficheiro existe.")
        sys.exit(1)
    
    apply_migration()

