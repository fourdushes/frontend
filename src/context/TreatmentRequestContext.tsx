import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { MedicalRequest } from '../types/api';
import { useSession } from './SessionContext';

const ACTIVE_STATUSES = new Set(['REQUESTED', 'ACCEPTED', 'IN_PROGRESS']);
const ACTIVE_POLL_INTERVAL_MS = 3000;
const HIDDEN_POLL_INTERVAL_MS = 12000;

type TreatmentRequestContextValue = {
  requests: MedicalRequest[];
  activeRequest: MedicalRequest | null;
  inProgressRequest: MedicalRequest | null;
  waitingRequest: MedicalRequest | null;
  ready: boolean;
  syncing: boolean;
  error: string | null;
  refresh: (silent?: boolean) => Promise<MedicalRequest[]>;
  adoptRequest: (request: MedicalRequest) => void;
};

const TreatmentRequestContext = createContext<TreatmentRequestContextValue | null>(null);

export function TreatmentRequestProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestsRef = useRef<MedicalRequest[]>([]);
  const syncingRef = useRef(false);
  const isWard = session?.userType === 'WARD';
  const isInstitution = session?.userType === 'INSTITUTIONS';
  const isRequestParticipant = isWard || isInstitution;

  const replaceRequests = useCallback((next: MedicalRequest[]) => {
    requestsRef.current = next;
    setRequests(next);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!isRequestParticipant) return [];
    if (syncingRef.current) return requestsRef.current;
    syncingRef.current = true;
    if (!silent) setSyncing(true);
    try {
      const next = isWard ? await teamApi.getWardRequests() : await teamApi.getInstitutionRequests();
      replaceRequests(next ?? []);
      setError(null);
      return next ?? [];
    } catch (caught) {
      setError(readableError(caught));
      return requestsRef.current;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setReady(true);
    }
  }, [isRequestParticipant, isWard, replaceRequests]);

  const adoptRequest = useCallback((request: MedicalRequest) => {
    const next = [request, ...requestsRef.current.filter((item) => item.medicalRequestId !== request.medicalRequestId)];
    replaceRequests(next);
    setError(null);
  }, [replaceRequests]);

  useEffect(() => {
    syncingRef.current = false;
    setError(null);
    if (!isRequestParticipant) {
      replaceRequests([]);
      setReady(true);
      return;
    }
    setReady(false);
    void refresh();
  }, [isRequestParticipant, refresh, replaceRequests, session?.userId]);

  const activeRequest = useMemo(() => {
    const active = requests
      .filter((request) => ACTIVE_STATUSES.has(request.status))
      .sort((left, right) => right.medicalRequestId - left.medicalRequestId);
    if (isInstitution) {
      return active.find((request) => request.status === 'IN_PROGRESS')
        ?? active.find((request) => request.status === 'ACCEPTED')
        ?? active[0]
        ?? null;
    }
    return active[0] ?? null;
  }, [isInstitution, requests]);
  const inProgressRequest = useMemo(
    () => requests.find((request) => request.status === 'IN_PROGRESS' && request.chatRoomId !== null) ?? null,
    [requests],
  );
  const waitingRequest = isWard && activeRequest?.status === 'REQUESTED' ? activeRequest : null;

  useEffect(() => {
    if (!isRequestParticipant || !activeRequest) return;
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (disposed) return;
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      timeout = setTimeout(async () => {
        await refresh(true);
        schedule();
      }, hidden ? HIDDEN_POLL_INTERVAL_MS : ACTIVE_POLL_INTERVAL_MS);
    };
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void refresh(true);
    };

    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility);
    schedule();
    return () => {
      disposed = true;
      if (timeout) clearTimeout(timeout);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeRequest?.medicalRequestId, isRequestParticipant, refresh]);

  const value = useMemo<TreatmentRequestContextValue>(() => ({
    requests,
    activeRequest,
    inProgressRequest,
    waitingRequest,
    ready,
    syncing,
    error,
    refresh,
    adoptRequest,
  }), [activeRequest, adoptRequest, error, inProgressRequest, ready, refresh, requests, syncing, waitingRequest]);

  return <TreatmentRequestContext.Provider value={value}>{children}</TreatmentRequestContext.Provider>;
}

export function useTreatmentRequest() {
  const value = useContext(TreatmentRequestContext);
  if (!value) throw new Error('useTreatmentRequest must be used inside TreatmentRequestProvider');
  return value;
}
