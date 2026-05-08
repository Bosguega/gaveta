import { useState, type FormEvent } from 'react';
import { login, register } from '../services/authService';
import { notify } from '../utils/notifications';
import { errorMessages } from '../utils/errorMessages';
import { logger } from '../utils/logger';
import { ErrorCodes } from '../utils/errorCodes';
import type { LoginProps } from '../types/ui';

export default function Login({ setSessionUser }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegistering) {
        const data = await register(email, password);
        if (data.user && !data.session) {
          notify.success('Conta criada! Verifique seu email para confirmar o cadastro.');
        } else if (data.user && data.session) {
          notify.success('Conta criada com sucesso!');
          setSessionUser(data.user);
        }
      } else {
        const data = await login(email, password);
        notify.success('Login efetuado com sucesso!');
        setSessionUser(data.user);
      }
    } catch (err: unknown) {
      logger.error("Login", "Authentication failed", err, ErrorCodes.AUTH_LOGIN_FAILED);
      const message = err instanceof Error ? err.message : errorMessages.AUTH_LOGIN_FAILED;
      notify.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container flex justify-center items-center min-h-screen p-4">
      <div className="glass-card w-full max-w-[400px] text-center">
        <h2 className="text-white mb-6 text-2xl">
          My Mercado
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="search-input w-full"
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="search-input w-full"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn btn-success w-full p-3 mt-2"
          >
            {loading ? 'Aguarde...' : isRegistering ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-slate-400 text-[0.85rem]">
          {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="bg-transparent border-none text-[var(--primary)] ml-2 cursor-pointer font-medium underline"
          >
            {isRegistering ? 'Fazer login' : 'Criar uma'}
          </button>
        </p>
      </div>
    </div>
  );
}
