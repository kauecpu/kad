import { CheckCircle2, CircleAlert, Database, KeyRound, ShieldCheck } from 'lucide-react';

import { useAuth } from '../context/auth-context';
import { hasSupabaseConfig } from '../lib/supabase';

export function SettingsPage() {
  const { access, isPreview } = useAuth();

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-eyebrow">AMBIENTE</span>
          <h1>Configurações</h1>
          <p>Estado da integração e dos controles de acesso do painel.</p>
        </div>
      </section>

      <section className="settings-grid">
        <SettingCard
          icon={Database}
          title="Conexão Supabase"
          description={hasSupabaseConfig ? 'Variáveis públicas configuradas.' : 'Variáveis ainda não configuradas.'}
          ready={hasSupabaseConfig}
        />
        <SettingCard
          icon={KeyRound}
          title="Acesso administrativo"
          description={access ? `Papel ativo: ${access.role}.` : 'Nenhum papel administrativo carregado.'}
          ready={Boolean(access)}
        />
        <SettingCard
          icon={ShieldCheck}
          title="Modo de execução"
          description={isPreview ? 'Interface local sem autenticação e sem dados reais.' : 'Ambiente autenticado.'}
          ready={!isPreview}
        />
      </section>

      <section className="security-card">
        <ShieldCheck size={23} />
        <div>
          <h2>Segredos não pertencem ao navegador</h2>
          <p>
            Este frontend aceita somente a URL e a chave publicável. Chaves secretas devem ficar
            nas Edge Functions ou em outro backend controlado.
          </p>
        </div>
      </section>
    </div>
  );
}

function SettingCard({
  icon: Icon,
  title,
  description,
  ready,
}: {
  icon: typeof Database;
  title: string;
  description: string;
  ready: boolean;
}) {
  return (
    <article className="setting-card">
      <div className="setting-card__top">
        <span className="feature-card__icon"><Icon size={20} /></span>
        {ready ? <CheckCircle2 size={18} className="state-ready" /> : <CircleAlert size={18} className="state-pending" />}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}
