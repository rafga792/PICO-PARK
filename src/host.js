class Host {
    constructor(game) {
        this.game = game;
        this.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.channel = null;
        this.isSubscribed = false; // Flag status koneksi
    }

    init() {
        console.log("Host Room Code:", this.roomCode);
        document.getElementById("roomCode").textContent = this.roomCode;

        this.channel = supabaseClient.channel(`room_${this.roomCode}`, {
            config: { presence: { key: 'host' } }
        });

        this.channel.on('broadcast', { event: 'client-update' }, ({ payload }) => {
            this.handleClientUpdate(payload);
        });

        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.isSubscribed = true; // Tandai WS sudah aktif
                this.channel.track({ role: 'host' });
            }
        });
    }

    updateClients() {
        // HANYA kirim jika koneksi WebSocket sudah benar-benar SUBSCRIBED
        if (!this.channel || !this.isSubscribed) return;

        const gameState = {
            players: this.game.players.map(p => ({
                id: p.id,
                x: p.body ? p.body.position.x : 0,
                y: p.body ? p.body.position.y : 0,
                color: p.color
            }))
        };

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
}
