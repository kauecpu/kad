import {
  Activity,
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  CircleAlert,
  MessageSquareText,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { StatusPill } from '../components/status-pill';
import { useAuth } from '../context/auth-context';
import { supabase } from '../lib/supabase';
import type { DashboardSummary } from '../types';

const numberFormatter = new Intl.NumberFormat('pt-BR');

export function DashboardPage() {
  const { isPreview } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPreview || !supabase) return;

    setLoading(true);
    void supabase.rpc('admin_dashboard_summary').then(({ data, error: summaryError }) => {
      if (summaryError || !data) {
        setError('As métricas ainda não estão disponíveis. Aplique a migration administrativa.');
      } else {
        setSummary(data as unknown as DashboardSummary);
      }
      setLoading(false);
    });
  }, [isPreview]);

  const activeRate = useMemo(() => {
    if (!summary?.users_total) return 0;
    return Math.min(100, Math.round((summary.active_students_last_7_days / summary.users_total) * 100));
  }, [summary]);

  const hasRealData = !isPreview && Boolean(summary);

  const metrics = [
    {
      label: 'Usuários cadastrados',
      value: hasRealData ? summary?.users_total : undefined,
      helper: isPreview
        ? 'Sem dados reais conectados'
        : summary
          ? `+${numberFormatter.format(summary.users_last_7_days)} nos últimos 7 dias`
          : 'Carregando',
      icon: UsersRound,
      tone: 'violet',
    },
    {
      label: 'Respostas registradas',
      value: hasRealData ? summary?.question_attempts_total : undefined,
      helper: isPreview ? 'Sem dados reais conectados' : 'Histórico sincronizado no Supabase',
      icon: MousePointerClick,
      tone: 'blue',
    },
    {
      label: 'Alunos ativos',
      value: hasRealData ? summary?.active_students_last_7_days : undefined,
      helper: isPreview ? 'Sem dados reais conectados' : `${activeRate}% da base nos últimos 7 dias`,
      icon: Activity,
      tone: 'green',
    },
    {
      label: 'Comentários',
      value: hasRealData ? summary?.comments_total : undefined,
      helper: isPreview
        ? 'Sem dados reais conectados'
        : summary
          ? `+${numberFormatter.format(summary.comments_last_7_days)} nos últimos 7 dias`
          : 'Carregando',
      icon: MessageSquareText,
      tone: 'amber',
    },
  ];

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-eyebrow">PAINEL OPERACIONAL</span>
          <h1>Visão geral</h1>
          <p>Acompanhe o uso do KAD e o preparo dos módulos administrativos.</p>
        </div>
        <button type="button" className="secondary-button" disabled title="Relatórios serão adicionados em uma próxima etapa">
          <span>Ver relatório</span>
          <ArrowUpRight size={17} />
        </button>
      </section>

      {error ? (
        <div className="page-alert" role="alert">
          <CircleAlert size={19} />
          <span>{error}</span>
        </div>
      ) : null}

      {isPreview ? (
        <div className="page-alert page-alert--preview" role="status">
          <CircleAlert size={19} />
          <span>O modo local não consulta o Supabase. Nenhuma métrica real está sendo exibida.</span>
        </div>
      ) : null}

      <section className="metric-grid" aria-label="Métricas principais">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <div className={`metric-card__icon metric-card__icon--${metric.tone}`}>
                <Icon size={21} strokeWidth={1.8} />
              </div>
              <span className="metric-card__label">{metric.label}</span>
              <strong className="metric-card__value">
                {loading || metric.value === undefined
                  ? '—'
                  : numberFormatter.format(metric.value)}
              </strong>
              <span className="metric-card__helper">{metric.helper}</span>
            </article>
          );
        })}
      </section>

      <section className="dashboard-grid">
        <article className="panel-card panel-card--wide">
          <div className="panel-card__header">
            <div>
              <span className="panel-card__eyebrow">ENGAJAMENTO</span>
              <h2>Atividade da base</h2>
            </div>
            <StatusPill active={!isPreview}>{isPreview ? 'Sem dados reais' : 'Dados reais'}</StatusPill>
          </div>

          <div className="engagement-content">
            <div
              className="activity-ring"
              style={{ '--activity-rate': `${activeRate * 3.6}deg` } as React.CSSProperties}>
              <div className="activity-ring__center">
                <strong>{isPreview ? '—' : `${activeRate}%`}</strong>
                <span>{isPreview ? 'sem dados' : 'ativos'}</span>
              </div>
            </div>
            <div className="engagement-list">
              <div>
                <span><Bookmark size={17} /> Concursos salvos</span>
                <strong>{isPreview ? '—' : numberFormatter.format(summary?.saved_concursos_total ?? 0)}</strong>
              </div>
              <div>
                <span><MessageSquareText size={17} /> Novos comentários</span>
                <strong>{isPreview ? '—' : numberFormatter.format(summary?.comments_last_7_days ?? 0)}</strong>
              </div>
              <div>
                <span><UsersRound size={17} /> Novos usuários</span>
                <strong>{isPreview ? '—' : numberFormatter.format(summary?.users_last_7_days ?? 0)}</strong>
              </div>
            </div>
          </div>
          <p className="panel-caption">
            {isPreview ? 'Conecte uma conta administrativa para consultar a base.' : 'Janela de atividade: últimos 7 dias.'}
          </p>
        </article>

        <article className="panel-card">
          <div className="panel-card__header">
            <div>
              <span className="panel-card__eyebrow">SEGURANÇA</span>
              <h2>Fundação administrativa</h2>
            </div>
            <ShieldCheck size={21} className="panel-card__header-icon" />
          </div>

          <div className="readiness-list">
            <ReadinessItem title="Painel separado" description="Build independente do aplicativo" ready />
            <ReadinessItem title="Papéis e permissões" description="Owner, admin, editor, moderação e suporte" ready />
            <ReadinessItem title="Métricas protegidas" description="RPC acessível somente a administradores" ready />
            <ReadinessItem title="CRUD de concursos" description="Criação, revisão, publicação e auditoria" ready />
            <ReadinessItem title="Banco de questões" description="Próximo módulo editorial" />
          </div>
        </article>
      </section>

      <section className="next-step-card">
        <div className="next-step-card__icon"><Sparkles size={22} /></div>
        <div>
          <span className="panel-card__eyebrow">PRÓXIMO MARCO</span>
          <h2>Levar o banco de questões para o fluxo editorial</h2>
          <p>
            Concursos já possuem cadastro, revisão e publicação. O próximo passo é aplicar o mesmo
            padrão ao acervo de questões, incluindo alternativas, gabarito e explicação.
          </p>
        </div>
        <Link to="/questoes" className="secondary-button">Ver próximo módulo</Link>
      </section>
    </div>
  );
}

function ReadinessItem({
  title,
  description,
  ready = false,
}: {
  title: string;
  description: string;
  ready?: boolean;
}) {
  return (
    <div className="readiness-item">
      <span className={`readiness-item__icon ${ready ? 'readiness-item__icon--ready' : ''}`}>
        {ready ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
      </span>
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}
