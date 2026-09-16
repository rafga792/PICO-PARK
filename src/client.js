class Client {
    constructor(game, playerInstance) {
        this.game = game;
        this.player = playerInstance;
        this.channel = null;
        this.isSubscribed = false; // Flag status koneksi WebSocket
        this.myId = 'client_' + Math.random().toString(36).substring(2, 6);
    }

    init(roomCode) {
        const cleanRoomCode = roomCode.toUpperCase();
        console.log("Menghubungkan ke Room:", cleanRoomCode);

        // Inisialisasi Channel Supabase Realtime ke Room Host
        this.channel = supabaseClient.channel(`room_${cleanRoomCode}`, {
            config: {
                presence: { key: this.myId },
            },
        });

        // Menerima pembaruan posisi & state objek dari Host
        this.channel.on('broadcast', { event: 'host-update' }, ({ payload }) => {
            this.syncGameState(payload);
        });

        // Menerima perintah/event khusus dari Host (seperti Start Game atau Set Level)
        this.channel.on('broadcast', { event: 'host-event' }, ({ payload }) => {
            if (payload.startGame) {
                if (typeof startGame === 'function') startGame();
            }
            if (payload.setLevel) {
                if (typeof setLevel === 'function') setLevel(payload.setLevel);
            }
        });

        // Subscribe ke channel Supabase dan atur status status flag koneksi
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

    updateHost() {
        // HANYA kirim input jika koneksi WebSocket sudah aktif (SUBSCRIBED)
        if (!this.channel || !this.isSubscribed || !this.player) return;

        // Mengirimkan status kunci/tombol yang sedang ditekan pemain ke Host
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

        // Menyinkronkan posisi setiap player berdasarkan broadcast data dari Host
        state.players.forEach(pData => {
            let localPlayer = this.game.players.find(p => p.id === pData.id);

            // Jika player dari host belum ada di client local, buat player baru
            if (!localPlayer) {
                localPlayer = this.game.playerhandler.addPlayer({
                    id: pData.id,
                    color: pData.color || this.game.fetchColor(),
                    onlinePlayer: true
                });
            }

            // Update posisi fisik (Matter.js body) player
            if (localPlayer && localPlayer.body && (localPlayer.id !== this.player.id)) {
                Matter.Body.setPosition(localPlayer.body, { x: pData.x, y: pData.y });
            }
        });
    }
}
