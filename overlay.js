/**
 * Dedicated VCT Map Schedule Standalone OBS Overlay Renderer
 */

const DEFAULT_BLUE_ICON = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%2300b0ff"/><text x="50%" y="55%" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">T1</text></svg>';
const DEFAULT_RED_ICON = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23ff4655"/><text x="50%" y="55%" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">T2</text></svg>';

class VCTOverlayRenderer {
    constructor() {
        this.container = document.getElementById('upcomming-maps');
        this.broadcastChannel = new BroadcastChannel('vct_overlay_channel');
        this.state = null;

        this.init();
    }

    init() {
        this.loadState();
        this.render();
        this.fetchInitialState();

        // Listen for real-time updates from Control Panel (Local same-origin window)
        this.broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'UPDATE_STATE') {
                this.state = event.data.data;
                this.render();
            }
        };

        // Fallback window storage event
        window.addEventListener('storage', (e) => {
            if (e.key === 'vct_map_schedule_data') {
                this.loadState();
                this.render();
            }
        });

        this.initWebSocket();
    }

    fetchInitialState() {
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            fetch('/api/state')
                .then(res => res.json())
                .then(data => {
                    if (data && data.game_flow) {
                        this.state = data;
                        localStorage.setItem('vct_map_schedule_data', JSON.stringify(this.state));
                        this.render();
                    }
                })
                .catch(err => console.warn('Could not fetch server state:', err));
        }
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
                            this.render();
                        }
                    } catch (e) {
                        console.error('Error parsing WS message in overlay:', e);
                    }
                };
                this.ws.onclose = () => {
                    setTimeout(() => this.initWebSocket(), 3000);
                };
            } catch (e) {
                console.warn('Overlay WS connection skipped/failed:', e);
            }
        }
    }

    loadState() {
        const saved = localStorage.getItem('vct_map_schedule_data');
        if (saved) {
            try {
                this.state = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse VCT state:", e);
            }
        }

        if (!this.state) {
            this.state = {
                game_flow: [
                    { map: 'bind', state: 'over', map_pick: 'team_1', team_1_score: 13, team_2_score: 11 },
                    { map: 'ascent', state: 'current', map_pick: 'team_2', team_1_score: 0, team_2_score: 0 },
                    { map: 'lotus', state: 'decider', map_pick: 'decider', team_1_score: 0, team_2_score: 0 }
                ],
                team_1: { icon: DEFAULT_BLUE_ICON },
                team_2: { icon: DEFAULT_RED_ICON }
            };
        }
    }

    render() {
        if (!this.container || !this.state) return;

        const team1Icon = (this.state.team_1 && this.state.team_1.icon) ? this.state.team_1.icon : DEFAULT_BLUE_ICON;
        const team2Icon = (this.state.team_2 && this.state.team_2.icon) ? this.state.team_2.icon : DEFAULT_RED_ICON;

        this.container.innerHTML = '';
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

        for (let i = 0; i < mapArray.length; i++) {
            this.container.innerHTML += mapArray[i][1];
        }

        const containers = this.container.getElementsByClassName('map-select-information-container');
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
}

document.addEventListener('DOMContentLoaded', () => {
    new VCTOverlayRenderer();
});
