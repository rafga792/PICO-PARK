class Host {
    constructor(game) {
        this.game = game;
        this.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.channel = null;
        this.isSubscribed = false;
    }

    init() {
        console.log("Host Room Code:", this.roomCode);

        const roomCodeEl = document.getElementById("roomCode");
        if (roomCodeEl) {
            roomCodeEl.textContent = this.roomCode;
        }

        this.channel = supabaseClient.channel(`room_${this.roomCode}`, {
            config: {
                presence: { key: 'host' },
            },
        });

        // Tangkap input & pendaftaran pemain dari Client
        this.channel.on('broadcast', { event: 'client-update' }, ({ payload }) => {
            this.handleClientUpdate(payload);
        });

        // Pantau pemain yang join/leave
        this.channel.on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            this.updateMemberList(state);
            
            // Kirim level ke client baru yang bergabung
            if (this.isSubscribed && this.game.levelHandler && this.game.levelHandler.currentLevel) {
                this.broadcastLevel(this.game.levelHandler.currentLevel.name);
            }
        });

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

    updateKey(key, state) {}

    handleClientUpdate(data) {
        if (!data || !data.playerId) return;

        let targetPlayer = this.game.players.find(p => p.id === data.playerId);
        
        // Buat karakter fisik baru di Host untuk Client tersebut
        if (!targetPlayer) {
            targetPlayer = this.game.playerhandler.addPlayer({
                id: data.playerId,
                color: this.game.fetchColor(),
                keys: data.keys || {}
            });
        } else {
            targetPlayer.keys = data.keys;
        }
    }

    updateClients() {
        if (!this.channel || !this.isSubscribed) return;

        // Sync posisi seluruh pemain
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
