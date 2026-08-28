import {
  ArchiveRestore,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  FilePenLine,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/auth-context';
import {
  applyQuestionPublication,
  loadAdminQuestions,
  previewQuestionPublication,
  saveAdminQuestion,
} from '../lib/questions-api';
import { adminKadEnvironment } from '../lib/supabase';
import type {
  AdminQuestion,
  AlternativeId,
  PublicationStatus,
  QuestionPublicationAction,
  QuestionPublicationPreview,
} from '../types';

const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  draft: 'Rascunho', review: 'Aprovada', published: 'Publicada', archived: 'Retirada',
};

const ACTION_LABEL: Record<QuestionPublicationAction, string> = {
  approve: 'aprovação', publish: 'publicação', withdraw: 'retirada',
};

export function QuestionsPage() {
  const { access, isPreview } = useAuth();
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<QuestionPublicationPreview | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | PublicationStatus>('all');
  const [loading, setLoading] = useState(!isPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canWrite = !isPreview && Boolean(access?.permissions.includes('content.write'));
  const canPublish = !isPreview && Boolean(access?.permissions.includes('content.publish'));

  const refresh = async () => {
    if (isPreview) return;
    setLoading(true);
    try {
      setQuestions(await loadAdminQuestions());
      setError(null);
    } catch {
      setError('Não foi possível carregar as questões. Aplique a migration editorial.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [isPreview]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return questions.filter((question) => (filter === 'all' || question.publicationStatus === filter)
      && (!term || `${question.discipline} ${question.subject} ${question.topic} ${question.board} ${question.statement}`.toLocaleLowerCase('pt-BR').includes(term)));
  }, [filter, query, questions]);

  const filteredIds = filtered.map((question) => question.id);
  const allFilteredSelected = filteredIds.length > 0
    && filteredIds.every((id) => selected.has(id));

  const save = async (question: AdminQuestion) => {
    await saveAdminQuestion({ ...question, updatedAt: new Date().toISOString() });
    setEditing(null);
    setNotice('Questão salva. Alterações em conteúdo aprovado exigem nova aprovação.');
    await refresh();
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFiltered = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const openPreview = async (action: QuestionPublicationAction) => {
    if (!selected.size) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewQuestionPublication([...selected], action));
    } catch {
      setError('Não foi possível preparar a prévia. Atualize a página e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const applyPreview = async () => {
    if (!preview?.eligibleCount) return;
    setBusy(true);
    setError(null);
    try {
      const result = await applyQuestionPublication(
        preview.items.map((item) => item.id),
        preview.action,
        preview.previewFingerprint,
      );
      setNotice(`${result.appliedCount} questão(ões) concluída(s); ${result.blockedCount} permaneceram sem alteração.`);
      setPreview(null);
      setSelected(new Set());
      await refresh();
    } catch {
      setError('A prévia expirou ou o ambiente não confere. Gere uma nova prévia.');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="page-eyebrow">CURADORIA DE CONTEÚDO</span><h1>Banco de questões</h1><p>Revise, aprove e publique sem alterar o gabarito oficial.</p></div></section>
    {isPreview ? <div className="page-alert page-alert--preview"><CircleAlert size={19}/><span>Conecte o Supabase para consultar e revisar questões reais.</span></div> : null}
    {!isPreview ? <div className={`environment-guard environment-guard--${adminKadEnvironment}`}><ShieldCheck size={18}/><span>Ambiente confirmado: <strong>{adminKadEnvironment === 'staging' ? 'homologação' : 'produção'}</strong>. Cada ação é validada novamente pelo banco.</span></div> : null}
    {error ? <div className="page-alert"><CircleAlert size={19}/><span>{error}</span></div> : null}
    {notice ? <div className="page-alert page-alert--success"><CheckCircle2 size={19}/><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Fechar"><X size={16}/></button></div> : null}
    <section className="editorial-metrics" aria-label="Resumo editorial">
      <Metric label="Total" value={questions.length}/><Metric label="Publicadas" value={questions.filter((q) => q.publicationStatus === 'published').length}/><Metric label="Aprovadas" value={questions.filter((q) => q.publicationStatus === 'review').length}/><Metric label="Rascunhos" value={questions.filter((q) => q.publicationStatus === 'draft').length}/>
    </section>
    <section className="content-workspace">
      <div className="content-toolbar question-toolbar">
        <label className="content-search"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar disciplina, banca ou enunciado"/></label>
        <label className="toolbar-select"><span>Situação editorial</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Todas</option><option value="draft">Rascunhos</option><option value="review">Aprovadas</option><option value="published">Publicadas</option><option value="archived">Retiradas</option></select></label>
      </div>
      <div className="bulk-publication-bar" aria-label="Ações em lote">
        <span><strong>{selected.size}</strong> selecionada(s)</span>
        <div>
          <button type="button" className="secondary-button" disabled={!selected.size || busy || !canWrite} onClick={() => void openPreview('approve')}><ShieldCheck size={16}/> Aprovar</button>
          <button type="button" className="primary-button" disabled={!selected.size || busy || !canPublish} onClick={() => void openPreview('publish')}><Send size={16}/> Publicar</button>
          <button type="button" className="secondary-button" disabled={!selected.size || busy || !canPublish} onClick={() => void openPreview('withdraw')}><ArchiveRestore size={16}/> Retirar</button>
        </div>
      </div>
      {loading ? <div className="content-empty">Carregando questões…</div> : filtered.length === 0 ? <div className="content-empty"><BookOpenCheck size={28}/><strong>Nenhuma questão encontrada</strong><span>Envie um lote em Importações ou ajuste os filtros.</span></div> : <div className="editorial-table-shell"><table className="editorial-table question-publication-table"><thead><tr><th><input type="checkbox" checked={allFilteredSelected} onChange={toggleFiltered} aria-label="Selecionar questões visíveis"/></th><th>Questão</th><th>Banca / ano</th><th>Validação</th><th>Publicação</th><th/></tr></thead><tbody>{filtered.map((question) => <tr key={question.id} className={selected.has(question.id) ? 'row-selected' : undefined}><td><input type="checkbox" checked={selected.has(question.id)} onChange={() => toggleSelected(question.id)} aria-label={`Selecionar ${question.id}`}/></td><td><div className="question-cell"><strong>{question.discipline} · {question.subject}</strong><span>{question.topic}</span><small>{question.statement}</small></div></td><td>{question.board} · {question.year}</td><td>{question.publicationBlockers.length ? <span className="validation-summary validation-summary--blocked">{question.publicationBlockers.length} impedimento(s)</span> : <span className="validation-summary validation-summary--ready"><CheckCircle2 size={13}/> Pronta</span>}</td><td><span className={`publication-pill publication-pill--${question.publicationStatus}`}>{PUBLICATION_LABEL[question.publicationStatus]}</span></td><td><div className="row-actions"><button type="button" onClick={() => setEditing(structuredClone(question))} disabled={!canWrite} aria-label={`Editar ${question.id}`}><FilePenLine size={17}/></button></div></td></tr>)}</tbody></table></div>}
    </section>
    {editing ? <QuestionEditor question={editing} onClose={() => setEditing(null)} onSave={save}/> : null}
    {preview ? <PublicationPreviewDialog preview={preview} busy={busy} onClose={() => setPreview(null)} onApply={applyPreview}/> : null}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="editorial-metric"><BookOpenCheck size={19}/><div><strong>{value}</strong><span>{label}</span></div></article>;
}

function PublicationPreviewDialog({ preview, busy, onClose, onApply }: { preview: QuestionPublicationPreview; busy: boolean; onClose: () => void; onApply: () => Promise<void> }) {
  return <div className="editor-backdrop"><aside className="concurso-editor publication-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="publication-preview-title"><div className="publication-preview-layout"><header className="editor-header"><div><span className="page-eyebrow">PRÉVIA OBRIGATÓRIA</span><h2 id="publication-preview-title">Confirmar {ACTION_LABEL[preview.action]}</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label="Fechar"><X size={20}/></button></header><div className="editor-body">
    <div className="publication-preview-summary"><div><strong>{preview.eligibleCount}</strong><span>serão alteradas</span></div><div><strong>{preview.blockedCount}</strong><span>permanecerão iguais</span></div></div>
    <p className="publication-preview-copy">Somente as questões sem impedimentos serão alteradas. Se algum conteúdo mudar, esta prévia expira automaticamente.</p>
    <div className="publication-preview-list">{preview.items.map((item) => <article key={item.id} className={item.canApply ? 'preview-item preview-item--ready' : 'preview-item preview-item--blocked'}><div><strong>{item.id}</strong><span>{item.currentStatus ? PUBLICATION_LABEL[item.currentStatus] : 'Ausente'} → {PUBLICATION_LABEL[item.targetStatus]}</span></div>{item.blockers.length ? <ul>{item.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <span className="validation-summary validation-summary--ready"><CheckCircle2 size={13}/> Sem impedimentos</span>}</article>)}</div>
  </div><footer className="editor-footer"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="button" disabled={busy || preview.eligibleCount === 0} onClick={() => void onApply()}>{busy ? 'Aplicando…' : `Confirmar ${ACTION_LABEL[preview.action]}`}</button></footer></div></aside></div>;
}

function QuestionEditor({ question, onClose, onSave }: { question: AdminQuestion; onClose: () => void; onSave: (question: AdminQuestion) => Promise<void> }) {
  const [value, setValue] = useState(question);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof AdminQuestion>(key: K, next: AdminQuestion[K]) => setValue((current) => ({ ...current, [key]: next }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    if (value.statement.trim().length < 10) { setError('Revise o enunciado.'); return; }
    if (value.explanation && value.explanation.trim().length < 10) { setError('A explicação deve ter ao menos 10 caracteres ou ficar vazia.'); return; }
    if (!value.alternatives.some((item) => item.id === value.correct)) { setError('O gabarito deve apontar para uma alternativa existente.'); return; }
    setSaving(true); try { await onSave(value); } catch { setError(value.publicationStatus === 'published' ? 'Retire a questão antes de editar conteúdo publicado.' : 'Não foi possível salvar a questão.'); setSaving(false); }
  };
  return <div className="editor-backdrop"><aside className="concurso-editor question-editor" role="dialog" aria-modal="true"><form onSubmit={submit}><header className="editor-header"><div><span className="page-eyebrow">REVISÃO EDITORIAL</span><h2>{value.id}</h2></div><button type="button" className="editor-close" onClick={onClose}><X size={20}/></button></header><div className="editor-body">
    {error ? <div className="form-error"><CircleAlert size={17}/>{error}</div> : null}
    <div className="question-review-state"><span className={`publication-pill publication-pill--${value.publicationStatus}`}>{PUBLICATION_LABEL[value.publicationStatus]}</span><small>O estado editorial só muda pelas ações em lote com prévia.</small></div>
    {value.publicationBlockers.length ? <div className="question-blockers"><strong>Impedimentos atuais</strong><ul>{value.publicationBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
    <div className="question-meta-grid"><label className="form-field"><span>Disciplina</span><input value={value.discipline} onChange={(e) => update('discipline', e.target.value)}/></label><label className="form-field"><span>Assunto</span><input value={value.subject} onChange={(e) => update('subject', e.target.value)}/></label><label className="form-field"><span>Tópico</span><input value={value.topic} onChange={(e) => update('topic', e.target.value)}/></label><label className="form-field"><span>Banca</span><input value={value.board} onChange={(e) => update('board', e.target.value)}/></label></div>
    <label className="form-field"><span>Enunciado</span><textarea rows={7} value={value.statement} onChange={(e) => update('statement', e.target.value)}/></label>
    <div className="alternative-editor">{value.alternatives.map((alternative, index) => <label className="form-field" key={alternative.id}><span>Alternativa {alternative.id}</span><textarea rows={2} value={alternative.text} onChange={(e) => update('alternatives', value.alternatives.map((item, itemIndex) => itemIndex === index ? { ...item, text: e.target.value } : item))}/></label>)}</div>
    <label className="form-field"><span>Gabarito</span><select value={value.correct} onChange={(e) => update('correct', e.target.value as AlternativeId)}>{value.alternatives.map((item) => <option key={item.id}>{item.id}</option>)}</select></label>
    <label className="form-field"><span>Dificuldade</span><select value={value.difficulty ?? ''} onChange={(e) => update('difficulty', (e.target.value || undefined) as AdminQuestion['difficulty'])}><option value="">Não informada</option><option value="Fácil">Fácil</option><option value="Média">Média</option><option value="Difícil">Difícil</option></select></label>
    <label className="form-field"><span>Explicação (opcional)</span><textarea rows={7} value={value.explanation ?? ''} onChange={(e) => update('explanation', e.target.value || undefined)}/></label>
    {value.sourceUrl ? <a className="source-link" href={value.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte original</a> : null}
  </div><footer className="editor-footer"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar questão'}</button></footer></form></aside></div>;
}
