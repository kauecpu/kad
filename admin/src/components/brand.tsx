import kadLogo from '../../../assets/images/kad-logo-v3.png';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand brand--compact' : 'brand'}>
      <img src={kadLogo} alt="KAD Concursos" className="brand__logo" />
      {!compact ? <span className="brand__product">Administração</span> : null}
    </div>
  );
}
