'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RealtimeEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface RealtimeConnection {
  isConnected: boolean;
  onlineUsers: number;
  subscribe: (event: string, callback: (data: any) => void) => () => void;
  emit: (event: string, data: any) => void;
  checkIn: (data: any) => void;
  checkOut: (data: any) => void;
  updateLocation: (data: { latitude: number; longitude: number }) => void;
}

export function useRealtime(auth: {
  userId: string;
  tenantId: string;
  role: string;
  employeeId?: string;
  branchId?: string;
} | null): RealtimeConnection {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const subscriptionsRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    if (!auth?.userId || !auth?.tenantId) return;

    // Connect to WebSocket server
    const socket = io('/?XTransformPort=3003', {
      auth: {
        userId: auth.userId,
        tenantId: auth.tenantId,
        role: auth.role,
        employeeId: auth.employeeId,
        branchId: auth.branchId,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to real-time service');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from real-time service');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    // Handle stats updates
    socket.on('stats:live', (stats) => {
      setOnlineUsers(stats.online || 0);
    });

    // Handle all events and dispatch to subscribers
    socket.onAny((eventName, data) => {
      const callbacks = subscriptionsRef.current.get(eventName);
      if (callbacks) {
        callbacks.forEach(cb => cb(data));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [auth?.userId, auth?.tenantId, auth?.role, auth?.employeeId, auth?.branchId]);

  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (!subscriptionsRef.current.has(event)) {
      subscriptionsRef.current.set(event, new Set());
    }
    subscriptionsRef.current.get(event)!.add(callback);

    return () => {
      subscriptionsRef.current.get(event)?.delete(callback);
    };
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  }, [isConnected]);

  const checkIn = useCallback((data: any) => {
    emit('attendance:checkin', data);
  }, [emit]);

  const checkOut = useCallback((data: any) => {
    emit('attendance:checkout', data);
  }, [emit]);

  const updateLocation = useCallback((data: { latitude: number; longitude: number }) => {
    emit('location:update', data);
  }, [emit]);

  return {
    isConnected,
    onlineUsers,
    subscribe,
    emit,
    checkIn,
    checkOut,
    updateLocation,
  };
}

// Hook for receiving notifications
export function useNotifications(auth: { userId: string; tenantId: string } | null) {
  const [notifications, setNotifications] = useState<RealtimeEvent[]>([]);
  const { subscribe } = useRealtime(auth);

  useEffect(() => {
    if (!auth) return;

    const unsub = subscribe('notification:received', (data) => {
      setNotifications(prev => [data, ...prev].slice(0, 50));
    });

    return unsub;
  }, [auth, subscribe]);

  const clearNotification = useCallback((timestamp: string) => {
    setNotifications(prev => prev.filter(n => n.timestamp !== timestamp));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, clearNotification, clearAll };
}

// Hook for live attendance tracking
export function useLiveAttendance(auth: { userId: string; tenantId: string; role: string } | null) {
  const [liveData, setLiveData] = useState<{
    checkedIn: any[];
    checkedOut: any[];
    onBreak: any[];
  }>({ checkedIn: [], checkedOut: [], onBreak: [] });
  
  const { subscribe } = useRealtime(auth);

  useEffect(() => {
    if (!auth) return;

    const unsub1 = subscribe('attendance:checked_in', (data) => {
      setLiveData(prev => ({
        ...prev,
        checkedIn: [data, ...prev.checkedIn].slice(0, 100),
      }));
    });

    const unsub2 = subscribe('attendance:checked_out', (data) => {
      setLiveData(prev => ({
        ...prev,
        checkedOut: [data, ...prev.checkedOut].slice(0, 100),
      }));
    });

    const unsub3 = subscribe('attendance:on_break', (data) => {
      setLiveData(prev => ({
        ...prev,
        onBreak: [data, ...prev.onBreak].slice(0, 50),
      }));
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [auth, subscribe]);

  return liveData;
}
