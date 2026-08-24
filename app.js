/**
 * VCT Map Schedule & Flow Manual Controller
 */

// Default VCT Preset Teams
const VCT_PRESET_TEAMS = {
    'SEN': { name: 'SENTINELS', tag: 'SEN', icon: 'https://api.iconify.design/simple-icons:valorant.svg?color=%23ff4655' },
    'FNC': { name: 'FNATIC', tag: 'FNC', icon: 'https://api.iconify.design/simple-icons:fnatic.svg?color=%23ff5900' },
    'PRX': { name: 'PAPER REX', tag: 'PRX', icon: 'https://api.iconify.design/mdi:dinosaur-pixel.svg?color=%23e53935' },
    'LEV': { name: 'LEVIATÁN', tag: 'LEV', icon: 'https://api.iconify.design/simple-icons:shield.svg?color=%2300b0ff' },
    'TH': { name: 'TEAM HERETICS', tag: 'TH', icon: 'https://api.iconify.design/simple-icons:heretics.svg?color=%23d4af37' },
    'EDG': { name: 'EDWARD GAMING', tag: 'EDG', icon: 'https://api.iconify.design/mdi:sword-cross.svg?color=%23ffffff' },
    'GEN': { name: 'GEN.G ESPORTS', tag: 'GEN', icon: 'https://api.iconify.design/mdi:crown-outline.svg?color=%23aa8f00' },
    'NRG': { name: 'NRG', tag: 'NRG', icon: 'https://api.iconify.design/mdi:lightning-bolt.svg?color=%2300f0ff' },
    '100T': { name: '100 THIEVES', tag: '100T', icon: 'https://api.iconify.design/mdi:numeric-100-circle.svg?color=%23ff003b' },
    'DRX': { name: 'DRX', tag: 'DRX', icon: 'https://api.iconify.design/mdi:dragon.svg?color=%231e88e5' }
};

// Default Map Pool
const VALORANT_MAP_POOL = [
    { id: 'ascent', name: 'ASCENT' },
    { id: 'bind', name: 'BIND' },
    { id: 'breeze', name: 'BREEZE' },
    { id: 'fracture', name: 'FRACTURE' },
    { id: 'haven', name: 'HAVEN' },
    { id: 'icebox', name: 'ICEBOX' },
    { id: 'lotus', name: 'LOTUS' },
    { id: 'pearl', name: 'PEARL' },
    { id: 'split', name: 'SPLIT' },
    { id: 'sunset', name: 'SUNSET' },
    { id: 'abyss', name: 'ABYSS' }
];

// Fallback Team Placeholders
const DEFAULT_BLUE_ICON = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%2300b0ff"/><text x="50%" y="55%" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">T1</text></svg>';
const DEFAULT_RED_ICON = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23ff4655"/><text x="50%" y="55%" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">T2</text></svg>';

class VCTMapScheduleApp {
    constructor() {
        this.broadcastChannel = new BroadcastChannel('vct_overlay_channel');
        
        // Initial Default State
        this.state = {
            match_format: 'bo3',
            team_1: {
                name: 'SENTINELS',
                tag: 'SEN',
                icon: VCT_PRESET_TEAMS['SEN'].icon
            },
            team_2: {
                name: 'FNATIC',
                tag: 'FNC',
                icon: VCT_PRESET_TEAMS['FNC'].icon
            },
            game_flow: [
                { map: 'bind', state: 'over', map_pick: 'team_1', team_1_score: 13, team_2_score: 11 },
                { map: 'ascent', state: 'current', map_pick: 'team_2', team_1_score: 0, team_2_score: 0 },
                { map: 'lotus', state: 'decider', map_pick: 'decider', team_1_score: 0, team_2_score: 0 }
            ]
        };

        this.init();
    }

    init() {
        this.loadSavedState();
        this.cacheDOM();
        this.bindEvents();
        this.renderAll();
        this.initWebSocket();
    }

