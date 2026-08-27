import { BookOpenCheck, CheckCircle2, CircleAlert, FilePenLine, Search, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/auth-context';
import { loadAdminQuestions, saveAdminQuestion } from '../lib/questions-api';
import type { AdminQuestion, AlternativeId, PublicationStatus } from '../types';

const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  draft: 'Rascunho', review: 'Em revisão', published: 'Publicado', archived: 'Arquivado',
};

export function QuestionsPage() {
  const { access, isPreview } = useAuth();
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | PublicationStatus>('all');
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canWrite = !isPreview && Boolean(access?.permissions.includes('content.write'));
  const canPublish = !isPreview && Boolean(access?.permissions.includes('content.publish'));

  const refresh = async () => {
    if (isPreview) return;
    setLoading(true);
    try { setQuestions(await loadAdminQuestions()); }
    catch { setError('Não foi possível carregar as questões. Aplique a migration editorial.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [isPreview]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return questions.filter((question) => (filter === 'all' || question.publicationStatus === filter)
      && (!term || `${question.discipline} ${question.subject} ${question.topic} ${question.board} ${question.statement}`.toLocaleLowerCase('pt-BR').includes(term)));
  }, [filter, query, questions]);

  const save = async (question: AdminQuestion) => {
    await saveAdminQuestion({ ...question, updatedAt: new Date().toISOString() });
    setEditing(null); setNotice(question.publicationStatus === 'published' ? 'Questão publicada.' : 'Questão salva no fluxo editorial.');
    await refresh();
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="page-eyebrow">CURADORIA DE CONTEÚDO</span><h1>Banco de questões</h1><p>Revise enunciado, alternativas, gabarito e fonte antes da publicação.</p></div></section>
    {isPreview ? <div className="page-alert page-alert--preview"><CircleAlert size={19}/><span>Conecte o Supabase para consultar e revisar questões reais.</span></div> : null}
    {error ? <div className="page-alert"><CircleAlert size={19}/><span>{error}</span></div> : null}
    {notice ? <div className="page-alert page-alert--success"><CheckCircle2 size={19}/><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Fechar"><X size={16}/></button></div> : null}
    <section className="editorial-metrics" aria-label="Resumo editorial">
      <Metric label="Total" value={questions.length}/><Metric label="Publicadas" value={questions.filter((q) => q.publicationStatus === 'published').length}/><Metric label="Em revisão" value={questions.filter((q) => q.publicationStatus === 'review').length}/><Metric label="Rascunhos" value={questions.filter((q) => q.publicationStatus === 'draft').length}/>
    </section>
    <section className="content-workspace"><div className="content-toolbar"><label className="content-search"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar disciplina, banca ou enunciado"/></label><label className="toolbar-select"><span>Situação editorial</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Todas</option><option value="draft">Rascunhos</option><option value="review">Em revisão</option><option value="published">Publicadas</option><option value="archived">Arquivadas</option></select></label></div>
      {loading ? <div className="content-empty">Carregando questões…</div> : filtered.length === 0 ? <div className="content-empty"><BookOpenCheck size={28}/><strong>Nenhuma questão encontrada</strong><span>Envie um lote em Importações ou ajuste os filtros.</span></div> : <div className="editorial-table-shell"><table className="editorial-table"><thead><tr><th>Questão</th><th>Banca / ano</th><th>Dificuldade</th><th>Publicação</th><th/></tr></thead><tbody>{filtered.map((question) => <tr key={question.id}><td><div className="question-cell"><strong>{question.discipline} · {question.subject}</strong><span>{question.topic}</span><small>{question.statement}</small></div></td><td>{question.board} · {question.year}</td><td>{question.difficulty ?? 'Não informada'}</td><td><span className={`publication-pill publication-pill--${question.publicationStatus}`}>{PUBLICATION_LABEL[question.publicationStatus]}</span></td><td><div className="row-actions"><button type="button" onClick={() => setEditing(structuredClone(question))} disabled={!canWrite} aria-label={`Editar ${question.id}`}><FilePenLine size={17}/></button></div></td></tr>)}</tbody></table></div>}
    </section>
    {editing ? <QuestionEditor question={editing} canPublish={canPublish} onClose={() => setEditing(null)} onSave={save}/> : null}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="editorial-metric"><BookOpenCheck size={19}/><div><strong>{value}</strong><span>{label}</span></div></article>;
}

function QuestionEditor({ question, canPublish, onClose, onSave }: { question: AdminQuestion; canPublish: boolean; onClose: () => void; onSave: (question: AdminQuestion) => Promise<void> }) {
  const [value, setValue] = useState(question);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof AdminQuestion>(key: K, next: AdminQuestion[K]) => setValue((current) => ({ ...current, [key]: next }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    if (value.statement.trim().length < 10) { setError('Revise o enunciado.'); return; }
    if (value.explanation && value.explanation.trim().length < 10) { setError('A explicação deve ter ao menos 10 caracteres ou ficar vazia.'); return; }
    if (value.publicationStatus === 'published' && !value.difficulty) { setError('Informe a dificuldade antes de publicar.'); return; }
    if (!value.alternatives.some((item) => item.id === value.correct)) { setError('O gabarito deve apontar para uma alternativa existente.'); return; }
    setSaving(true); try { await onSave(value); } catch { setError('Não foi possível salvar a questão.'); setSaving(false); }
  };
  return <div className="editor-backdrop"><aside className="concurso-editor question-editor" role="dialog" aria-modal="true"><form onSubmit={submit}><header className="editor-header"><div><span className="page-eyebrow">REVISÃO EDITORIAL</span><h2>{value.id}</h2></div><button type="button" className="editor-close" onClick={onClose}><X size={20}/></button></header><div className="editor-body">
    {error ? <div className="form-error"><CircleAlert size={17}/>{error}</div> : null}
    <div className="question-meta-grid"><label className="form-field"><span>Disciplina</span><input value={value.discipline} onChange={(e) => update('discipline', e.target.value)}/></label><label className="form-field"><span>Assunto</span><input value={value.subject} onChange={(e) => update('subject', e.target.value)}/></label><label className="form-field"><span>Tópico</span><input value={value.topic} onChange={(e) => update('topic', e.target.value)}/></label><label className="form-field"><span>Banca</span><input value={value.board} onChange={(e) => update('board', e.target.value)}/></label></div>
    <label className="form-field"><span>Enunciado</span><textarea rows={7} value={value.statement} onChange={(e) => update('statement', e.target.value)}/></label>
    <div className="alternative-editor">{value.alternatives.map((alternative, index) => <label className="form-field" key={alternative.id}><span>Alternativa {alternative.id}</span><textarea rows={2} value={alternative.text} onChange={(e) => update('alternatives', value.alternatives.map((item, itemIndex) => itemIndex === index ? { ...item, text: e.target.value } : item))}/></label>)}</div>
    <label className="form-field"><span>Gabarito</span><select value={value.correct} onChange={(e) => update('correct', e.target.value as AlternativeId)}>{value.alternatives.map((item) => <option key={item.id}>{item.id}</option>)}</select></label>
    <label className="form-field"><span>Dificuldade</span><select value={value.difficulty ?? ''} onChange={(e) => update('difficulty', (e.target.value || undefined) as AdminQuestion['difficulty'])}><option value="">Não informada</option><option value="Fácil">Fácil</option><option value="Média">Média</option><option value="Difícil">Difícil</option></select></label>
    <label className="form-field"><span>Explicação (opcional)</span><textarea rows={7} value={value.explanation ?? ''} onChange={(e) => update('explanation', e.target.value || undefined)}/></label>
    <label className="form-field"><span>Publicação</span><select value={value.publicationStatus} onChange={(e) => update('publicationStatus', e.target.value as PublicationStatus)}><option value="draft">Rascunho</option><option value="review">Em revisão</option><option value="published" disabled={!canPublish}>Publicado</option><option value="archived">Arquivado</option></select></label>
    {value.sourceUrl ? <a className="source-link" href={value.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte original</a> : null}
  </div><footer className="editor-footer"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar questão'}</button></footer></form></aside></div>;
}
