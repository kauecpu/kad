import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FilePenLine,
  FileJson2,
  History,
  LoaderCircle,
  PackageCheck,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/auth-context';
import { parseEditorialImport, type ImportParseResult } from '../lib/editorial-import';
import {
  applyImportBatch,
  createImportBatch,
  loadImportBatch,
  loadImportBatches,
  rollbackImportBatch,
  setImportDecision,
  updateImportItem,
} from '../lib/imports-api';
import { publishInitialCatalog } from '../lib/local-catalog-api';
import type {
  AdminImportBatch,
  AdminImportBatchDetail,
  AdminImportItem,
  EditorialImportRecord,
  ImportDecision,
} from '../types';

const STATUS_LABEL: Record<string, string> = {
  staging: 'Aguardando revisão', imported: 'Importado', import_partial: 'Importação parcial',
  rolled_back: 'Desfeito', rollback_partial: 'Reversão parcial', ready: 'Pronto',
  duplicate: 'Duplicado', invalid: 'Inválido', skipped: 'Ignorado', failed: 'Falhou',
  rollback_blocked: 'Reversão bloqueada',
};

export function ImportsPage() {
  const { access, isPreview } = useAuth();
  const [batches, setBatches] = useState<AdminImportBatch[]>([]);
  const [detail, setDetail] = useState<AdminImportBatchDetail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<AdminImportItem | null>(null);
  const [editorText, setEditorText] = useState('');
  const [editorError, setEditorError] = useState<string | null>(null);
  const [publishProgress, setPublishProgress] = useState<string | null>(null);
  const canWrite = !isPreview && Boolean(access?.permissions.includes('content.write'));
  const canPublish = !isPreview && Boolean(access?.permissions.includes('content.publish'));

  const refresh = async (selectedId?: string) => {
    if (isPreview) return;
    const next = await loadImportBatches();
    setBatches(next);
    const id = selectedId ?? detail?.id;
    if (id) setDetail(await loadImportBatch(id));
  };

  useEffect(() => {
    if (isPreview) return;
    setBusy(true);
    refresh().catch(() => setError('Não foi possível carregar os lotes. Aplique a migration editorial.')).finally(() => setBusy(false));
  }, [isPreview]);

  const chooseFile = async (selected: File | null) => {
    setFile(selected);
    setError(null);
    setPreview(selected ? parseEditorialImport(await selected.text()) : null);
  };

  const sendBatch = async () => {
    if (!file || !preview?.records.length || !canWrite) return;
    setBusy(true); setError(null);
    try {
      const id = await createImportBatch(file.name, preview.records);
      await refresh(id);
      setFile(null); setPreview(null);
      setNotice('Lote enviado para revisão. Os itens ainda não foram gravados no catálogo.');
    } catch {
      setError('Não foi possível criar o lote. Confira a migration e o contrato do arquivo.');
    } finally { setBusy(false); }
  };

  const changeDecision = async (itemId: string, decision: ImportDecision) => {
    if (!detail) return;
    setBusy(true); setError(null);
    try { await setImportDecision(itemId, decision); await refresh(detail.id); }
    catch { setError('Não foi possível alterar a decisão do item.'); }
    finally { setBusy(false); }
  };

  const openItem = (item: AdminImportItem) => {
    setEditingItem(item);
    setEditorText(JSON.stringify(item.payload, null, 2));
    setEditorError(null);
  };

  const saveItem = async () => {
    if (!editingItem || !detail || detail.status !== 'staging' || !canWrite) return;
    setEditorError(null);
    let record: unknown;
    try {
      record = JSON.parse(editorText);
    } catch {
      setEditorError('O conteúdo precisa ser um objeto JSON válido.');
      return;
    }

    const parsed = parseEditorialImport(JSON.stringify(record));
    if (parsed.issues.length || parsed.records.length !== 1) {
      setEditorError(parsed.issues[0]?.message ?? 'O registro não segue o envelope editorial.');
      return;
    }

    setBusy(true);
    try {
      await updateImportItem(editingItem.id, parsed.records[0] as EditorialImportRecord);
      await refresh(detail.id);
      setEditingItem(null);
      setNotice('Registro atualizado e revalidado no staging.');
    } catch {
      setEditorError('Não foi possível atualizar o registro. Confira o contrato e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!detail || !window.confirm('Importar os itens selecionados como rascunhos?')) return;
    setBusy(true); setError(null);
    try {
      const result = await applyImportBatch(detail.id);
      await refresh(detail.id);
      setNotice(`${result.imported} item(ns) importado(s), ${result.skipped} ignorado(s) e ${result.failed} com falha.`);
    } catch { setError('Não foi possível aplicar o lote.'); }
    finally { setBusy(false); }
  };

  const rollback = async () => {
    if (!detail || !window.confirm('Desfazer este lote? Itens já publicados serão preservados.')) return;
    setBusy(true); setError(null);
    try {
      const result = await rollbackImportBatch(detail.id);
      await refresh(detail.id);
      setNotice(`${result.rolledBack} item(ns) desfeito(s); ${result.blocked} protegido(s) contra reversão.`);
    } catch { setError('Não foi possível desfazer o lote.'); }
    finally { setBusy(false); }
  };

  const publishCatalog = async () => {
    if (
      !canPublish ||
      !window.confirm(
        'Publicar os 15 concursos e as 51 questões do acervo inicial no aplicativo?',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await publishInitialCatalog(({ completed, total, label }) => {
        setPublishProgress(`${completed} de ${total} · ${label}`);
      });
      setNotice(
        `${result.concursos} concursos e ${result.questions} questões publicados no catálogo.`,
      );
      await refresh();
    } catch {
      setError(
        'A publicação foi interrompida. Corrija o item indicado e tente novamente; a operação é idempotente.',
      );
    } finally {
      setPublishProgress(null);
      setBusy(false);
    }
  };

  const readyToImport = useMemo(() => detail?.items.filter((item) =>
    (item.status === 'ready' || item.status === 'duplicate') && item.decision !== 'skip').length ?? 0, [detail]);

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="page-eyebrow">ENTRADA EDITORIAL</span><h1>Importações</h1><p>Valide, revise e incorpore lotes do coletor sem publicar conteúdo automaticamente.</p></div></section>
      {isPreview ? <div className="page-alert page-alert--preview"><CircleAlert size={19}/><span>Importações exigem uma sessão administrativa conectada ao Supabase.</span></div> : null}
      {error ? <div className="page-alert" role="alert"><CircleAlert size={19}/><span>{error}</span></div> : null}
      {notice ? <div className="page-alert page-alert--success"><CheckCircle2 size={19}/><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Fechar"><X size={16}/></button></div> : null}

      <section className="content-workspace">
        <div className="batch-detail-heading">
          <div>
            <span className="page-eyebrow">ACERVO INICIAL DO KAD</span>
            <h2>Publicar conteúdo que já está no aplicativo</h2>
            <p>15 concursos e 51 questões autorais, usando a sessão administrativa e o log de auditoria.</p>
            {publishProgress ? <small aria-live="polite">Publicando {publishProgress}</small> : null}
          </div>
          <div className="batch-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => void publishCatalog()}
              disabled={!canPublish || busy}>
              {busy && publishProgress ? <LoaderCircle className="spin" size={17}/> : <PackageCheck size={17}/>}
              Publicar acervo inicial
            </button>
          </div>
        </div>
        {!canPublish ? <p className="form-hint">Esta ação exige a permissão content.publish.</p> : null}
      </section>

      <section className="import-grid">
        <article className="import-upload-card">
          <div className="import-card-heading"><span><Upload size={20}/></span><div><h2>Novo lote</h2><p>Arquivos JSONL, NDJSON ou JSON com até 500 registros.</p></div></div>
          <label className="file-drop">
            <FileJson2 size={28}/><strong>{file?.name ?? 'Selecionar arquivo do coletor'}</strong><span>O conteúdo é apenas pré-validado até você enviar.</span>
            <input type="file" accept=".json,.jsonl,.ndjson,application/json" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} disabled={busy || (!isPreview && !canWrite)}/>
          </label>
          {preview ? <div className={`import-preview ${preview.issues.length ? 'import-preview--error' : ''}`}>
            <strong>{preview.issues.length ? `${preview.issues.length} problema(s)` : `${preview.records.length} envelope(s) válido(s)`}</strong>
            {preview.issues.slice(0, 5).map((issue) => <span key={`${issue.line}-${issue.message}`}>Linha {issue.line}: {issue.message}</span>)}
          </div> : null}
          <button className="primary-button" type="button" onClick={() => void sendBatch()} disabled={!preview?.records.length || busy || !canWrite}>{busy ? <LoaderCircle className="spin" size={17}/> : <Upload size={17}/>} Enviar para revisão</button>
        </article>

        <article className="import-history-card">
          <div className="import-card-heading"><span><History size={20}/></span><div><h2>Histórico de lotes</h2><p>Selecione um lote para revisar seus itens.</p></div></div>
          <div className="batch-list">{batches.length ? batches.map((batch) => <button type="button" key={batch.id} className={detail?.id === batch.id ? 'batch-row batch-row--active' : 'batch-row'} onClick={() => loadImportBatch(batch.id).then(setDetail).catch(() => setError('Não foi possível abrir o lote.'))}>
            <span><strong>{batch.filename}</strong><small>{new Date(batch.createdAt).toLocaleString('pt-BR')} · {batch.itemCount} itens</small></span><em className={`import-status import-status--${batch.status}`}>{STATUS_LABEL[batch.status]}</em>
          </button>) : <div className="content-empty content-empty--small"><span>Nenhum lote enviado.</span></div>}</div>
        </article>
      </section>

      {detail ? <section className="content-workspace">
        <div className="batch-detail-heading"><div><span className="page-eyebrow">LOTE SELECIONADO</span><h2>{detail.filename}</h2><p>{detail.readyCount} prontos · {detail.duplicateCount} duplicados · {detail.invalidCount} inválidos</p></div><div className="batch-actions">
          {detail.status === 'staging' ? <button className="primary-button" onClick={() => void apply()} disabled={!canWrite || busy || readyToImport === 0}><CheckCircle2 size={17}/> Importar {readyToImport} como rascunho(s)</button> : null}
          {detail.status === 'imported' || detail.status === 'import_partial' ? <button className="secondary-button" onClick={() => void rollback()} disabled={!canWrite || busy}><RotateCcw size={17}/> Desfazer lote</button> : null}
        </div></div>
        <div className="editorial-table-shell"><table className="editorial-table"><thead><tr><th>#</th><th>Tipo e registro</th><th>Validação</th><th>Decisão</th><th>Conteúdo</th></tr></thead><tbody>{detail.items.map((item) => <tr key={item.id}><td>{item.position}</td><td><div className="import-item-cell"><strong>{item.kind === 'question' ? 'Questão' : item.kind === 'concurso' ? 'Concurso' : 'Registro inválido'} · {item.resourceId || 'sem ID'}</strong><span>{item.sourceKey}</span><ImportItemSummary item={item}/></div></td><td><span className={`import-status import-status--${item.status}`}>{STATUS_LABEL[item.status] ?? item.status}</span>{item.errors.map((message) => <small className="item-error" key={message}>{message}</small>)}</td><td>{detail.status === 'staging' && (item.status === 'ready' || item.status === 'duplicate') ? <select value={item.decision} onChange={(event) => void changeDecision(item.id, event.target.value as ImportDecision)} disabled={busy || !canWrite}>{item.status === 'ready' ? <option value="import">Importar</option> : <option value="upsert">Atualizar existente</option>}<option value="skip">Ignorar</option></select> : <span>{item.decision === 'skip' ? 'Ignorado' : 'Processado'}</span>}</td><td><button type="button" className="table-text-button" onClick={() => openItem(item)}><FilePenLine size={15}/>{detail.status === 'staging' && canWrite ? 'Revisar' : 'Ver'}</button></td></tr>)}</tbody></table></div>
      </section> : null}
      {editingItem ? <ImportItemEditor item={editingItem} text={editorText} error={editorError} editable={detail?.status === 'staging' && canWrite} busy={busy} onTextChange={setEditorText} onClose={() => setEditingItem(null)} onSave={saveItem}/> : null}
    </div>
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ImportItemSummary({ item }: { item: AdminImportItem }) {
  const payload = isObject(item.payload) ? item.payload : {};
  const data = isObject(payload.data) ? payload.data : {};
  if (item.kind === 'concurso') {
    const title = typeof data.title === 'string' ? data.title : 'Concurso sem título';
    const organ = typeof data.organ === 'string' ? data.organ : 'Órgão não informado';
    return <small>{organ} · {title}</small>;
  }
  if (item.kind === 'question') {
    return <small>{typeof data.discipline === 'string' ? data.discipline : 'Disciplina não informada'}</small>;
  }
  return null;
}

function ImportItemEditor({
  item,
  text,
  error,
  editable,
  busy,
  onTextChange,
  onClose,
  onSave,
}: {
  item: AdminImportItem;
  text: string;
  error: string | null;
  editable: boolean;
  busy: boolean;
  onTextChange: (value: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const payload = isObject(item.payload) ? item.payload : {};
  const source = isObject(payload.source) ? payload.source : {};
  const data = isObject(payload.data) ? payload.data : {};
  const roles = Array.isArray(data.roles) ? data.roles.filter(isObject) : [];
  const sourceUrl = typeof source.url === 'string' && source.url.startsWith('https://') ? source.url : undefined;

  return <div className="editor-backdrop"><aside className="concurso-editor import-item-editor" role="dialog" aria-modal="true" aria-labelledby="import-item-title"><form onSubmit={(event) => { event.preventDefault(); void onSave(); }}><header className="editor-header"><div><span className="page-eyebrow">STAGING DO COLETOR</span><h2 id="import-item-title">{item.kind === 'concurso' ? String(data.title || item.resourceId || 'Concurso') : String(item.resourceId || 'Registro importado')}</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label="Fechar editor"><X size={20}/></button></header><div className="editor-body">
    {error ? <div className="form-error"><CircleAlert size={17}/>{error}</div> : null}
    <section className="import-record-overview"><div><span>Órgão</span><strong>{String(data.organ || 'Não informado')}</strong></div><div><span>Banca</span><strong>{String(data.board || 'Não informada')}</strong></div><div><span>Cargos</span><strong>{roles.length}</strong></div><div><span>Origem</span><strong>{String(source.provider || 'Não informada')}</strong></div></section>
    {sourceUrl ? <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Abrir fonte coletada</a> : null}
    <label className="form-field"><span>{editable ? 'Registro JSON — revise ou corrija antes de importar' : 'Registro JSON processado'}</span><textarea className="import-json-editor" rows={24} value={text} onChange={(event) => onTextChange(event.target.value)} readOnly={!editable} spellCheck={false}/></label>
  </div><footer className="editor-footer"><button className="secondary-button" type="button" onClick={onClose}>Fechar</button>{editable ? <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : null}Salvar e revalidar</button> : null}</footer></form></aside></div>;
}
