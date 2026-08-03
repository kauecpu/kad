import {
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FilePenLine,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import { StatusPill } from '../components/status-pill';
import { useAuth } from '../context/auth-context';
import {
  deleteAdminConcurso,
  loadAdminConcursos,
  saveAdminConcurso,
} from '../lib/concursos-api';
import type {
  AdminConcurso,
  AdminConcursoRole,
  ConcursoRegion,
  ConcursoStatus,
  EducationLevel,
  PublicationStatus,
} from '../types';

const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  draft: 'Rascunho',
  review: 'Em revisão',
  published: 'Publicado',
  archived: 'Arquivado',
};

const CONCURSO_STATUS_LABEL: Record<ConcursoStatus, string> = {
  aberto: 'Aberto',
  previsto: 'Previsto',
  encerrado: 'Encerrado',
};

const REGIONS: ConcursoRegion[] = [
  'Norte',
  'Nordeste',
  'Centro-Oeste',
  'Sudeste',
  'Sul',
  'Nacional',
];

const LEVELS: EducationLevel[] = ['Fundamental', 'Médio', 'Superior'];

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}

function emptyConcurso(): AdminConcurso {
  return {
    id: '',
    shortName: '',
    icon: 'business-outline',
    iconColor: '#6D28D9',
    organ: '',
    title: '',
    board: '',
    state: '',
    city: '',
    region: 'Nordeste',
    levels: ['Médio'],
    vacancies: 0,
    salaryMin: 0,
    salaryMax: 0,
    status: 'previsto',
    roles: [{ name: '', vacancies: 0, salary: 0, level: 'Médio' }],
    highlights: [],
    editalUrl: 'https://',
    publicationStatus: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

function prepareConcurso(concurso: AdminConcurso): AdminConcurso {
  const roles = concurso.roles.filter((role) => role.name.trim());
  const salaries = roles.map((role) => Number(role.salary) || 0);
  return {
    ...concurso,
    id: concurso.id || `c-${slugify(concurso.shortName || concurso.title)}`,
    shortName: concurso.shortName.trim(),
    organ: concurso.organ.trim(),
    title: concurso.title.trim(),
    board: concurso.board.trim(),
    state: concurso.region === 'Nacional' ? 'Nacional' : concurso.state.trim().toUpperCase(),
    city: concurso.region === 'Nacional' ? undefined : concurso.city?.trim() || undefined,
    levels: Array.from(new Set(roles.map((role) => role.level))),
    vacancies: roles.reduce((total, role) => total + (Number(role.vacancies) || 0), 0),
    salaryMin: salaries.length ? Math.min(...salaries) : 0,
    salaryMax: salaries.length ? Math.max(...salaries) : 0,
    fee: concurso.fee === undefined || Number.isNaN(Number(concurso.fee))
      ? undefined
      : Number(concurso.fee),
    roles,
    highlights: concurso.highlights.map((item) => item.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
}

export function ConcursosPage() {
  const { access, isPreview } = useAuth();
  const [concursos, setConcursos] = useState<AdminConcurso[]>([]);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [publicationFilter, setPublicationFilter] = useState<'all' | PublicationStatus>('all');
  const [editing, setEditing] = useState<AdminConcurso | null>(null);
  const [isNew, setIsNew] = useState(false);

  const canWrite = Boolean(access?.permissions.includes('content.write'));
  const canPublish = !isPreview && Boolean(access?.permissions.includes('content.publish'));

  const refresh = async () => {
    if (isPreview) return;
    setLoading(true);
    setError(null);
    try {
      setConcursos(await loadAdminConcursos());
    } catch {
      setError('Não foi possível carregar os concursos. Aplique a migration editorial no Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [isPreview]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return concursos.filter((concurso) => {
      if (publicationFilter !== 'all' && concurso.publicationStatus !== publicationFilter) {
        return false;
      }
      if (!term) return true;
      return `${concurso.shortName} ${concurso.organ} ${concurso.title} ${concurso.board}`
        .toLocaleLowerCase('pt-BR')
        .includes(term);
    });
  }, [concursos, publicationFilter, query]);

  const summary = useMemo(
    () => ({
      published: concursos.filter((item) => item.publicationStatus === 'published').length,
      review: concursos.filter((item) => item.publicationStatus === 'review').length,
      draft: concursos.filter((item) => item.publicationStatus === 'draft').length,
    }),
    [concursos],
  );

  const openNew = () => {
    setIsNew(true);
    setEditing(emptyConcurso());
  };

  const openEdit = (concurso: AdminConcurso) => {
    setIsNew(false);
    setEditing(structuredClone(concurso));
  };

  const handleSave = async (concurso: AdminConcurso) => {
    const prepared = prepareConcurso(concurso);
    setError(null);

    if (isPreview) {
      setConcursos((current) => {
        const exists = current.some((item) => item.id === prepared.id);
        return exists
          ? current.map((item) => (item.id === prepared.id ? prepared : item))
          : [prepared, ...current];
      });
      setNotice('Rascunho temporário salvo somente nesta sessão local.');
      setEditing(null);
      return;
    }

    await saveAdminConcurso(prepared);
    setNotice(
      prepared.publicationStatus === 'published'
        ? 'Concurso publicado e disponível para o aplicativo.'
        : 'Concurso salvo no fluxo editorial.',
    );
    setEditing(null);
    await refresh();
  };

  const handleDelete = async (concurso: AdminConcurso) => {
    if (!window.confirm(`Excluir “${concurso.shortName} · ${concurso.title}”?`)) return;

    try {
      if (isPreview) {
        setConcursos((current) => current.filter((item) => item.id !== concurso.id));
      } else {
        await deleteAdminConcurso(concurso.id);
        await refresh();
      }
      setNotice(
        isPreview
          ? 'Rascunho temporário removido da sessão local.'
          : 'Concurso excluído e ação registrada.',
      );
    } catch {
      setError('Não foi possível excluir o concurso.');
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading concursos-heading">
        <div>
          <span className="page-eyebrow">GESTÃO DE OPORTUNIDADES</span>
          <h1>Concursos</h1>
          <p>Cadastre, revise e publique editais com cargos e fonte oficial.</p>
        </div>
        {canWrite ? (
          <button type="button" className="primary-button" onClick={openNew}>
            <Plus size={18} /> {isPreview ? 'Novo rascunho local' : 'Novo concurso'}
          </button>
        ) : null}
      </section>

      {isPreview ? (
        <div className="page-alert page-alert--preview">
          <CircleAlert size={19} />
          <span>Modo local sem dados reais: rascunhos ficam somente nesta sessão e não podem ser publicados.</span>
        </div>
      ) : null}
      {error ? <div className="page-alert" role="alert"><CircleAlert size={19} /><span>{error}</span></div> : null}
      {notice ? (
        <div className="page-alert page-alert--success" role="status">
          <CheckCircle2 size={19} /><span>{notice}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setNotice(null)}><X size={16} /></button>
        </div>
      ) : null}

      <section className="editorial-metrics" aria-label="Resumo editorial">
        <EditorialMetric icon={BriefcaseBusiness} label="Total" value={concursos.length} />
        <EditorialMetric icon={CheckCircle2} label="Publicados" value={summary.published} tone="success" />
        <EditorialMetric icon={Clock3} label="Em revisão" value={summary.review} tone="warning" />
        <EditorialMetric icon={FilePenLine} label="Rascunhos" value={summary.draft} />
      </section>

      <section className="content-workspace">
        <div className="content-toolbar">
          <label className="content-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por órgão, cargo ou banca"
            />
          </label>
          <label className="toolbar-select">
            <span>Situação editorial</span>
            <select
              value={publicationFilter}
              onChange={(event) => setPublicationFilter(event.target.value as typeof publicationFilter)}>
              <option value="all">Todas</option>
              <option value="draft">Rascunhos</option>
              <option value="review">Em revisão</option>
              <option value="published">Publicados</option>
              <option value="archived">Arquivados</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="content-empty">Carregando concursos…</div>
        ) : filtered.length === 0 ? (
          <div className="content-empty">
            <BriefcaseBusiness size={28} />
            <strong>{isPreview ? 'Nenhum concurso real carregado' : 'Nenhum concurso encontrado'}</strong>
            <span>{isPreview ? 'Conecte e autentique o Supabase para consultar informações reais.' : 'Ajuste os filtros ou cadastre a primeira oportunidade.'}</span>
          </div>
        ) : (
          <div className="editorial-table-shell">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Concurso</th>
                  <th>Banca</th>
                  <th>Vagas</th>
                  <th>Edital</th>
                  <th>Publicação</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((concurso) => (
                  <tr key={concurso.id}>
                    <td>
                      <div className="concurso-cell">
                        <span className="concurso-monogram" style={{ color: concurso.iconColor }}>
                          {concurso.shortName.slice(0, 3)}
                        </span>
                        <div>
                          <strong>{concurso.shortName} · {concurso.title}</strong>
                          <span>{concurso.organ} · {concurso.state}</span>
                        </div>
                      </div>
                    </td>
                    <td>{concurso.board}</td>
                    <td>{concurso.vacancies.toLocaleString('pt-BR')}</td>
                    <td><StatusPill active={concurso.status === 'aberto'}>{CONCURSO_STATUS_LABEL[concurso.status]}</StatusPill></td>
                    <td><PublicationPill status={concurso.publicationStatus} /></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" title="Editar" aria-label={`Editar ${concurso.shortName}`} onClick={() => openEdit(concurso)} disabled={!canWrite}>
                          <FilePenLine size={17} />
                        </button>
                        <button type="button" className="danger-action" title="Excluir" aria-label={`Excluir ${concurso.shortName}`} onClick={() => void handleDelete(concurso)} disabled={!canWrite}>
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? (
        <ConcursoEditor
          concurso={editing}
          isNew={isNew}
          canPublish={canPublish}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}

function EditorialMetric({
  icon: Icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: number;
  tone?: 'primary' | 'success' | 'warning';
}) {
  return (
    <article className={`editorial-metric editorial-metric--${tone}`}>
      <Icon size={19} />
      <div><strong>{value}</strong><span>{label}</span></div>
    </article>
  );
}

function PublicationPill({ status }: { status: PublicationStatus }) {
  const icon = status === 'published'
    ? <CheckCircle2 size={14} />
    : status === 'review'
      ? <Clock3 size={14} />
      : <FilePenLine size={14} />;
  return <span className={`publication-pill publication-pill--${status}`}>{icon}{PUBLICATION_LABEL[status]}</span>;
}

function ConcursoEditor({
  concurso,
  isNew,
  canPublish,
  onClose,
  onSave,
}: {
  concurso: AdminConcurso;
  isNew: boolean;
  canPublish: boolean;
  onClose: () => void;
  onSave: (value: AdminConcurso) => Promise<void>;
}) {
  const [value, setValue] = useState(concurso);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const update = <K extends keyof AdminConcurso>(key: K, next: AdminConcurso[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
  };

  const updateRole = <K extends keyof AdminConcursoRole>(
    index: number,
    key: K,
    next: AdminConcursoRole[K],
  ) => {
    update('roles', value.roles.map((role, roleIndex) =>
      roleIndex === index ? { ...role, [key]: next } : role,
    ));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!value.shortName.trim() || !value.organ.trim() || !value.title.trim() || !value.board.trim()) {
      setFormError('Preencha identificação, órgão, título e banca.');
      return;
    }
    if (!value.roles.some((role) => role.name.trim())) {
      setFormError('Adicione pelo menos um cargo.');
      return;
    }
    if (!/^https:\/\//.test(value.editalUrl)) {
      setFormError('Informe uma página oficial iniciada por https://.');
      return;
    }
    setSaving(true);
    try {
      await onSave(value);
    } catch {
      setFormError('Não foi possível salvar. Confira a migration e os campos informados.');
      setSaving(false);
    }
  };

  return (
    <div className="editor-backdrop" role="presentation">
      <aside className="concurso-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <form onSubmit={submit}>
          <header className="editor-header">
            <div>
              <span className="page-eyebrow">FLUXO EDITORIAL</span>
              <h2 id="editor-title">{isNew ? 'Novo concurso' : `Editar ${value.shortName}`}</h2>
            </div>
            <button type="button" className="editor-close" onClick={onClose} aria-label="Fechar editor"><X size={20} /></button>
          </header>

          <div className="editor-body">
            {formError ? <div className="form-error"><CircleAlert size={17} />{formError}</div> : null}

            <EditorSection title="Identificação" description="Como a oportunidade será encontrada no KAD.">
              <div className="form-grid form-grid--three">
                <Field label="Sigla" required><input value={value.shortName} onChange={(event) => update('shortName', event.target.value)} placeholder="TJ-SP" /></Field>
                <Field label="Banca" required><input value={value.board} onChange={(event) => update('board', event.target.value)} placeholder="VUNESP" /></Field>
                <Field label="Cor da marca"><input type="color" value={value.iconColor} onChange={(event) => update('iconColor', event.target.value)} /></Field>
              </div>
              <Field label="Órgão" required><input value={value.organ} onChange={(event) => update('organ', event.target.value)} placeholder="Tribunal de Justiça…" /></Field>
              <Field label="Título do edital" required><input value={value.title} onChange={(event) => update('title', event.target.value)} placeholder="Escrevente Técnico Judiciário" /></Field>
              <Field label="Identificador interno" hint={isNew ? 'Gerado automaticamente se ficar vazio.' : 'Não pode ser alterado após o cadastro.'}>
                <input value={value.id} onChange={(event) => update('id', slugify(event.target.value))} placeholder="c-tjsp-escrevente" disabled={!isNew} />
              </Field>
            </EditorSection>

            <EditorSection title="Local e situação" description="Dados usados nos filtros do aplicativo.">
              <div className="form-grid form-grid--three">
                <Field label="Região"><select value={value.region} onChange={(event) => update('region', event.target.value as ConcursoRegion)}>{REGIONS.map((region) => <option key={region}>{region}</option>)}</select></Field>
                <Field label="UF"><input value={value.state} onChange={(event) => update('state', event.target.value)} maxLength={30} disabled={value.region === 'Nacional'} placeholder="CE" /></Field>
                <Field label="Cidade"><input value={value.city ?? ''} onChange={(event) => update('city', event.target.value)} disabled={value.region === 'Nacional'} placeholder="Fortaleza" /></Field>
              </div>
              <div className="form-grid form-grid--three">
                <Field label="Situação do edital"><select value={value.status} onChange={(event) => update('status', event.target.value as ConcursoStatus)}>{Object.entries(CONCURSO_STATUS_LABEL).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></Field>
                <Field label="Inscrições até"><input type="date" value={value.registrationEnd ?? ''} onChange={(event) => update('registrationEnd', event.target.value || undefined)} /></Field>
                <Field label="Data da prova"><input type="date" value={value.examDate ?? ''} onChange={(event) => update('examDate', event.target.value || undefined)} /></Field>
              </div>
              <div className="form-grid form-grid--two">
                <Field label="Início das inscrições"><input type="date" value={value.registrationStart ?? ''} onChange={(event) => update('registrationStart', event.target.value || undefined)} /></Field>
                <Field label="Taxa de inscrição"><input type="number" min="0" step="0.01" value={value.fee ?? ''} onChange={(event) => update('fee', event.target.value === '' ? undefined : Number(event.target.value))} placeholder="0,00" /></Field>
              </div>
            </EditorSection>

            <EditorSection title="Cargos" description="Vagas, salários e escolaridade são consolidados automaticamente.">
              <div className="role-editor-list">
                {value.roles.map((role, index) => (
                  <div className="role-editor-row" key={`${index}-${role.name}`}>
                    <Field label={`Cargo ${index + 1}`}><input value={role.name} onChange={(event) => updateRole(index, 'name', event.target.value)} placeholder="Nome do cargo" /></Field>
                    <Field label="Vagas"><input type="number" min="0" value={role.vacancies} onChange={(event) => updateRole(index, 'vacancies', Number(event.target.value))} /></Field>
                    <Field label="Salário"><input type="number" min="0" step="0.01" value={role.salary} onChange={(event) => updateRole(index, 'salary', Number(event.target.value))} /></Field>
                    <Field label="Nível"><select value={role.level} onChange={(event) => updateRole(index, 'level', event.target.value as EducationLevel)}>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></Field>
                    <button type="button" className="remove-role" onClick={() => update('roles', value.roles.filter((_, roleIndex) => roleIndex !== index))} disabled={value.roles.length === 1} aria-label={`Remover cargo ${index + 1}`}><Trash2 size={17} /></button>
                  </div>
                ))}
              </div>
              <button type="button" className="secondary-button add-role" onClick={() => update('roles', [...value.roles, { name: '', vacancies: 0, salary: 0, level: 'Médio' }])}><Plus size={16} /> Adicionar cargo</button>
            </EditorSection>

            <EditorSection title="Fonte e destaques" description="O link oficial é obrigatório para publicação.">
              <Field label="Página oficial" required><input type="url" value={value.editalUrl} onChange={(event) => update('editalUrl', event.target.value)} placeholder="https://…" /></Field>
              <Field label="Destaques" hint="Use uma linha para cada destaque."><textarea rows={4} value={value.highlights.join('\n')} onChange={(event) => update('highlights', event.target.value.split('\n'))} placeholder="Prova objetiva e discursiva…" /></Field>
            </EditorSection>

            <EditorSection title="Publicação" description="Somente itens publicados aparecem no aplicativo.">
              <div className="publication-options">
                {(['draft', 'review', 'published', 'archived'] as PublicationStatus[]).map((status) => (
                  <label className={`publication-option ${value.publicationStatus === status ? 'publication-option--selected' : ''}`} key={status}>
                    <input type="radio" name="publication" value={status} checked={value.publicationStatus === status} onChange={() => update('publicationStatus', status)} disabled={status === 'published' && !canPublish} />
                    <span>{status === 'published' ? <Send size={17} /> : <FilePenLine size={17} />}</span>
                    <strong>{PUBLICATION_LABEL[status]}</strong>
                  </label>
                ))}
              </div>
            </EditorSection>
          </div>

          <footer className="editor-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Salvando…' : value.publicationStatus === 'published' ? 'Salvar e publicar' : 'Salvar concurso'}</button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function EditorSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="editor-section"><div className="editor-section__heading"><h3>{title}</h3><p>{description}</p></div><div className="editor-section__content">{children}</div></section>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return <label className="form-field"><span>{label}{required ? ' *' : ''}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}