    initWebSocket() {
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            try {
                this.ws = new WebSocket(wsUrl);
                this.ws.onmessage = (event) => {
                    try {
                        const parsed = JSON.parse(event.data);
                        if (parsed.type === 'UPDATE_STATE' && parsed.data) {
                            this.state = parsed.data;
                            localStorage.setItem('vct_map_schedule_data', JSON.stringify(this.state));
                            this.renderAll();
                        }
                    } catch (e) {
                        console.error("Error handling WS message:", e);
                    }
                };
                this.ws.onclose = () => {
                    setTimeout(() => this.initWebSocket(), 3000);
                };
            } catch (e) {
                console.warn("WebSocket initialization skipped or failed:", e);
            }
        }
    }

    loadSavedState() {
        const saved = localStorage.getItem('vct_map_schedule_data');
        if (saved) {
            try {
                this.state = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved VCT schedule state:", e);
            }
        }
    }

    saveState() {
        localStorage.setItem('vct_map_schedule_data', JSON.stringify(this.state));
        this.broadcastChannel.postMessage({ type: 'UPDATE_STATE', data: this.state });
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'UPDATE_STATE', data: this.state }));
        } else if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            fetch('/api/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state)
            }).catch(err => console.warn('HTTP state save fallback warning:', err));
        }

        this.renderOverlayPreview();
    }

    cacheDOM() {
        this.previewContainer = document.getElementById('upcomming-maps');
        
        // Team Inputs
        this.team1NameInput = document.getElementById('team1-name');
        this.team1TagInput = document.getElementById('team1-tag');
        this.team1IconInput = document.getElementById('team1-icon');
        this.team1LogoPreview = document.getElementById('team1-logo-preview');

        this.team2NameInput = document.getElementById('team2-name');
        this.team2TagInput = document.getElementById('team2-tag');
        this.team2IconInput = document.getElementById('team2-icon');
        this.team2LogoPreview = document.getElementById('team2-logo-preview');

        // Match Format
        this.matchFormatSelect = document.getElementById('match-format');
        
        // Map Flow List Container
        this.mapFlowContainer = document.getElementById('map-flow-list');

        // Quick Actions
        this.btnAdvanceMap = document.getElementById('btn-advance-map');
        this.btnSwapTeams = document.getElementById('btn-swap-teams');
        this.btnResetMatch = document.getElementById('btn-reset-match');
        this.btnCopyOverlayUrl = document.getElementById('btn-copy-overlay-url');
        this.btnOpenOverlayWindow = document.getElementById('btn-open-overlay-window');
        this.overlayUrlInput = document.getElementById('overlay-url-input');
    }

    bindEvents() {
        // Team 1 Inputs
        this.team1NameInput.addEventListener('input', (e) => {
            this.state.team_1.name = e.target.value.toUpperCase();
            this.saveState();
        });
        this.team1TagInput.addEventListener('input', (e) => {
            this.state.team_1.tag = e.target.value.toUpperCase();
            this.saveState();
        });
        this.team1IconInput.addEventListener('input', (e) => {
            this.state.team_1.icon = e.target.value || DEFAULT_BLUE_ICON;
            this.team1LogoPreview.src = this.state.team_1.icon;
            this.saveState();
        });

        // Team 2 Inputs
        this.team2NameInput.addEventListener('input', (e) => {
            this.state.team_2.name = e.target.value.toUpperCase();
            this.saveState();
        });
        this.team2TagInput.addEventListener('input', (e) => {
            this.state.team_2.tag = e.target.value.toUpperCase();
            this.saveState();
        });
        this.team2IconInput.addEventListener('input', (e) => {
            this.state.team_2.icon = e.target.value || DEFAULT_RED_ICON;
            this.team2LogoPreview.src = this.state.team_2.icon;
            this.saveState();
        });

        // Match Format Switcher
        this.matchFormatSelect.addEventListener('change', (e) => {
            this.setMatchFormat(e.target.value);
        });

        // Preset Pills Click Handlers
        document.querySelectorAll('.preset-pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                const teamKey = e.target.dataset.team;
                const targetTeam = e.target.dataset.target; // 'team1' or 'team2'
                if (VCT_PRESET_TEAMS[teamKey]) {
                    const preset = VCT_PRESET_TEAMS[teamKey];
                    if (targetTeam === 'team1') {
                        this.state.team_1.name = preset.name;
                        this.state.team_1.tag = preset.tag;
                        this.state.team_1.icon = preset.icon;
                    } else {
                        this.state.team_2.name = preset.name;
                        this.state.team_2.tag = preset.tag;
                        this.state.team_2.icon = preset.icon;
                    }
                    this.renderTeamInputs();
                    this.saveState();
                }
            });
        });

        // Quick Actions
        this.btnAdvanceMap.addEventListener('click', () => this.advanceToNextMap());
        this.btnSwapTeams.addEventListener('click', () => this.swapTeams());
        this.btnResetMatch.addEventListener('click', () => this.resetMatchState());
        
        // OBS Helper
        const currentUrl = window.location.href.replace('index.html', '').replace(/\/$/, '');
        const overlayUrl = `${currentUrl}/overlay.html`;
        if (this.overlayUrlInput) this.overlayUrlInput.value = overlayUrl;

        if (this.btnCopyOverlayUrl) {
            this.btnCopyOverlayUrl.addEventListener('click', () => {
                navigator.clipboard.writeText(overlayUrl);
                this.showToast('Overlay URL copied to clipboard!');
            });
        }

        if (this.btnOpenOverlayWindow) {
            this.btnOpenOverlayWindow.addEventListener('click', () => {
                window.open('overlay.html', 'VCT_Overlay_Window', 'width=1200,height=300,menubar=no,toolbar=no');
            });
        }
    }

    setMatchFormat(format) {
        this.state.match_format = format;
        let count = 3;
        if (format === 'bo1') count = 1;
        if (format === 'bo3') count = 3;
        if (format === 'bo5') count = 5;

        // Rebuild game flow array accordingly while retaining existing if available
        const newFlow = [];
        const defaultMaps = ['bind', 'ascent', 'lotus', 'haven', 'sunset'];

        for (let i = 0; i < count; i++) {
            if (this.state.game_flow[i]) {
                newFlow.push(this.state.game_flow[i]);
            } else {
                const mapName = defaultMaps[i % defaultMaps.length];
                let state = (i === 0) ? 'current' : ((i === count - 1 && count > 1) ? 'decider' : 'upcomming');
                let pick = (i % 2 === 0) ? 'team_1' : 'team_2';
                if (state === 'decider') pick = 'decider';
                
                newFlow.push({
                    map: mapName,
                    state: state,
                    map_pick: pick,
                    team_1_score: 0,
                    team_2_score: 0
                });
            }
        }
        
        this.state.game_flow = newFlow;
        this.renderMapFlowEditor();
        this.saveState();
    }

    advanceToNextMap() {
        const flow = this.state.game_flow;
        const currentIndex = flow.findIndex(m => m.state === 'current');

        if (currentIndex !== -1) {
            // Mark current map as over
            flow[currentIndex].state = 'over';
            
            // Advance next if available
            if (currentIndex + 1 < flow.length) {
                flow[currentIndex + 1].state = 'current';
            }
        } else {
            // Find first upcoming or decider map
            const upcomingIndex = flow.findIndex(m => m.state === 'upcomming' || m.state === 'decider');
            if (upcomingIndex !== -1) {
                flow[upcomingIndex].state = 'current';
            }
        }

        this.renderMapFlowEditor();
        this.saveState();
        this.showToast('Advanced to next map in schedule!');
    }

    swapTeams() {
        const temp = { ...this.state.team_1 };
        this.state.team_1 = { ...this.state.team_2 };
        this.state.team_2 = temp;

        // Swap scores in game flow
        this.state.game_flow.forEach(item => {
            const t1Score = item.team_1_score;
            item.team_1_score = item.team_2_score;
            item.team_2_score = t1Score;

            if (item.map_pick === 'team_1') item.map_pick = 'team_2';
            else if (item.map_pick === 'team_2') item.map_pick = 'team_1';
        });

        this.renderTeamInputs();
        this.renderMapFlowEditor();
        this.saveState();
        this.showToast('Teams and map picks swapped!');
    }

    resetMatchState() {
        this.setMatchFormat(this.state.match_format || 'bo3');
        this.state.game_flow.forEach((item, idx) => {
            item.state = (idx === 0) ? 'current' : (idx === this.state.game_flow.length - 1 ? 'decider' : 'upcomming');
            item.team_1_score = 0;
            item.team_2_score = 0;
        });
        this.renderMapFlowEditor();
        this.saveState();
        this.showToast('Match schedule reset to start.');
    }

    renderAll() {
        this.renderTeamInputs();
        this.renderMapFlowEditor();
        this.renderOverlayPreview();
    }

    renderTeamInputs() {
        this.team1NameInput.value = this.state.team_1.name || '';
        this.team1TagInput.value = this.state.team_1.tag || '';
        this.team1IconInput.value = this.state.team_1.icon || '';
        this.team1LogoPreview.src = this.state.team_1.icon || DEFAULT_BLUE_ICON;

        this.team2NameInput.value = this.state.team_2.name || '';
        this.team2TagInput.value = this.state.team_2.tag || '';
        this.team2IconInput.value = this.state.team_2.icon || '';
        this.team2LogoPreview.src = this.state.team_2.icon || DEFAULT_RED_ICON;

        this.matchFormatSelect.value = this.state.match_format || 'bo3';
    }

    renderMapFlowEditor() {
        if (!this.mapFlowContainer) return;
        this.mapFlowContainer.innerHTML = '';

        this.state.game_flow.forEach((slot, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = `map-slot-item ${slot.state === 'current' ? 'active-slot' : ''}`;
            
            // Map options HTML
            const mapOptions = VALORANT_MAP_POOL.map(m => 
                `<option value="${m.id}" ${m.id === slot.map ? 'selected' : ''}>${m.name}</option>`
            ).join('');

            itemEl.innerHTML = `
                <div class="slot-number">#${index + 1}</div>
                <div>
                    <label class="form-label">Map</label>
                    <select class="form-control slot-map-select" data-index="${index}">
                        ${mapOptions}
                    </select>
                </div>
                <div>
                    <label class="form-label">Status</label>
                    <select class="form-control slot-state-select" data-index="${index}">
                        <option value="over" ${slot.state === 'over' ? 'selected' : ''}>FINISHED (OVER)</option>
                        <option value="current" ${slot.state === 'current' ? 'selected' : ''}>CURRENT MAP</option>
                        <option value="upcomming" ${slot.state === 'upcomming' ? 'selected' : ''}>NEXT / UPCOMING</option>
                        <option value="decider" ${slot.state === 'decider' ? 'selected' : ''}>DECIDER</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">Picked By</label>
                    <select class="form-control slot-pick-select" data-index="${index}">
                        <option value="team_1" ${slot.map_pick === 'team_1' ? 'selected' : ''}>${this.state.team_1.tag || 'TEAM 1'}</option>
                        <option value="team_2" ${slot.map_pick === 'team_2' ? 'selected' : ''}>${this.state.team_2.tag || 'TEAM 2'}</option>
                        <option value="decider" ${slot.map_pick === 'decider' ? 'selected' : ''}>DECIDER / REMAINING</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">Score (T1 : T2)</label>
                    <div class="score-inputs">
                        <input type="number" class="form-control score-input slot-t1-score" data-index="${index}" value="${slot.team_1_score || 0}" min="0" max="99">
                        <span>:</span>
                        <input type="number" class="form-control score-input slot-t2-score" data-index="${index}" value="${slot.team_2_score || 0}" min="0" max="99">
                    </div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="btn btn-secondary btn-sm slot-btn-active" data-index="${index}" title="Set as Current">▶</button>
                </div>
            `;

            this.mapFlowContainer.appendChild(itemEl);
        });

        // Add Event Listeners for Editor Controls
        this.mapFlowContainer.querySelectorAll('.slot-map-select').forEach(el => {
            el.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.state.game_flow[idx].map = e.target.value;
                this.saveState();
            });
        });

        this.mapFlowContainer.querySelectorAll('.slot-state-select').forEach(el => {
            el.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.state.game_flow[idx].state = e.target.value;
                this.renderMapFlowEditor();
                this.saveState();
            });
        });

        this.mapFlowContainer.querySelectorAll('.slot-pick-select').forEach(el => {
            el.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.state.game_flow[idx].map_pick = e.target.value;
                this.saveState();
            });
        });

        this.mapFlowContainer.querySelectorAll('.slot-t1-score').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.state.game_flow[idx].team_1_score = parseInt(e.target.value) || 0;
                this.saveState();
            });
        });

        this.mapFlowContainer.querySelectorAll('.slot-t2-score').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.state.game_flow[idx].team_2_score = parseInt(e.target.value) || 0;
                this.saveState();
            });
        });

        this.mapFlowContainer.querySelectorAll('.slot-btn-active').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.state.game_flow.forEach((m, i) => {
                    if (m.state === 'current') m.state = 'over';
                });
                this.state.game_flow[idx].state = 'current';
                this.renderMapFlowEditor();
                this.saveState();
            });
        });
    }

    renderOverlayPreview() {
        if (!this.previewContainer) return;

        const team1Icon = this.state.team_1.icon || DEFAULT_BLUE_ICON;
        const team2Icon = this.state.team_2.icon || DEFAULT_RED_ICON;

        this.previewContainer.innerHTML = '';
        const mapArray = [];

        if (this.state.game_flow && this.state.game_flow.length > 0) {
            this.state.game_flow.forEach(item => {
                const mapName = item.map || 'ascent';
                switch (item.state) {
                    case 'over':
                        mapArray.push(['over', this.formatMapOverPanel(
                            item.team_1_score || 0,
                            item.team_2_score || 0,
                            mapName,
                            team1Icon,
                            team2Icon
                        )]);
                        break;
                    case 'current':
                        mapArray.push(['current', this.formatMapCurrentPanel(
                            mapName,
                            item.map_pick,
                            team1Icon,
                            team2Icon
                        )]);
                        break;
                    case 'upcomming':
                        mapArray.push(['upcomming', this.formatMapUpcommingPanel(
                            mapName,
                            item.map_pick,
                            team1Icon,
                            team2Icon
                        )]);
                        break;
                    case 'decider':
                        mapArray.push(['decider', this.formatMapDeciderPanel(mapName)]);
                        break;
                    default:
                        mapArray.push(['upcomming', this.formatMapUpcommingPanel(
                            mapName,
                            item.map_pick,
                            team1Icon,
                            team2Icon
                        )]);
                }
            });
        }

        if (mapArray.length === 0) return;

        // Append generated HTML
        for (let i = 0; i < mapArray.length; i++) {
            this.previewContainer.innerHTML += mapArray[i][1];
        }

        // Apply corner polygon clip-path classes according to position
        const containers = this.previewContainer.getElementsByClassName('map-select-information-container');
        if (containers.length === 1) {
            containers[0].classList.add('single-map-select');
        } else if (containers.length > 0) {
            containers[0].classList.add('first-map-select');
            containers[containers.length - 1].classList.add('decider-map-select');
        }
    }

    formatMapOverPanel(t1Score, t2Score, map, t1Icon, t2Icon) {
        let scoreString = `<img class="team-select-image" src="${t1Icon}" onerror="this.style.display='none'"><span class="information-text">${t1Score}:${t2Score}</span><img class="team-select-image" src="${t2Icon}" onerror="this.style.display='none'">`;
        if (t2Score > t1Score) {
            scoreString = `<img class="team-select-image" src="${t2Icon}" onerror="this.style.display='none'"><span class="information-text">${t2Score}:${t1Score}</span><img class="team-select-image" src="${t1Icon}" onerror="this.style.display='none'">`;
        }
        return `<div class="map-select-information-container status-over">
                    <span class="map-text">${map.toUpperCase()}</span>
                    ${scoreString}
                </div>`;
    }

    formatMapCurrentPanel(map, team_selected, t1Icon, t2Icon) {
        let imageLink = (team_selected === 'team_1') ? t1Icon : (team_selected === 'team_2' ? t2Icon : '');
        return `<div class="map-select-information-container status-current">
                    <span class="information-text">CURRENT:</span>
                    <span class="map-text">${map.toUpperCase()}</span>
                    ${imageLink !== '' ? `<img class="team-select-image" src="${imageLink}" onerror="this.style.display='none'">` : ''}
                </div>`;
    }

    formatMapUpcommingPanel(map, team_selected, t1Icon, t2Icon) {
        let imageLink = (team_selected === 'team_1') ? t1Icon : (team_selected === 'team_2' ? t2Icon : '');
        return `<div class="map-select-information-container">
                    <span class="information-text">NEXT:</span>
                    <span class="map-text">${map.toUpperCase()}</span>
                    ${imageLink !== '' ? `<img class="team-select-image" src="${imageLink}" onerror="this.style.display='none'">` : ''}
                </div>`;
    }

    formatMapDeciderPanel(map) {
        return `<div class="map-select-information-container status-decider">
                    <span class="information-text">DECIDER:</span>
                    <span class="map-text">${map.toUpperCase()}</span>
                </div>`;
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fa">✓</i> <span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.vctApp = new VCTMapScheduleApp();
});
