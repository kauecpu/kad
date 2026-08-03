import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Navigate } from 'react-router';

import { Brand } from '../components/brand';
import { useAuth } from '../context/auth-context';

export function LoginPage() {
  const { access, error, isPreview, loading, signIn } = useAuth();
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
    <div className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-panel__content">
          <Brand />
          <div className="login-brand-panel__copy">
            <span className="login-eyebrow">CENTRAL DE OPERAÇÕES</span>
            <h1>Decisões melhores começam com uma operação clara.</h1>
            <p>
              Conteúdo, comunidade e usuários do KAD reunidos em um ambiente separado e
              protegido.
            </p>
          </div>
          <div className="login-security-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Acesso restrito</strong>
              <span>Cada ação administrativa será associada ao responsável.</span>
            </div>
          </div>
        </div>
        <div className="login-orb login-orb--one" />
        <div className="login-orb login-orb--two" />
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card__heading">
            <span className="login-card__icon"><LockKeyhole size={22} /></span>
            <div>
              <h2>Entrar no painel</h2>
              <p>Use sua conta administrativa do KAD.</p>
            </div>
          </div>

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
            <span>Senha</span>
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
            A criação e a recuperação de contas administrativas são feitas por um proprietário
            autorizado.
          </p>
        </form>
      </section>
    </div>
  );
}
