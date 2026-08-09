import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { AuthShell } from '../components/auth-shell';
import { useAuth } from '../context/auth-context';

export function LoginPage() {
  const { access, error, isPreview, loading, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (access) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    await signIn(email, password);
  }

  return (
    <AuthShell
      title="Entrar no painel"
      description="Use sua conta administrativa do KAD."
      icon={LockKeyhole}
      onSubmit={submit}>
      {location.state?.passwordUpdated ? (
        <div className="form-alert form-alert--success" role="status">
          Senha atualizada. Entre novamente com a nova senha.
        </div>
      ) : null}
      {error ? <div className="form-alert" role="alert">{error}</div> : null}
      {isPreview ? (
        <div className="form-alert form-alert--preview">
          O modo local abre a interface sem autenticação e sem carregar dados reais.
        </div>
      ) : null}

      <label className="form-field">
        <span>E-mail</span>
        <div className="form-control">
          <Mail size={18} aria-hidden="true" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@kad.com.br"
            autoComplete="email"
            required
          />
        </div>
      </label>

      <label className="form-field">
        <span className="form-field__label-row">
          <span>Senha</span>
          <Link to="/recuperar-senha" className="inline-link">Esqueci minha senha</Link>
        </span>
        <div className="form-control">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="field-action"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      <button type="submit" className="primary-button" disabled={loading}>
        <span>{loading ? 'Validando acesso…' : 'Acessar administração'}</span>
        {!loading ? <ArrowRight size={18} /> : null}
      </button>

      <p className="login-help">
        A criação de contas administrativas é feita por um proprietário autorizado.
      </p>
    </AuthShell>
  );
}
