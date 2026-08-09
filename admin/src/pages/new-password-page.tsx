import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { AuthShell } from '../components/auth-shell';
import { useAuth } from '../context/auth-context';
import { supabase } from '../lib/supabase';

export function NewPasswordPage() {
  const navigate = useNavigate();
  const { loading, session, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Use pelo menos 8 caracteres na nova senha.');
      return;
    }

    if (password !== confirmation) {
      setError('As senhas informadas não coincidem.');
      return;
    }

    if (!supabase || !session) {
      setError('O link é inválido ou expirou. Solicite uma nova recuperação.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      setError('Não foi possível atualizar a senha. Solicite um novo link e tente novamente.');
      return;
    }

    await signOut();
    navigate('/login', { replace: true, state: { passwordUpdated: true } });
  }

  const invalidLink = !loading && !session;

  return (
    <AuthShell
      title="Definir nova senha"
      description="Crie uma senha exclusiva para sua conta administrativa."
      icon={KeyRound}
      onSubmit={submit}>
      {error ? <div className="form-alert" role="alert">{error}</div> : null}
      {invalidLink ? (
        <>
          <div className="form-alert" role="alert">
            Este link é inválido ou expirou. Solicite uma nova recuperação de senha.
          </div>
          <Link to="/recuperar-senha" className="primary-button">
            Solicitar novo link
          </Link>
          <Link to="/login" className="secondary-button">
            <ArrowLeft size={18} />
            Voltar ao login
          </Link>
        </>
      ) : (
        <>
          <label className="form-field">
            <span>Nova senha</span>
            <div className="form-control">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Pelo menos 8 caracteres"
                autoComplete="new-password"
                minLength={8}
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

          <label className="form-field">
            <span>Repetir nova senha</span>
            <div className="form-control">
              <CheckCircle2 size={18} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Digite a senha novamente"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </label>

          <button type="submit" className="primary-button" disabled={loading || submitting}>
            {submitting ? 'Atualizando…' : 'Salvar nova senha'}
          </button>
        </>
      )}
    </AuthShell>
  );
}
