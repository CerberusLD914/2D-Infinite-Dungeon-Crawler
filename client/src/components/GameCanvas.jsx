
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import * as Colyseus from "colyseus.js";
import MainScene from '../game/scenes/MainScene';

const GameCanvas = ({ user }) => {
    const gameRef = useRef(null);
    const clientRef = useRef(null);

    useEffect(() => {
        if (gameRef.current) return;

        // Initialize Colyseus Client
        const client = new Colyseus.Client('ws://localhost:3000');
        clientRef.current = client;

        // Pass client and options (user data) to Scene via data object or Global Manager
        // Better: Connect in Scene 'create' or 'preload'
        // But we want to pass user info.

        const config = {
            type: Phaser.AUTO,
            scale: {
                mode: Phaser.Scale.RESIZE,
                parent: 'phaser-container',
                width: '100%',
                height: '100%'
            },
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [MainScene]
        };

        const game = new Phaser.Game(config);
        game.registry.set('colyseus', client);
        game.registry.set('user', user);

        gameRef.current = game;

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        }
    }, [user]);

    return (
        <div id="phaser-container" style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
        </div>
    );
};

export default GameCanvas;
