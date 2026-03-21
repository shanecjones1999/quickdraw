import { useEffect } from 'react';
import { socket } from '../socket';

type Listener = (...args: unknown[]) => void;

export function useSocket(event: string, handler: Listener) {
  useEffect(() => {
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [event, handler]);
}
