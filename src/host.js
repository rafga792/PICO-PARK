class Host {
    constructor(game) {
        this.game = game;
        this.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.channel = null;
        this.clients = {};
    }

    init() {
        console.log("Host Room Code:", this.roomCode);
        document.getElementById("roomCode").textContent = this.roomCode;

        // Inisialisasi Realtime Channel berdasarkan Kode Room
        this.channel = supabaseClient.channel(`room_${this.roomCode}`, {
            config: {
                presence: { key: 'host' },
            },
        });

        // Listen event dari Client (misal: input pergerakan player)
        this.channel.on('broadcast', { event: 'client-update' }, ({ payload }) => {
            this.handleClientUpdate(payload);
        });

        // Pantau status koneksi pemain yang masuk (Presence)
        this.channel.on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            this.updateMemberList(state);
        });

        this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await this.channel.track({ role: 'host', onlineAt: new Date().toISOString() });
            }
        });
    }

    handleClientUpdate(data) {
        // Update input player yang dikirim oleh client
        let targetPlayer = this.game.players.find(p => p.id === data.playerId);
        if (targetPlayer) {
            targetPlayer.keys = data.keys;
        }
    }

    updateClients() {
        if (!this.channel) return;

        // Broadcast posisi & state seluruh objek game ke Client
        const gameState = {
            players: this.game.players.map(p => ({
                id: p.id,
                x: p.body ? p.body.position.x : 0,
                y: p.body ? p.body.position.y : 0,
                color: p.color
            })),
            // Tambahkan data entitas game lain jika perlu (misal: posisi block/box)
        };

        this.channel.send({
            type: 'broadcast',
            event: 'host-update',
            payload: gameState
        });
    }

    broadcast(data) {
        if (!this.channel) return;
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
