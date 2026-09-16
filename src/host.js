class Host {
    constructor(game) {
        this.game = game;
        this.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.channel = null;
        this.isSubscribed = false; // Flag status koneksi WebSocket
        this.createdPlayerIds = new Set(); // Mencegah duplikasi pembuatan player
    }

    init() {
        console.log("Host Room Code:", this.roomCode);

        // Update tampilan UI kode room jika elemennya ada
        const roomCodeEl = document.getElementById("roomCode");
        if (roomCodeEl) {
            roomCodeEl.textContent = this.roomCode;
        }

        // Inisialisasi Channel Supabase Realtime berdasarkan Kode Room
        this.channel = supabaseClient.channel(`room_${this.roomCode}`, {
            config: {
                presence: { key: 'host' },
            },
        });

        // Tangkap input & data dari Client
        this.channel.on('broadcast', { event: 'client-update' }, ({ payload }) => {
            this.handleClientUpdate(payload);
        });

        // Pantau daftar pemain yang terkoneksi di room (Presence)
        this.channel.on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            this.updateMemberList(state);
            
            // Otomatis kirim data level aktif ke client baru yang bergabung
            if (this.isSubscribed && this.game.levelHandler && this.game.levelHandler.currentLevel) {
                this.broadcastLevel(this.game.levelHandler.currentLevel.name);
            }
        });

        // Subscribe ke channel dan perbarui status flag koneksi
        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.isSubscribed = true;
                console.log("Host terhubung ke Supabase Realtime WebSocket!");
                this.channel.track({ role: 'host', onlineAt: new Date().toISOString() });
            } else {
                this.isSubscribed = false;
            }
        });
    }

    // Dipanggil oleh controls.js (jika ada) untuk mencegah error 'updateKey is not a function'
    updateKey(key, state) {}

    handleClientUpdate(data) {
        if (!data || !data.playerId) return;

        let targetPlayer = this.game.players.find(p => p.id === data.playerId);
        
        // PENCEGAHAN SPAM: Hanya buat player baru jika belum ada DAN belum dikunci di Set
        if (!targetPlayer && !this.createdPlayerIds.has(data.playerId)) {
            this.createdPlayerIds.add(data.playerId); // Kunci ID ini agar tidak di-spawn ganda

            targetPlayer = this.game.playerhandler.addPlayer({
                id: data.playerId,
                color: this.game.fetchColor(),
                keys: data.keys || {}
            });
        } else if (targetPlayer) {
            // Update input tombol player yang sudah terdaftar
            targetPlayer.keys = data.keys;
        }
    }

    updateClients() {
        // HANYA broadcast jika koneksi WebSocket sudah SUBSCRIBED
        if (!this.channel || !this.isSubscribed) return;

        // Menyusun state posisi fisik seluruh pemain
        const gameState = {
            players: this.game.players.map(p => ({
                id: p.id,
                x: p.body ? p.body.position.x : 0,
                y: p.body ? p.body.position.y : 0,
                color: p.color
            }))
        };

        // Broadcast data posisi ke seluruh Client
        this.channel.send({
            type: 'broadcast',
            event: 'host-update',
            payload: gameState
        });
    }

    broadcastLevel(levelName) {
        if (!this.channel || !this.isSubscribed) return;
        this.broadcast({ setLevel: levelName });
    }

    broadcast(data) {
        if (!this.channel || !this.isSubscribed) return;

        this.channel.send({
            type: 'broadcast',
            event: 'host-event',
            payload: typeof data === 'string' ? JSON.parse(data) : data
        });
    }

    updateMemberList(state) {
        const memberListEl = document.getElementById("memberlist");
        if (!memberListEl) return;

        memberListEl.innerHTML = "";

        Object.keys(state).forEach(key => {
            if (key !== 'host') {
                const item = document.createElement("div");
                item.textContent = `Player (${key})`;
                memberListEl.appendChild(item);
            }
        });
    }
}
