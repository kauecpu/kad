import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Inbox,
  MessageSquareText,
  Search,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/auth-context';
import { loadAdminFeedback, updateAdminFeedbackStatus } from '../lib/feedback-api';
import type { AdminFeedback, FeedbackCategory, FeedbackStatus } from '../types';

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Novo',
  reviewing: 'Em análise',
  resolved: 'Resolvido',
};

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  suggestion: 'Sugestão',
  problem: 'Problema',
  question: 'Dúvida',
};

const STATUS_OPTIONS: FeedbackStatus[] = ['new', 'reviewing', 'resolved'];

export function FeedbackPage() {
  const { access, isPreview } = useAuth();
  const [items, setItems] = useState<AdminFeedback[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | FeedbackStatus>('all');
  const [category, setCategory] = useState<'all' | FeedbackCategory>('all');
  const [loading, setLoading] = useState(!isPreview);
  const [updatingId, setUpdatingId] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const canManage = !isPreview && Boolean(access?.permissions.includes('feedback.manage'));

  const refresh = async () => {
    if (isPreview) return;
    setLoading(true);
    setError(undefined);
    try {
      setItems(await loadAdminFeedback());
    } catch {
      setError('Não foi possível carregar os comentários. Aplique a migration de feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [isPreview]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return items.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (!term) return true;
      return `${item.userName} ${item.username ?? ''} ${item.message}`
        .toLocaleLowerCase('pt-BR')
        .includes(term);
    });
  }, [category, items, query, status]);

  const updateStatus = async (item: AdminFeedback, nextStatus: FeedbackStatus) => {
    if (!canManage || item.status === nextStatus) return;
    setUpdatingId(item.id);
    setError(undefined);
    setNotice(undefined);
    try {
      await updateAdminFeedbackStatus(item.id, nextStatus);
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, status: nextStatus, updatedAt: new Date().toISOString() }
            : currentItem,
        ),
      );
      setNotice(`Comentário marcado como ${STATUS_LABEL[nextStatus].toLocaleLowerCase('pt-BR')}.`);
    } catch {
      setError('Não foi possível atualizar o comentário. Verifique sua permissão e tente novamente.');
    } finally {
      setUpdatingId(undefined);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-eyebrow">VOZ DO USUÁRIO</span>
          <h1>Feedback do aplicativo</h1>
          <p>Leia os comentários do teste fechado e acompanhe cada item até a resolução.</p>
        </div>
        <span className="feedback-live-badge"><span /> Fila protegida</span>
      </section>

      {isPreview ? (
        <div className="page-alert page-alert--preview" role="status">
          <CircleAlert size={19} />
          <span>A prévia local não consulta comentários reais do Supabase.</span>
        </div>
      ) : null}
      {error ? (
        <div className="page-alert" role="alert"><CircleAlert size={19} /><span>{error}</span></div>
      ) : null}
      {notice ? (
        <div className="page-alert page-alert--success" role="status">
          <CheckCircle2 size={19} /><span>{notice}</span>
        </div>
      ) : null}

      <section className="editorial-metrics" aria-label="Resumo do feedback">
        <FeedbackMetric icon={Inbox} label="Novos" value={items.filter((item) => item.status === 'new').length} tone="new" />
        <FeedbackMetric icon={Clock3} label="Em análise" value={items.filter((item) => item.status === 'reviewing').length} tone="reviewing" />
        <FeedbackMetric icon={CheckCircle2} label="Resolvidos" value={items.filter((item) => item.status === 'resolved').length} tone="resolved" />
        <FeedbackMetric icon={MessageSquareText} label="Total" value={items.length} tone="total" />
      </section>

      <section className="content-workspace feedback-workspace">
        <div className="content-toolbar feedback-toolbar">
          <label className="content-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por pessoa ou comentário"
            />
          </label>
          <label className="toolbar-select">
            <span>Situação</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="all">Todas</option>
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{STATUS_LABEL[option]}</option>)}
            </select>
          </label>
          <label className="toolbar-select">
            <span>Tipo</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
              <option value="all">Todos</option>
              <option value="suggestion">Sugestões</option>
              <option value="problem">Problemas</option>
              <option value="question">Dúvidas</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="content-empty">Carregando comentários…</div>
        ) : filtered.length === 0 ? (
          <div className="content-empty feedback-empty">
            <Sparkles size={30} />
            <strong>{items.length === 0 ? 'A fila está vazia' : 'Nenhum comentário encontrado'}</strong>
            <span>{items.length === 0 ? 'As mensagens enviadas pelo aplicativo aparecerão aqui.' : 'Ajuste a busca ou os filtros.'}</span>
          </div>
        ) : (
          <div className="feedback-list">
            {filtered.map((item) => (
              <article className={`feedback-item feedback-item--${item.status}`} key={item.id}>
                <div className="feedback-item__identity">
                  <span className="feedback-avatar">{initials(item.userName)}</span>
                  <div>
                    <strong>{item.userName}</strong>
                    <span>{item.username ? `@${item.username}` : shortUserId(item.userId)}</span>
                  </div>
                </div>

                <div className="feedback-item__body">
                  <div className="feedback-item__meta">
                    <span className={`feedback-category feedback-category--${item.category}`}>
                      {CATEGORY_LABEL[item.category]}
                    </span>
                    <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                  </div>
                  <p>{item.message}</p>
                  <div className="feedback-item__context">
                    <span>{platformLabel(item.platform)}</span>
                    <span>{item.sourceScreen}</span>
                    {item.appVersion ? <span>v{item.appVersion}</span> : null}
                  </div>
                </div>

                <div className="feedback-item__actions" aria-label={`Situação de ${item.userName}`}>
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={`feedback-status-action feedback-status-action--${option} ${item.status === option ? 'feedback-status-action--active' : ''}`}
                      onClick={() => void updateStatus(item, option)}
                      disabled={!canManage || updatingId === item.id}
                      aria-pressed={item.status === option}>
                      {STATUS_LABEL[option]}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FeedbackMetric({ icon: Icon, label, value, tone }: {
  icon: typeof Inbox;
  label: string;
  value: number;
  tone: 'new' | 'reviewing' | 'resolved' | 'total';
}) {
  return (
    <article className={`editorial-metric feedback-metric feedback-metric--${tone}`}>
      <Icon size={19} />
      <div><strong>{value}</strong><span>{label}</span></div>
    </article>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('pt-BR')).join('') || 'K';
}

function shortUserId(userId: string) {
  return `ID ${userId.slice(0, 8)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function platformLabel(platform: AdminFeedback['platform']) {
  if (platform === 'ios') return 'iOS';
  if (platform === 'android') return 'Android';
  if (platform === 'web') return 'Web';
  return 'Plataforma não informada';
}
