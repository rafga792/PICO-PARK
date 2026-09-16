class Client {
    constructor(game, playerInstance) {
        this.game = game;
        this.player = playerInstance;
        this.channel = null;
        this.isSubscribed = false;
        this.myId = 'client_' + Math.random().toString(36).substring(2, 6);
        this.createdPlayerIds = new Set();
        
        if (this.player) {
            this.player.id = this.myId;
            this.createdPlayerIds.add(this.myId);
        }
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
            if (payload.startGame) {
                if (typeof startGame === 'function') startGame();
                const menuEl = document.getElementById("menu");
                if (menuEl) menuEl.style.display = "none";
            }
            if (payload.setLevel) {
                if (this.game && this.game.levelHandler) {
                    this.game.levelHandler.setLevel(payload.setLevel);
                }
            }
        });

        this.channel.subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                this.isSubscribed = true;
                console.log("Client berhasil terhubung via Supabase Realtime!");
                this.channel.track({ role: 'client', id: this.myId });
                this.updateHost();
            } else if (status === 'CHANNEL_ERROR') {
                this.isSubscribed = false;
                console.warn("WebSocket Client error, menghubungkan ulang...", err);
            } else if (status === 'TIMED_OUT') {
                this.isSubscribed = false;
            } else if (status === 'CLOSED') {
                this.isSubscribed = false;
            }
        });
    }

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

        // Sync level map
        if (state.currentLevel && this.game.levelHandler) {
            const currentClientLevel = this.game.levelHandler.currentLevel ? this.game.levelHandler.currentLevel.name : null;
            if (currentClientLevel !== state.currentLevel) {
                this.game.levelHandler.setLevel(state.currentLevel);
            }
        }

        // Sync posisi player
        state.players.forEach(pData => {
            let localPlayer = this.game.players.find(p => p.id === pData.id);

            if (!localPlayer && !this.createdPlayerIds.has(pData.id)) {
                this.createdPlayerIds.add(pData.id);

                localPlayer = this.game.playerhandler.addPlayer({
                    id: pData.id,
                    color: pData.color || this.game.fetchColor(),
                    onlinePlayer: (pData.id !== this.myId)
                });
            }

            if (localPlayer && localPlayer.body && (localPlayer.id !== this.myId)) {
                Matter.Body.setPosition(localPlayer.body, { x: pData.x, y: pData.y });
            }
        });
    }
}
