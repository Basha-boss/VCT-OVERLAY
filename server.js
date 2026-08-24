const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'state.json');

// Default initial state matching app.js defaults
let currentState = {
    match_format: 'bo3',
    team_1: {
        name: 'SENTINELS',
        tag: 'SEN',
        icon: 'https://api.iconify.design/simple-icons:valorant.svg?color=%23ff4655'
    },
    team_2: {
        name: 'FNATIC',
        tag: 'FNC',
        icon: 'https://api.iconify.design/simple-icons:fnatic.svg?color=%23ff5900'
    },
    game_flow: [
        { map: 'bind', state: 'over', map_pick: 'team_1', team_1_score: 13, team_2_score: 11 },
        { map: 'ascent', state: 'current', map_pick: 'team_2', team_1_score: 0, team_2_score: 0 },
        { map: 'lotus', state: 'decider', map_pick: 'decider', team_1_score: 0, team_2_score: 0 }
    ]
};

// Try loading saved state on startup
if (fs.existsSync(STATE_FILE)) {
    try {
        const savedData = fs.readFileSync(STATE_FILE, 'utf8');
        currentState = JSON.parse(savedData);
        console.log('Loaded persisted state from state.json');
    } catch (err) {
        console.error('Error loading state.json:', err.message);
    }
}

function saveStateToDisk() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to save state.json:', err.message);
    }
}

function broadcastState(sender = null) {
    const payload = JSON.stringify({ type: 'UPDATE_STATE', data: currentState });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// REST API Endpoints
app.get('/api/state', (req, res) => {
    res.json(currentState);
});

app.post('/api/state', (req, res) => {
    if (req.body && typeof req.body === 'object') {
        currentState = req.body;
        saveStateToDisk();
        broadcastState();
        return res.json({ success: true, state: currentState });
    }
    res.status(400).json({ error: 'Invalid state object' });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    // Send current state to newly connected client immediately
    ws.send(JSON.stringify({ type: 'UPDATE_STATE', data: currentState }));

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            if (parsed.type === 'UPDATE_STATE' && parsed.data) {
                currentState = parsed.data;
                saveStateToDisk();
                broadcastState(ws);
            }
        } catch (err) {
            console.error('Error processing WS message:', err.message);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Control Panel: http://localhost:${PORT}`);
    console.log(`OBS Overlay:   http://localhost:${PORT}/overlay.html`);
});
