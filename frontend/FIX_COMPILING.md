# 🔧 Fix "Compiling..." Constante

## Problema
O Next.js fica sempre a compilar, mostrando "Compiling..." infinitamente.

## Soluções Rápidas

### 1. Limpar Cache do Next.js
```powershell
cd SaaS/frontend
Remove-Item -Recurse -Force .next
npm run dev
```

### 2. Reiniciar o Servidor
- Parar o servidor (Ctrl+C)
- Limpar cache: `Remove-Item -Recurse -Force .next`
- Reiniciar: `npm run dev`

### 3. Verificar Ficheiros em Modificação Constante
```powershell
# Verificar se há ficheiros a serem modificados constantemente
Get-ChildItem -Recurse -File | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-1) }
```

### 4. Desabilitar Watch Mode Temporariamente
No `package.json`, mudar:
```json
"dev": "next dev --turbo"
```
Para:
```json
"dev": "next dev --turbo --no-turbo"
```

### 5. Verificar RAM
Se RAM estiver a 100%, pode causar lentidão:
```powershell
Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 ProcessName, @{Name="RAM(MB)";Expression={[math]::Round($_.WorkingSet/1MB,2)}}
```

## Correções Aplicadas

✅ **billing/page.tsx**: Corrigido `useEffect` que estava a causar re-renders infinitos

## Se o Problema Persistir

1. Fechar todas as abas do navegador
2. Limpar cache do navegador
3. Reiniciar o computador (se RAM estiver esgotada)
4. Verificar se há processos Node.js órfãos:
   ```powershell
   Get-Process node | Stop-Process -Force
   ```

