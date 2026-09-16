class Client {
    constructor(game, playerInstance) {
        this.game = game;
        this.player = playerInstance;
        this.channel = null;
        this.myId = 'client_' + Math.random().toString(36).substring(2, 6);
    }

    init(roomCode) {
        this.channel = supabaseClient.channel(`room_${roomCode.toUpperCase()}`, {
            config: {
                presence: { key: this.myId },
            },
        });

        // Terima data pembaruan game dari Host
        this.channel.on('broadcast', { event: 'host-update' }, ({ payload }) => {
            this.syncGameState(payload);
        });

        // Terima event khusus dari Host (misal: Start Game, Change Level)
        this.channel.on('broadcast', { event: 'host-event' }, ({ payload }) => {
            if (payload.startGame) {
                startGame();
            }
            if (payload.setLevel) {
                setLevel(payload.setLevel);
            }
        });

        this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await this.channel.track({ role: 'client', id: this.myId });
            }
        });
    }

    updateHost() {
        if (!this.channel) return;

        // Kirim data tombol/kontrol lokal ke Host
        this.channel.send({
            type: 'broadcast',
            event: 'client-update',
            payload: {
                playerId: this.player.id,
                keys: keys
            }
        });
    }

    syncGameState(state) {
        // Sinkronkan posisi player berdasarkan broadcast host
        state.players.forEach(pData => {
            let localPlayer = this.game.players.find(p => p.id === pData.id);
            if (localPlayer && localPlayer.body) {
                Matter.Body.setPosition(localPlayer.body, { x: pData.x, y: pData.y });
            }
        });
    }
}
