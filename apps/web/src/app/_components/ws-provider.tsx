'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type WsMessage = {
  event: string;
  data: unknown;
  timestamp: number;
};

type WsContextValue = {
  subscribe: (event: string, callback: (data: unknown) => void) => () => void;
  isConnected: boolean;
};

const WsContext = createContext<WsContextValue | null>(null);

type WsProviderProps = {
  children: React.ReactNode;
};

type WsProviderComponent = (props: WsProviderProps) => React.ReactNode;

export const WsProvider: WsProviderComponent = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribe = useCallback((event: string, callback: (data: unknown) => void) => {
    const subs = subscribersRef.current;
    if (!subs.has(event)) {
      subs.set(event, new Set());
    }
    subs.get(event)!.add(callback);

    return () => {
      subs.get(event)?.delete(callback);
    };
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_WS_URL ?? `ws://${window.location.hostname}:4001/ws`;
    let attempt = 0;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setIsConnected(true);
        attempt = 0;
      });

      ws.addEventListener('close', () => {
        setIsConnected(false);
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data)) as WsMessage;
          const callbacks = subscribersRef.current.get(msg.event);
          if (callbacks) {
            for (const cb of callbacks) {
              cb(msg.data);
            }
          }
        } catch {
          // Ignore malformed messages
        }
      });
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  return <WsContext.Provider value={{ subscribe, isConnected }}>{children}</WsContext.Provider>;
};

type UseWsResult = {
  lastEvent: unknown;
  isConnected: boolean;
};

type UseWs = (eventName: string) => UseWsResult;

export const useWs: UseWs = (eventName) => {
  const ctx = useContext(WsContext);
  if (!ctx) {
    throw new Error('useWs must be used within a WsProvider');
  }

  const [lastEvent, setLastEvent] = useState<unknown>(null);

  useEffect(() => {
    return ctx.subscribe(eventName, setLastEvent);
  }, [ctx, eventName]);

  return { lastEvent, isConnected: ctx.isConnected };
};
