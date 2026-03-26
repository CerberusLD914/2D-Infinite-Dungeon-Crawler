
import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import AuthScreen from './components/AuthScreen';
import CharacterScreen from './components/CharacterScreen';

function App() {
  const [user, setUser] = useState(null);
  const [inGame, setInGame] = useState(false);

  if (!user) {
    return <div style={{ backgroundColor: '#111', minHeight: '100vh' }}><AuthScreen onLogin={setUser} /></div>;
  }

  if (!inGame) {
    return <div style={{ backgroundColor: '#111', minHeight: '100vh' }}><CharacterScreen user={user} onPlay={() => setInGame(true)} /></div>;
  }

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', margin: 0, padding: 0 }}>
      <GameCanvas user={user} />
    </div>
  );
}

export default App;
