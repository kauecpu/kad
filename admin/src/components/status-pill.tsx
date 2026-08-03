import { CircleCheck, Clock3 } from 'lucide-react';

export function StatusPill({ active = false, children }: { active?: boolean; children: string }) {
  const Icon = active ? CircleCheck : Clock3;
  return (
    <span className={`status-pill ${active ? 'status-pill--active' : ''}`}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
}
