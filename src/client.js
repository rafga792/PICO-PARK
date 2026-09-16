class Client {
    constructor(game, playerInstance) {
        this.game = game;
        this.player = playerInstance;
        this.channel = null;
        this.isSubscribed = false;
        this.myId = 'client_' + Math.random().toString(36).substring(2, 6);
    }

    init(roomCode) {
        const cleanRoomCode = roomCode.toUpperCase();
        console.log("Menghubungkan ke Room:", cleanRoomCode);

        this.channel = supabaseClient.channel(`room_${cleanRoomCode}`, {
            config: {
                presence: { key: this.myId },
            },
        });

        this.channel.on('broadcast', { event: 'host-update' }, ({ payload }) => {
            this.syncGameState(payload);
        });

        this.channel.on('broadcast', { event: 'host-event' }, ({ payload }) => {
            if (payload.startGame && typeof startGame === 'function') startGame();
            if (payload.setLevel && typeof setLevel === 'function') setLevel(payload.setLevel);
        });

        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.isSubscribed = true;
                console.log("Client berhasil terhubung ke Host via Supabase Realtime!");
                this.channel.track({ role: 'client', id: this.myId });
            } else {
                this.isSubscribed = false;
            }
        });
    }

    // Method ini dipanggil oleh controls.js bawaan game
    updateKey(key, state) {
        this.updateHost();
    }

    updateHost() {
        if (!this.channel || !this.isSubscribed || !this.player) return;

        this.channel.send({
            type: 'broadcast',
            event: 'client-update',
            payload: {
                playerId: this.player.id,
                keys: typeof keys !== 'undefined' ? keys : {}
            }
        });
    }

    syncGameState(state) {
        if (!state || !state.players) return;

        state.players.forEach(pData => {
            let localPlayer = this.game.players.find(p => p.id === pData.id);

            if (!localPlayer) {
                localPlayer = this.game.playerhandler.addPlayer({
                    id: pData.id,
                    color: pData.color || this.game.fetchColor(),
                    onlinePlayer: true
                });
            }

            if (localPlayer && localPlayer.body && (localPlayer.id !== this.player.id)) {
                Matter.Body.setPosition(localPlayer.body, { x: pData.x, y: pData.y });
            }
        });
    }
}
