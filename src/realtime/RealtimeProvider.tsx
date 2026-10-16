/* eslint-disable react-refresh/only-export-components -- this file also exports the hook that reads the connection status; it only costs a full reload instead of hot replacement while developing */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS, SOCKET_PATH, type NftUpdatedEvent, type OrderUpdatedEvent, type SessionReadyEvent } from '../lib/socketEvents';
import { applyNftUpdate, applyOrderUpdate, reconcile } from './applyEvents';

// How long a connection must hold after a gap before it counts as back
const STABLE_MS = 1000;

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting';

const RealtimeContext = createContext<RealtimeStatus>('connecting');
export const useRealtimeStatus = () => useContext(RealtimeContext);

// One socket for the whole app. It follows the session: a different token means a new connection,
// so a user never receives what was meant for another one.
export function RealtimeProvider({ token, children }: { token: string | null; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  // A different token is a different connection: start again from "connecting" (adjusted while
  // rendering, not in the effect below, so the screen never shows the old status for one frame)
  const [connectionToken, setConnectionToken] = useState(token);
  if (connectionToken !== token) {
    setConnectionToken(token);
    setStatus('connecting');
  }

  useEffect(() => {
    let closed = false;
    let socket: import('socket.io-client').Socket | null = null;
    let connectedBefore = false;
    let stable: ReturnType<typeof setTimeout> | undefined;
    // Loaded on demand: socket.io-client must be imported after the mock server is running
    void import('socket.io-client').then(({ io }) => {
      if (closed) return;
      socket = io({
        path: SOCKET_PATH,
        transports: ['websocket'],
        auth: token ? { token } : {},
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
      });

      socket.on('connect', () => {
        if (!connectedBefore) {
          // The first connection starts from fresh data
          connectedBefore = true;
          setStatus('connected');
          return;
        }
        // A connection that drops again at once is not "back". Only one that holds for a moment is,
        // and then events may have been missed while it was gone: read what is on screen again.
        clearTimeout(stable);
        stable = setTimeout(() => {
          setStatus('connected');
          reconcile(queryClient);
        }, STABLE_MS);
      });
      socket.on('disconnect', (reason) => {
        clearTimeout(stable);
        if (!closed && reason !== 'io client disconnect') setStatus('reconnecting');
      });
      socket.on('connect_error', () => setStatus('reconnecting'));

      socket.on(SOCKET_EVENTS.nftUpdated, (event: NftUpdatedEvent) => {
        applyNftUpdate(queryClient, event);
      });
      socket.on(SOCKET_EVENTS.orderUpdated, (event: OrderUpdatedEvent) => {
        applyOrderUpdate(queryClient, token, event);
      });
      socket.on(SOCKET_EVENTS.sessionReady, (event: SessionReadyEvent) => {
        // The server did not accept the token we hold: ask the REST API, which settles it
        if (token && !event.authenticated) void queryClient.invalidateQueries({ queryKey: ['me', token] });
      });
      socket.on(SOCKET_EVENTS.authError, () => {
        // The auth layer already knows what to do when a request says the session is over
        void queryClient.invalidateQueries({ queryKey: ['me', token] });
      });
    });

    return () => {
      closed = true;
      clearTimeout(stable);
      socket?.close();
    };
  }, [token, queryClient]);

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>;
}
