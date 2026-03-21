import { useState } from 'react';
import { Landing } from './views/Landing';
import { Host } from './views/Host';
import { Player } from './views/Player';

type Role = 'none' | 'host' | 'player';

interface HostState { roomCode: string; }
interface PlayerState { roomCode: string; playerName: string; }

export default function App() {
  const [role, setRole] = useState<Role>('none');
  const [hostState, setHostState] = useState<HostState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);

  if (role === 'host' && hostState) {
    return <Host roomCode={hostState.roomCode} />;
  }

  if (role === 'player' && playerState) {
    return <Player roomCode={playerState.roomCode} playerName={playerState.playerName} />;
  }

  return (
    <Landing
      onHostCreated={(roomCode) => {
        setHostState({ roomCode });
        setRole('host');
      }}
      onPlayerJoined={(roomCode, playerName) => {
        setPlayerState({ roomCode, playerName });
        setRole('player');
      }}
    />
  );
}
