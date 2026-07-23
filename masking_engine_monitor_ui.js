// ==UserScript==
// @name         Masking Engine Monitor UI aaaaaa
// @namespace    http://tampermonkey.net/
// @version      2026-07-23
// @description  try to take over the world!
// @author       You
// @match        https://monitor-public.trax-cloud.com/d/DZDWEo87z/oldest-task-apac*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trax-cloud.com
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==


(function() {
    'use strict';

    const projects = [
        "abinbevbr", "altriaus", "batru", "bdftr", "beiersdorfar", "beiersdorfau", "beiersdorfbe", "beiersdorfbo", "beiersdorfbr", "beiersdorfchl",
        "beiersdorfco", "beiersdorfcz", "beiersdorfde", "beiersdorfec", "beiersdorfeg", "beiersdorffr", "beiersdorfgr", "beiersdorfgt", "beiersdorfid",
        "beiersdorfin", "beiersdorfit", "beiersdorfke", "beiersdorfkz", "beiersdorfmx", "beiersdorfmy", "beiersdorfng", "beiersdorfnz", "beiersdorfpe",
        "beiersdorfph", "beiersdorfpl", "beiersdorfpt", "beiersdorfpy", "beiersdorfro", "beiersdorfru", "beiersdorfsa", "beiersdorfse", "beiersdorfsp",
        "beiersdorfth", "beiersdorftw", "beiersdorfuae", "beiersdorfuk", "beiersdorfvn", "beiersdorfza", "bimbomx", "bimbous", "biseask", "bivn",
        "bluetritonusa", "cbcdairyil", "cbcil", "ccaau", "ccanz", "ccbr-prod", "ccjp", "ccjpvm", "cclibertyus", "ccza", "diageoar", "diageoau",
        "diageobenelux", "diageobr", "diageoca", "diageoco", "diageoes", "diageoga", "diageogh", "diageogr", "diageogtr", "diageoid", "diageoie",
        "diageoin", "diageoit", "diageojp", "diageoke", "diageokr", "diageomx", "diageong", "diageopa", "diageopebac", "diageoph", "diageopl", "diageopt",
        "diageoromania", "diageosg", "diageostr", "diageoth", "diageotw", "diageotz", "diageoug", "diageouk", "diageous", "diageovn", "diageoza", "dlcpt",
        "femsaar", "fonterralk", "frucorau", "frucornz", "gmilac", "gskau", "gskch", "gskcz", "gskde", "gskes", "gskesph", "gskhu", "gskjp", "gsknz", "gskpl",
        "gskro", "gskruph", "gsksg", "haleonbr", "heinekenbr", "heinekentw", "heinzcr", "hphoodus", "inbevci", "inbevnl", "jtiro", "jtius", "jtjp", "kibonbr",
        "kirinjp", "labattplnoptca", "lionnz", "markanthonygroupus", "marsmx", "marspl", "mdlzrusf", "molsoncoorsuk", "mondelezau", "mondelezca", "mondelezde",
        "mondelezdmius", "mondelezes", "mondelezfi1", "mondelezkaza", "mondelezmy", "mondelezno", "mondelezprt", "mondelezsa", "mondelezse", "mondelezsg", "mondeleztr",
        "mondelezusps", "mondelezza", "munchysmy", "penaflorar", "pepsicofr", "pepsicopl", "pepsicotr", "pepsicouk", "pepside", "pepsigt", "pgpl", "pgpt", "pngcn-prod",
        "pnghk", "pngjp", "pngmx", "pngza2", "risparkwinede", "sanofiar", "sanofiat", "sanofiau", "sanofibe", "sanofibr", "sanofigr", "sanofihu", "sanofiit", "sanofijp",
        "sanofimx", "sanofiro", "scjohnsonar", "scjohnsonbr", "sindicatedmx", "sinoth", "sksignals", "solarbr", "suntoryjp2", "tempoil", "tevade", "tevapl", "tevaru",
        "ulbe", "ulbr", "ulde", "ules", "ulgr", "ulnl", "ulpt", "ulse", "unileverau", "unileverco", "unileverken", "unilevermx", "unileverus", "gskgr", "pernodus"
    ];

    const poolProjects = [
        "altriaus", "beiersdorfsp", "beiersdorfin", "beiersdorfchl", "beiersdorfco",
        "cbcil", "cbcdairyil", "ccaau", "diageoca", "diageoco", "diageotw",
        "diageous", "gsksg", "gskjp", "kibonbr", "munchysmy", "pepsicoes",
        "pngbr", "pngmx", "pnghk", "sanofies", "sinoth", "odpngjp"
    ];

   let projectData = {};
    let autoRefresh = true;
    let refreshInterval;
    let sortColumn = 0;
    let sortDirection = 1;
    let monitorUI;
    let currentRefreshInterval = 60000;
    let realtimeUpdateInterval;
    let hideZeroDiff = true;
    let hiddenColumns = { prev: true, current: true };
    let denominatorData = {};

    projects.forEach(project => {
        projectData[project] = {
            prev: null,
            current: null,
            diff: 0,
            lastUpdate: 'Never',
            lastUpdateTime: null,
            status: 'inactive',
            queuePrev: null,
            queueCurrent: null,
            queueDiff: 0,
            queueLastUpdate: 'Never',
            queueLastUpdateTime: null
        };
    });

    function createMonitorUI() {
        const monitorContainer = document.createElement('div');
        monitorContainer.id = 'masking-monitor-ui';
        monitorContainer.innerHTML = `
            <style>
                #masking-monitor-ui {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    width: 600px;
                    max-height: 80vh;
                    background: #2c2c2c;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.8);
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #fff;
                    overflow: hidden;
                    resize: both;
                }

                .monitor-header {
                    background: linear-gradient(135deg, #5cb85c, #449d44);
                    padding: 12px 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    user-select: none;
                }

                .monitor-title {
                    font-weight: 600;
                    font-size: 16px;
                }

                .monitor-controls {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .control-btn {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .control-btn:hover {
                    background: rgba(255,255,255,0.3);
                }

                .monitor-search {
                    padding: 10px;
                    background: #383838;
                    border-bottom: 1px solid #555;
                }

                .search-input {
                    width: 100%;
                    padding: 6px 10px;
                    border: 1px solid #555;
                    border-radius: 4px;
                    background: #2c2c2c;
                    color: #fff;
                    font-size: 13px;
                }

                .monitor-options {
                    padding: 8px 10px;
                    background: #383838;
                    border-bottom: 1px solid #555;
                    display: flex;
                    gap: 15px;
                    align-items: center;
                    font-size: 12px;
                }

                .option-group {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .voice-select {
                    background: #2c2c2c;
                    border: 1px solid #555;
                    color: #fff;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-size: 11px;
                    cursor: pointer;
                    max-width: 120px;
                }

                .voice-select:hover {
                    background: #383838;
                }

                .monitor-table-container {
                    max-height: 400px;
                    overflow-y: auto;
                    background: #404040;
                }

                .monitor-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }

                .monitor-table th {
                    background: #383838;
                    padding: 8px 10px;
                    text-align: left;
                    font-weight: 600;
                    color: #ddd;
                    cursor: pointer;
                    user-select: none;
                    border-bottom: 2px solid #555;
                    position: sticky;
                    top: 0;
                }

                .monitor-table th:hover {
                    background: #4a4a4a;
                }

                .monitor-table td {
                    padding: 6px 10px;
                    border-bottom: 1px solid #555;
                }

                .monitor-table tr:hover {
                    background: #4a4a4a;
                }

                .monitor-table th.hidden,
                .monitor-table td.hidden {
                    display: none;
                }

                .project-name {
                    font-weight: 600;
                    color: #ffffff;
                    position: relative;
                }

                .project-name.pool {
                    color: #ff6666;
                    font-weight: 600;
                }

                .current-value {
                    cursor: pointer;
                    position: relative;
                }

                .current-value:hover {
                    background: #5cb85c;
                    color: white;
                    border-radius: 3px;
                    padding: 2px 4px;
                    margin: -2px -4px;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                    margin-right: 6px;
                }

                .status-active { background: #5cb85c; box-shadow: 0 0 4px #5cb85c; }
                .status-warning { background: #f0ad4e; box-shadow: 0 0 4px #f0ad4e; }
                .status-error { background: #d9534f; box-shadow: 0 0 4px #d9534f; }
                .status-inactive { background: #777; }

                .diff-positive {
                    background: #d9534f;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: 600;
                }

                .diff-negative {
                    background: #5cb85c;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: 600;
                }

                .diff-zero {
                    color: #aaa;
                }

                .monitor-footer {
                    padding: 8px 15px;
                    background: #383838;
                    border-top: 1px solid #555;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                }

                .auto-refresh-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .toggle-switch {
                    width: 40px;
                    height: 20px;
                    background: #555;
                    border-radius: 20px;
                    cursor: pointer;
                    position: relative;
                    transition: background 0.3s;
                }

                .toggle-switch.active {
                    background: #5cb85c;
                }

                .toggle-switch::after {
                    content: '';
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    top: 2px;
                    left: 2px;
                    transition: transform 0.3s;
                }

                .toggle-switch.active::after {
                    transform: translateX(20px);
                }

                .interval-selector {
                    background: #2c2c2c;
                    border: 1px solid #555;
                    color: #fff;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 12px;
                    cursor: pointer;
                }

                .interval-selector:hover {
                    background: #383838;
                }

                .last-update {
                    color: #aaa;
                }

                .realtime-update {
                    color: #5cb85c;
                    font-size: 11px;
                }

                .minimized {
                    height: 45px !important;
                    overflow: hidden;
                }

                .minimized .monitor-search,
                .minimized .monitor-options,
                .minimized .monitor-table-container,
                .minimized .monitor-footer {
                    display: none;
                }

                .copy-notification {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #5cb85c;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 5px;
                    z-index: 20000;
                    font-weight: 600;
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .copy-notification.show {
                    opacity: 1;
                }
                .queue-high {
    background: #45deff !important;
    color: black !important;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 600;
    box-shadow: 0 0 4px #d9534f;
}
            </style>

            <div class="monitor-header">
                <div class="monitor-title">🔍 Masking Engine Monitor</div>
                <div class="monitor-controls">
                    <button class="control-btn" id="refresh-btn">🔄</button>
                    <button class="control-btn" id="columns-btn">📊</button>
                    <button class="control-btn" id="minimize-btn">➖</button>
                    <button class="control-btn" id="close-btn">✕</button>
                </div>
            </div>

            <div class="monitor-search">
                <input type="text" class="search-input" placeholder="🔍 Search projects..." id="project-search">
            </div>

            <div class="monitor-options">
                <div class="option-group">
                    <input type="checkbox" id="hide-zero-diff" checked>
                    <label for="hide-zero-diff">Hide zero diff</label>
                </div>
                <div class="option-group">
                    <label for="voice-select">Voice:</label>
                    <select class="voice-select" id="voice-select">
                        <option value="">No voice</option>
                    </select>
                </div>
            </div>

            <div class="monitor-table-container">
                <table class="monitor-table">
                    <thead>
                        <tr>
                            <th onclick="sortTable(0)">Project ↕</th>
                            <th class="hidden" id="prev-header" onclick="sortTable(1)">Prev ↕</th>
                            <th class="hidden" id="current-header" onclick="sortTable(2)">Current ↕</th>
                            <th onclick="sortTable(6)">Queue ↕</th>
                            <th onclick="sortTable(7)">Deno ↕</th>
                            <th onclick="sortTable(3)">outflow ↕</th>
                            <th onclick="sortTable(4)">Updated ↕</th>
                            <th onclick="sortTable(5)">Time Ago ↕</th>
                        </tr>
                    </thead>
                    <tbody id="project-table-body">
                    </tbody>
                </table>
            </div>

            <div class="monitor-footer">
                <div class="auto-refresh-toggle">
                    <span>Auto-refresh:</span>
                    <div class="toggle-switch active" id="auto-refresh-toggle"></div>
                    <select class="interval-selector" id="refresh-interval-select">
                        <option value="15000">15 sec</option>
                        <option value="30000">30 sec</option>
                        <option value="60000" selected>1 min</option>
                        <option value="300000">5 min</option>
                    </select>
                </div>
                <button class="control-btn" onclick="fetchAllProjects()">Refresh Now</button>
                <div class="last-update" id="last-update">Never updated</div>
            </div>
        `;

        document.body.appendChild(monitorContainer);
        return monitorContainer;
    }

    function getProjectDisplayName(project) {
        return poolProjects.includes(project) ? `${project} (Pool)` : project;
    }


    function populateVoiceOptions() {
        const voiceSelect = document.getElementById('voice-select');
        const voices = speechSynthesis.getVoices();

        voiceSelect.innerHTML = '<option value="">No voice</option>';

        let googleUSIndex = -1;
        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);

            if (voice.name.toLowerCase().includes('google') && voice.lang === 'en-US') {
                googleUSIndex = index;
            }
        });

        if (googleUSIndex !== -1) {
            voiceSelect.value = googleUSIndex;
        }
    }

    function copyToClipboard(text, message) {
        navigator.clipboard.writeText(text).then(() => {
            showCopyNotification(message);
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showCopyNotification(message);
        });
    }

    function showCopyNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 1500);
    }

    function getTimeSinceUpdate(lastUpdateTime) {
        if (!lastUpdateTime) return 'Never';

        const now = Date.now();
        const diff = now - lastUpdateTime;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        return `${hours}h ago`;
    }

    function renderTable() {
        const tbody = document.getElementById('project-table-body');
        const searchTerm = document.getElementById('project-search').value.toLowerCase();

        let filteredProjects = projects.filter(project => {
            const matchesSearch = project.toLowerCase().includes(searchTerm);
            const matchesDiffFilter = !hideZeroDiff || projectData[project].diff !== 0;
            return matchesSearch && matchesDiffFilter;
        });

        filteredProjects.sort((a, b) => {
            let valueA, valueB;
            switch(sortColumn) {
                case 0: valueA = a; valueB = b; break;
                case 1: valueA = projectData[a].prev || 0; valueB = projectData[b].prev || 0; break;
                case 2: valueA = projectData[a].current || 0; valueB = projectData[b].current || 0; break;
                case 3: valueA = projectData[a].diff; valueB = projectData[b].diff; break;
                case 4: valueA = projectData[a].lastUpdate; valueB = projectData[b].lastUpdate; break;
                case 5: valueA = projectData[a].lastUpdateTime || 0; valueB = projectData[b].lastUpdateTime || 0; break;
                case 6: valueA = projectData[a].queueCurrent || 0; valueB = projectData[b].queueCurrent || 0; break;
                case 7: valueA = (denominatorData[a] && denominatorData[a].engine) ? denominatorData[a].engine : 0;
                        valueB = (denominatorData[b] && denominatorData[b].engine) ? denominatorData[b].engine : 0; break;
            }

            if (typeof valueA === 'string') {
                return sortDirection * valueA.localeCompare(valueB);
            }
            return sortDirection * (valueA - valueB);
        });

        tbody.innerHTML = filteredProjects.map(project => {
            const data = projectData[project];
            const diffClass = data.diff > 0 ? 'diff-positive' :
            data.diff < 0 ? 'diff-negative' : 'diff-zero';
            const queueDiffClass = data.queueDiff > 0 ? 'diff-positive' :
            data.queueDiff < 0 ? 'diff-negative' : 'diff-zero';
            const statusClass = data.status;
            const displayName = getProjectDisplayName(project);
            const denoVal = (denominatorData[project] && denominatorData[project].engine) ? denominatorData[project].engine : '-';

            return `
        <tr>
            <td>
                <span class="status-dot status-${statusClass}"></span>
                <span class="project-name ${poolProjects.includes(project) ? 'pool' : ''}">${displayName.toUpperCase()}</span>
            </td>
            <td class="${hiddenColumns.prev ? 'hidden' : ''}">${data.prev !== null ? data.prev : '-'}</td>
            <td class="${hiddenColumns.current ? 'hidden' : ''}"><span>${data.current !== null ? data.current : '-'}</span></td>
            <td><span class="${queueDiffClass} ${data.queueCurrent > 50 ? 'queue-high' : ''}">${data.queueCurrent !== null ? data.queueCurrent : '-'}</span></td>
            <td>${denoVal}</td>
            <td><span class="${diffClass}">${data.diff > 0 ? '+' : ''}${data.diff}</span></td>
            <td>${data.lastUpdate}</td>
            <td class="realtime-update">${getTimeSinceUpdate(data.lastUpdateTime)}</td>
        </tr>
    `;
        }).join('');
    }

    function fetchQueue(project) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://monitor-public.trax-cloud.com/api/datasources/proxy/29/render",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-grafana-org-id": "18",
                "x-dashboard-id": "862",
                "x-panel-id": "30"
            },
            data: new URLSearchParams({
                target: `aliasByNode(prod.gauges.selector.queue.masking_engine.${project}.total, 3, 4)`,
                from: "today",
                until: "now",
                format: "json",
                maxDataPoints: "1000"
            }).toString(),
            onload: function(response) {
                try {
                    const resJson = JSON.parse(response.responseText);
                    const queueData = resJson.find(d => d.target && d.target.includes("queue.masking_engine"));
                    if (queueData && queueData.datapoints.length) {
                        const reversed = [...queueData.datapoints].reverse();
                        const latest = reversed.find(dp => dp[0] !== null);

                        if (latest) {
                            const currentQueue = latest[0];
                            const previousQueue = projectData[project].queueCurrent;
                            const now = Date.now();
                            const timeString = new Date(now).toLocaleTimeString();

                            projectData[project].queuePrev = previousQueue;
                            projectData[project].queueCurrent = currentQueue;
                            projectData[project].queueDiff = previousQueue !== null ? currentQueue - previousQueue : 0;

                            if (previousQueue !== currentQueue || previousQueue === null) {
                                projectData[project].queueLastUpdate = timeString;
                                projectData[project].queueLastUpdateTime = now;
                            }

                            console.log(`📈 ${project.toUpperCase()} queue → Latest count: ${currentQueue}`);
                        } else {
                            console.warn(`⚠️ No non-null data found in queue for ${project}.`);
                        }
                    } else {
                        console.warn(`⚠️ Queue data not found or empty for ${project}.`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Queue parse error for ${project}:`, e);
                }
                renderTable();
            },
            onerror: function(xhr) {
                console.error(`❌ Error fetching queue for ${project}:`, xhr);
                renderTable();
            }
        });
    }

    function copyProjectName(project) {
        const queue = projectData[project].queueCurrent;
        const displayName = getProjectDisplayName(project);
        const copyText = queue !== null ? `${displayName} ⇨ : ${queue}` : displayName;
        copyToClipboard(copyText, `Copied: ${copyText}`);
    }

    function copyCurrentValue(project) {
        const queue = projectData[project].queueCurrent;
        if (queue !== null) {
            const displayName = getProjectDisplayName(project);
            const copyText = `${displayName} - ${queue}`;
            copyToClipboard(copyText, `Copied: ${copyText}`);
        }
    }

    function copyQueueValue(project) {
        const queue = projectData[project].queueCurrent;
        if (queue !== null) {
            const displayName = getProjectDisplayName(project);
            const copyText = `${displayName} - ${queue}`;
            copyToClipboard(copyText, `Copied: ${copyText}`);
        }
    }

    function announceProject(project, diff) {
        const voiceSelect = document.getElementById('voice-select');
        const selectedVoice = voiceSelect.value;
        const queueCurrent = projectData[project].queueCurrent;
        const queueDiff = projectData[project].queueDiff;

        if ('speechSynthesis' in window && selectedVoice) {
            if (queueCurrent > 50 && Math.abs(queueDiff) > 20) {
                const message = `${project} alert: queue ${queueCurrent}, queue difference ${queueDiff}`;
                const utterance = new SpeechSynthesisUtterance(message);

                const voices = speechSynthesis.getVoices();
                if (voices[selectedVoice]) {
                    utterance.voice = voices[selectedVoice];
                }

                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                speechSynthesis.speak(utterance);

                console.log(`🔊 Voice announcement: ${message}`);
            } else {
                console.log(`🔇 Voice conditions not met for ${project}: queue=${queueCurrent}, queueDiff=${queueDiff}`);
            }
        }
    }

    function toggleColumns() {
        const prevHeader = document.getElementById('prev-header');
        const currentHeader = document.getElementById('current-header');

        hiddenColumns.prev = !hiddenColumns.prev;
        hiddenColumns.current = !hiddenColumns.current;

        if (hiddenColumns.prev) {
            prevHeader.classList.add('hidden');
        } else {
            prevHeader.classList.remove('hidden');
        }

        if (hiddenColumns.current) {
            currentHeader.classList.add('hidden');
        } else {
            currentHeader.classList.remove('hidden');
        }

        renderTable();
    }

    function fetchOutflow(project) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://monitor-public.trax-cloud.com/api/datasources/proxy/29/render",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-grafana-org-id": "18",
                "x-dashboard-id": "862",
                "x-panel-id": "30"
            },
            data: new URLSearchParams({
                target: `aliasByNode(prod.counters.selector.outflow.masking_engine.${project}.count, 3, 4)`,
                from: "today",
                until: "now",
                format: "json",
                maxDataPoints: "1000"
            }).toString(),
            onload: function(response) {
                try {
                    const resJson = JSON.parse(response.responseText);
                    const outflowData = resJson.find(d => d.target && d.target.includes("outflow.masking_engine"));
                    if (outflowData) {
                        const currentTotal = outflowData.datapoints
                            .filter(dp => dp[0] !== null)
                            .reduce((acc, dp) => acc + dp[0], 0);

                        const previous = projectData[project].current;
                        const now = Date.now();
                        const timeString = new Date(now).toLocaleTimeString();

                        const hasChanged = previous !== null && currentTotal !== previous;

                        projectData[project].prev = previous;
                        projectData[project].current = currentTotal;
                        projectData[project].diff = previous !== null ? currentTotal - previous : 0;

                        if (hasChanged || previous === null) {
                            projectData[project].lastUpdate = timeString;
                            projectData[project].lastUpdateTime = now;
                        }

                        if (previous !== null) {
                            const difference = currentTotal - previous;

                            if (Math.abs(difference) > 15) {
                                announceProject(project, difference);
                            }

                            if (Math.abs(difference) >= 5) {
                                projectData[project].status = 'warning';
                                console.log(`[${timeString}] 🔔 ${project.toUpperCase()} outflow changed by ${difference}. New total: ${currentTotal}`);

                                if (Math.abs(difference) >= 10) {
                                    if (Notification.permission === "granted") {
                                        new Notification(`Masking Engine Alert`, {
                                            body: `${project.toUpperCase()} outflow changed by ${difference}`,
                                            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkY2QjAwIi8+Cjwvc3ZnPgo='
                                        });
                                    }
                                }
                            } else {
                                projectData[project].status = 'active';
                            }
                        } else {
                            projectData[project].status = 'active';
                            console.log(`[${timeString}] ✅ Initial value for ${project.toUpperCase()}: ${currentTotal}`);
                        }
                    } else {
                        projectData[project].status = 'error';
                        console.warn(`⚠️ No data for ${project}`);
                    }
                } catch (e) {
                    projectData[project].status = 'error';
                    console.warn(`⚠️ Error parsing outflow for ${project}:`, e);
                }
                renderTable();
            },
            onerror: function(xhr) {
                projectData[project].status = 'error';
                projectData[project].lastUpdate = 'Error';
                projectData[project].lastUpdateTime = Date.now();
                console.error(`❌ Error for ${project}:`, xhr);
                renderTable();
            }
        });
    }

    function fetchDenominators() {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeBLEp0p0cP2CNbrEx1NyKQYKJw-uo-TFNs_GHgcUrNEXYhA79LbC3r8gei8b_DcXbywiwRhzmEYCs/pub?gid=1191322481&single=true&output=csv",
            onload: function(response) {
                try {
                    const csvText = response.responseText;
                    const lines = csvText.split("\n");
                    const temp = {};
                    lines.forEach((line, index) => {
                        if (index === 0) return;
                        const row = parseCSVLine(line);
                        if (row.length > 6) {
                            const project = row[0].trim().toLowerCase();
                            const maskingDeno = parseFloat(row[5]) || 0;
                            const engineDeno = parseFloat(row[6]) || 0;
                            if (project) {
                                temp[project] = { masking: maskingDeno, engine: engineDeno };
                            }
                        }
                    });
                    denominatorData = temp;
                    console.log("📊 Loaded denominators:", Object.keys(denominatorData).length);
                    renderTable();
                } catch (e) {
                    console.error("❌ Failed to parse denominators CSV:", e);
                }
            }
        });
    }

    function parseCSVLine(line) {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    function fetchAllProjects() {
        projects.forEach(project => {
            fetchOutflow(project);
            fetchQueue(project);
        });
        document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
    }

    function updateRealtimeDisplay() {
        renderTable();
    }

    function sortTable(column) {
        if (sortColumn === column) {
            sortDirection *= -1;
        } else {
            sortColumn = column;
            sortDirection = 1;
        }
        renderTable();
    }

    function toggleAutoRefresh() {
        const toggle = document.getElementById('auto-refresh-toggle');
        autoRefresh = !autoRefresh;

        if (autoRefresh) {
            toggle.classList.add('active');
            startAutoRefresh();
        } else {
            toggle.classList.remove('active');
            clearInterval(refreshInterval);
            clearInterval(realtimeUpdateInterval);
        }
    }

    function startAutoRefresh() {
        clearInterval(refreshInterval);
        clearInterval(realtimeUpdateInterval);

        if (autoRefresh) {
            refreshInterval = setInterval(fetchAllProjects, currentRefreshInterval);
            realtimeUpdateInterval = setInterval(updateRealtimeDisplay, 5000);
        }
    }

    function changeRefreshInterval() {
        const select = document.getElementById('refresh-interval-select');
        currentRefreshInterval = parseInt(select.value);

        if (autoRefresh) {
            startAutoRefresh();
        }

        console.log(`🔄 Refresh interval changed to ${select.options[select.selectedIndex].text}`);
    }

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.monitor-header');

        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    function init() {
        if (typeof $ === 'undefined') {
            setTimeout(init, 1000);
            return;
        }

        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }

        monitorUI = createMonitorUI();
        makeDraggable(monitorUI);

        document.getElementById('project-search').addEventListener('input', renderTable);
        document.getElementById('auto-refresh-toggle').addEventListener('click', toggleAutoRefresh);
        document.getElementById('refresh-btn').addEventListener('click', fetchAllProjects);
        document.getElementById('refresh-interval-select').addEventListener('change', changeRefreshInterval);
        document.getElementById('columns-btn').addEventListener('click', toggleColumns);

        document.getElementById('hide-zero-diff').addEventListener('change', function() {
            hideZeroDiff = this.checked;
            renderTable();
        });

        document.getElementById('minimize-btn').addEventListener('click', function() {
            monitorUI.classList.toggle('minimized');
            this.textContent = monitorUI.classList.contains('minimized') ? '➕' : '➖';
        });

        document.getElementById('close-btn').addEventListener('click', function() {
            monitorUI.style.display = 'none';
            clearInterval(refreshInterval);
            clearInterval(realtimeUpdateInterval);
        });

        window.sortTable = sortTable;
        window.copyProjectName = copyProjectName;
        window.copyCurrentValue = copyCurrentValue;
        window.copyQueueValue = copyQueueValue;

        if ('speechSynthesis' in window) {
            speechSynthesis.onvoiceschanged = populateVoiceOptions;
            populateVoiceOptions();
        }

        fetchDenominators();
        fetchAllProjects();
        startAutoRefresh();
        setInterval(fetchDenominators, 300000);

        console.log('🔍 Masking Engine Monitor UI initialized');
    }

    init();
})();
