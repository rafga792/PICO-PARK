class Host {
    constructor(game) {
        this.game = game;
        this.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.channel = null;
        this.isSubscribed = false; // Flag status koneksi WebSocket
    }

    init() {
        console.log("Host Room Code:", this.roomCode);

        // Update elemen UI kode room di HTML jika ada
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

        // Tangkap update input pergerakan (keys) dari Client
        this.channel.on('broadcast', { event: 'client-update' }, ({ payload }) => {
            this.handleClientUpdate(payload);
        });

        // Pantau daftar pemain yang terkoneksi ke room (Presence)
        this.channel.on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            this.updateMemberList(state);
        });

        // Subscribe ke channel dan kunci status koneksi
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

    // PENTING: Mencegah 'hostConnection.updateKey is not a function' jika dipanggil oleh controls.js
    updateKey(key, state) {
        // Host memproses input secara lokal di mesin utama (Matter.js engine)
    }

    handleClientUpdate(data) {
        if (!data || !data.playerId) return;

        let targetPlayer = this.game.players.find(p => p.id === data.playerId);
        
        // Jika player client belum terdaftar di Host, tambahkan player baru
        if (!targetPlayer) {
            targetPlayer = this.game.playerhandler.addPlayer({
                id: data.playerId,
                color: this.game.fetchColor(),
                onlinePlayer: true
            });
        }

        // Update input tombol player tersebut
        if (targetPlayer) {
            targetPlayer.keys = data.keys;
        }
    }

    updateClients() {
        // HANYA broadcast jika koneksi WebSocket sudah terhubung aktif (SUBSCRIBED)
        if (!this.channel || !this.isSubscribed) return;

        // Menyusun state posisi seluruh objek player
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
