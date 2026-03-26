
import React, { useState } from 'react';

export default function CharacterScreen({ user, onPlay }) {
    const [color, setColor] = useState(user.character.color || '#00ff00');
    const [saving, setSaving] = useState(false);

    const handleSaveAndPlay = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user.username,
                    character: { color }
                })
            });
            const data = await res.json();
            if (data.success) {
                // Update local user object just in case
                user.character = data.user.character;
                onPlay(user);
            } else {
                alert('Error saving character');
            }
        } catch (e) {
            alert('Connection Error');
        }
        setSaving(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', fontFamily: 'Arial' }}>
            <h1>Customize Character</h1>

            <div style={{
                width: '64px', height: '64px',
                backgroundColor: color,
                border: '2px solid white',
                marginBottom: '20px'
            }}></div>

            <div style={{ marginBottom: '20px' }}>
                <label>Color: </label>
                <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                />
            </div>

            <button
                onClick={handleSaveAndPlay}
                disabled={saving}
                style={{ padding: '10px 20px', fontSize: '18px', cursor: 'pointer', backgroundColor: '#2196F3', color: 'white', border: 'none' }}
            >
                {saving ? 'Saving...' : 'Play Game'}
            </button>
        </div>
    );
}
