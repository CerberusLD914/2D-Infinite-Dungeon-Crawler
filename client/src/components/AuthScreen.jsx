
import React, { useState } from 'react';

export default function AuthScreen({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ email: '', username: '', password: '' });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const endpoint = isLogin ? '/api/login' : '/api/register';
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                onLogin(data.user);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Connection error');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', fontFamily: 'Arial' }}>
            <h1>{isLogin ? 'Login' : 'Register'}</h1>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
                {!isLogin && (
                    <input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        required
                        style={{ padding: '10px' }}
                    />
                )}
                <input
                    type="text"
                    placeholder="Username"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    required
                    style={{ padding: '10px' }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required
                    style={{ padding: '10px' }}
                />
                <button type="submit" style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}>
                    {isLogin ? 'Enter World' : 'Create Account'}
                </button>
            </form>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <button
                onClick={() => setIsLogin(!isLogin)}
                style={{ marginTop: '20px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', textDecoration: 'underline' }}
            >
                {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
            </button>
        </div>
    );
}
