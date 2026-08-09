import {
  CheckCircle2,
  CircleAlert,
  FileJson2,
  History,
  LoaderCircle,
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
} from '../lib/imports-api';
import type { AdminImportBatch, AdminImportBatchDetail, ImportDecision } from '../types';

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
  const canWrite = !isPreview && Boolean(access?.permissions.includes('content.write'));

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

  const readyToImport = useMemo(() => detail?.items.filter((item) =>
    (item.status === 'ready' || item.status === 'duplicate') && item.decision !== 'skip').length ?? 0, [detail]);

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="page-eyebrow">ENTRADA EDITORIAL</span><h1>Importações</h1><p>Valide, revise e incorpore lotes do coletor sem publicar conteúdo automaticamente.</p></div></section>
      {isPreview ? <div className="page-alert page-alert--preview"><CircleAlert size={19}/><span>Importações exigem uma sessão administrativa conectada ao Supabase.</span></div> : null}
      {error ? <div className="page-alert" role="alert"><CircleAlert size={19}/><span>{error}</span></div> : null}
      {notice ? <div className="page-alert page-alert--success"><CheckCircle2 size={19}/><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Fechar"><X size={16}/></button></div> : null}

      <section className="import-grid">
        <article className="import-upload-card">
          <div className="import-card-heading"><span><Upload size={20}/></span><div><h2>Novo lote</h2><p>Arquivos JSONL, NDJSON ou JSON com até 500 registros.</p></div></div>
          <label className="file-drop">
            <FileJson2 size={28}/><strong>{file?.name ?? 'Selecionar arquivo do coletor'}</strong><span>O conteúdo é apenas pré-validado até você enviar.</span>
            <input type="file" accept=".json,.jsonl,.ndjson,application/json" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} disabled={!canWrite || busy}/>
          </label>
          {preview ? <div className={`import-preview ${preview.issues.length ? 'import-preview--error' : ''}`}>
            <strong>{preview.issues.length ? `${preview.issues.length} problema(s)` : `${preview.records.length} registro(s) válido(s)`}</strong>
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
        <div className="editorial-table-shell"><table className="editorial-table"><thead><tr><th>#</th><th>Tipo e registro</th><th>Validação</th><th>Decisão</th></tr></thead><tbody>{detail.items.map((item) => <tr key={item.id}><td>{item.position}</td><td><div className="import-item-cell"><strong>{item.kind === 'question' ? 'Questão' : 'Concurso'} · {item.resourceId || 'sem ID'}</strong><span>{item.sourceKey}</span></div></td><td><span className={`import-status import-status--${item.status}`}>{STATUS_LABEL[item.status] ?? item.status}</span>{item.errors.map((message) => <small className="item-error" key={message}>{message}</small>)}</td><td>{detail.status === 'staging' && (item.status === 'ready' || item.status === 'duplicate') ? <select value={item.decision} onChange={(event) => void changeDecision(item.id, event.target.value as ImportDecision)} disabled={busy || !canWrite}>{item.status === 'ready' ? <option value="import">Importar</option> : <option value="upsert">Atualizar existente</option>}<option value="skip">Ignorar</option></select> : <span>{item.decision === 'skip' ? 'Ignorado' : 'Processado'}</span>}</td></tr>)}</tbody></table></div>
      </section> : null}
    </div>
  );
}
