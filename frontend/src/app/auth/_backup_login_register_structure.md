# Backup: estrutura anterior do Login e Registo

Guardado para referência antes do redesign (fundo com logo + ícone gráfico a subir).

## Login (estrutura anterior)
- Layout: `lg:flex-row` com **painel esquerdo** (só desktop) com citações motivacionais, logo Finly, estatística Trophy, e **painel direito** com formulário.
- Painel esquerdo: `hidden lg:flex lg:w-1/2`, citações rotativas, link "Voltar ao site".
- Painel direito: formulário dentro de `motion.div` com título "Bem-vindo de volta" (largura `max-w-md xl:max-w-lg 2xl:max-w-xl`), card do form (max-w-sm sm:max-w-md xl:max-w-md 2xl:max-w-lg), campos email/password, "Manter sessão", botão Entrar, separador "Ou continuar com", GoogleLoginButton, e link "Criar conta grátis".
- Blobs de fundo: `bg-blue-600/10` e `bg-indigo-600/10` com blur.

## Registo (estrutura a manter em mente)
- Similar ao login: painel esquerdo com benefícios/rotativo, painel direito com form de registo, Google, "Fazer login agora".

## Componentes reutilizados
- `GoogleLoginButton`, `MagneticButton`, lógica `handleSubmit`, `handleSocialLogin`, `handleResendVerification`, traduções `t.auth.login.*`.
