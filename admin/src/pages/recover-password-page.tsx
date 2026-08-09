import { ArrowLeft, ArrowRight, KeyRound, Mail } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { AuthShell } from '../components/auth-shell';
import { supabase } from '../lib/supabase';

export function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !supabase) {
      setError('Configure o Supabase e informe o e-mail da conta administrativa.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const redirectTo = new URL('/auth/nova-senha', window.location.origin).toString();
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setSubmitting(false);

    if (recoveryError) {
      setError('Não foi possível enviar o link agora. Aguarde alguns minutos e tente novamente.');
      return;
    }

    setSent(true);
  }

  return (
    <AuthShell
      title="Recuperar senha"
      description="Receba um link seguro para definir uma nova senha."
      icon={KeyRound}
      onSubmit={submit}>
      {error ? <div className="form-alert" role="alert">{error}</div> : null}
      {sent ? (
        <div className="form-alert form-alert--success" role="status">
          Se este e-mail estiver cadastrado, o link chegará em instantes. Ele expira em 60 minutos.
        </div>
      ) : (
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
      )}

      {!sent ? (
        <button type="submit" className="primary-button" disabled={submitting}>
          <span>{submitting ? 'Enviando…' : 'Enviar link de recuperação'}</span>
          {!submitting ? <ArrowRight size={18} /> : null}
        </button>
      ) : null}

      <Link to="/login" className="secondary-button">
        <ArrowLeft size={18} />
        Voltar ao login
      </Link>
    </AuthShell>
  );
}
