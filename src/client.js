class Client {
    constructor(game, playerInstance) {
        this.game = game;
        this.player = playerInstance;
        this.channel = null;
        this.isSubscribed = false; // Flag status koneksi WebSocket
        this.myId = 'client_' + Math.random().toString(36).substring(2, 6);
        this.createdPlayerIds = new Set(); // Mencegah duplikasi pembuatan player di Client
        
        // Daftarkan ID unik ke player lokal jika ada
        if (this.player) {
            this.player.id = this.myId;
            this.createdPlayerIds.add(this.myId);
        }
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

        // Menerima event khusus dari Host (seperti Start Game atau Set Level)
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

        // Subscribe ke channel dan perbarui status flag koneksi
        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.isSubscribed = true;
                console.log("Client berhasil terhubung ke Host via Supabase Realtime!");
                this.channel.track({ role: 'client', id: this.myId });
                
                // Kirim data input awal ke Host
                this.updateHost();
            } else {
                this.isSubscribed = false;
            }
        });
    }

    // Dipanggil oleh controls.js untuk mengirim pergerakan tombol
    updateKey(key, state) {
        this.updateHost();
    }

    updateHost() {
        // HANYA kirim jika WebSocket sudah terhubung aktif
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

            // PENCEGAHAN SPAM: Buat player baru HANYA jika belum ada di game DAN belum terkunci di Set
            if (!localPlayer && !this.createdPlayerIds.has(pData.id)) {
                this.createdPlayerIds.add(pData.id); // Langsung kunci ID ini

                localPlayer = this.game.playerhandler.addPlayer({
                    id: pData.id,
                    color: pData.color || this.game.fetchColor(),
                    onlinePlayer: (pData.id !== this.myId)
                });
            }

            // Sync posisi fisik karakter lain (Matter.js body)
            if (localPlayer && localPlayer.body && (localPlayer.id !== this.myId)) {
                Matter.Body.setPosition(localPlayer.body, { x: pData.x, y: pData.y });
            }
        });
    }
}
