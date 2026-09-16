class Client {
    constructor(game, playerInstance) {
        this.game = game;
        this.player = playerInstance;
        this.channel = null;
        this.isSubscribed = false;
        this.myId = 'client_' + Math.random().toString(36).substring(2, 6);
        
        if (this.player) {
            this.player.id = this.myId;
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

        // Terima posisi pemain dari Host
        this.channel.on('broadcast', { event: 'host-update' }, ({ payload }) => {
            this.syncGameState(payload);
        });

        // Terima perintah muat Level / Start Game dari Host
        this.channel.on('broadcast', { event: 'host-event' }, ({ payload }) => {
            if (payload.startGame) {
                if (typeof startGame === 'function') startGame();
                // Sembunyikan menu lobi
                const menuEl = document.getElementById("menu");
                if (menuEl) menuEl.style.display = "none";
            }
            if (payload.setLevel) {
                // Muat level map (pintu, kunci, rintangan) di client
                if (this.game && this.game.levelHandler) {
                    this.game.levelHandler.setLevel(payload.setLevel);
                }
            }
        });

        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.isSubscribed = true;
                console.log("Client berhasil terhubung ke Host via Supabase Realtime!");
                this.channel.track({ role: 'client', id: this.myId });
                
                // Daftarkan pemain lokal ke Host
                this.updateHost();
            } else {
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

        state.players.forEach(pData => {
            let localPlayer = this.game.players.find(p => p.id === pData.id);

            // Jika ada pemain baru dari Host yang belum di-render Client
            if (!localPlayer) {
                localPlayer = this.game.playerhandler.addPlayer({
                    id: pData.id,
                    color: pData.color || this.game.fetchColor(),
                    onlinePlayer: (pData.id !== this.myId)
                });
            }

            // Sync posisi fisik karakter lain
            if (localPlayer && localPlayer.body && (localPlayer.id !== this.myId)) {
                Matter.Body.setPosition(localPlayer.body, { x: pData.x, y: pData.y });
            }
        });
    }
}
