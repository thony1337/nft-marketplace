import { useRealtimeStatus } from '../realtime/RealtimeProvider';

// Only says something when there is something to say: the live updates are not arriving
export function ConnectionBanner() {
  const status = useRealtimeStatus();
  if (status !== 'reconnecting') return null;
  return (
    <div role="status" className="bg-primary/15 px-4 py-1.5 text-center text-xs">
      Sem conexão em tempo real. Tentando reconectar… Os preços podem estar desatualizados.
    </div>
  );
}
