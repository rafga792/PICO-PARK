class Host {
    constructor(game) {
        this.game = game;
        this.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.channel = null;
        this.isSubscribed = false; // Flag status koneksi WebSocket
    }

    init() {
        console.log("Host Room Code:", this.roomCode);

        // Update elemen UI kode room jika ada
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

        // Listen update input pergerakan pemain dari Client
        this.channel.on('broadcast', { event: 'client-update' }, ({ payload }) => {
            this.handleClientUpdate(payload);
        });

        // Pantau daftar pemain yang sedang terkoneksi (Presence)
        this.channel.on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            this.updateMemberList(state);
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

    handleClientUpdate(data) {
        // Update status input kunci (keys) milik player yang sesuai dengan ID client
        if (!data || !data.playerId) return;

        let targetPlayer = this.game.players.find(p => p.id === data.playerId);
        if (targetPlayer) {
            targetPlayer.keys = data.keys;
        }
    }

    updateClients() {
        // HANYA kirim data jika WebSocket sudah dalam kondisi SUBSCRIBED
        if (!this.channel || !this.isSubscribed) return;

        // Menyusun state game yang akan disinkronkan ke seluruh Client
        const gameState = {
            players: this.game.players.map(p => ({
                id: p.id,
                x: p.body ? p.body.position.x : 0,
                y: p.body ? p.body.position.y : 0,
                color: p.color
            }))
        };

        // Broadcast posisi pemain ke client
        this.channel.send({
            type: 'broadcast',
            event: 'host-update',
            payload: gameState
        });
    }

    broadcast(data) {
        // Mencegah pengiriman event jika belum terkoneksi
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
