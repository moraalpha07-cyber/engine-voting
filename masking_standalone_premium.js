// ==UserScript==
// @name         Masking Engine Premium Monitor
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Premium Masking Monitor with Outflow, Queue Diff (Adu Wena Gaana), and Telegram Alerts.
// @author       Dharana & Antigravity
// @match        https://monitor.trax-cloud.com/d/h5yrZ7zWk/selector-aws-prod*
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
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

    const TELEGRAM_URL = "https://api.telegram.org/bot1623834999:AAH9kS6Y_R150sI98Qyk7v7SN5MgKhSq1kA/sendMessage";
    const CHAT_ID = "@NestPT";

    let projectData = {};
    let autoRefresh = true;
    let refreshInterval;
    let sortColumn = 0;
    let sortDirection = 1;
    let monitorUI;
    let currentRefreshInterval = 60000;
    let hideZeroDiff = true;
    let searchQuery = "";

    projects.forEach(project => {
        projectData[project] = {
            outflow: 0,
            outflowPrev: 0,
            outflowDiff: 0,
            queue: 0,
            queuePrev: 0,
            queueDiff: 0,
            lastUpdate: 'Never',
            lastUpdateTime: null,
            status: 'inactive'
        };
    });

    GM_addStyle(`
        #masking-premium {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 580px;
            background: rgba(10, 10, 10, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 159, 67, 0.3);
            border-radius: 20px;
            color: #fff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #masking-premium-header {
            padding: 15px 20px;
            background: linear-gradient(90deg, rgba(255, 159, 67, 0.15), transparent);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }

        .premium-title {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #ff9f43;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .controls {
            display: flex;
            gap: 10px;
        }

        .control-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .dot-close { background: #ff5f56; }
        .dot-min { background: #ffbd2e; }
        .dot-max { background: #27c93f; }
        .control-dot:hover { transform: scale(1.2); }

        .search-bar {
            padding: 12px 20px;
            background: rgba(255,255,255,0.03);
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        #masking-search {
            width: 100%;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            color: #fff;
            padding: 8px 15px;
            font-size: 13px;
            outline: none;
            transition: border-color 0.3s;
        }

        #masking-search:focus { border-color: rgba(255, 159, 67, 0.5); }

        .table-container {
            max-height: 450px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 159, 67, 0.3) transparent;
        }

        .masking-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }

        .masking-table th {
            position: sticky;
            top: 0;
            background: #0a0a0a;
            padding: 12px 15px;
            text-align: left;
            color: #888;
            font-weight: 600;
            text-transform: uppercase;
            border-bottom: 2px solid rgba(255, 255, 255, 0.05);
            cursor: pointer;
            z-index: 10;
        }

        .masking-table th:hover { color: #ff9f43; background: #111; }

        .masking-table td {
            padding: 10px 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.02);
        }

        .masking-table tr:hover { background: rgba(255, 159, 67, 0.05); }

        .p-name { font-weight: 600; color: #eee; }
        .p-name.pool { color: #ff5f56; }

        .val-cell { text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 700; }
        .delta { font-size: 10px; padding: 2px 5px; border-radius: 4px; margin-left: 6px; display: inline-block; min-width: 35px; text-align: center; }

        .delta.up { color: #ff4d4d; background: rgba(255, 77, 77, 0.1); }
        .delta.down { color: #00ff88; background: rgba(0, 255, 136, 0.1); }
        .delta.zero { color: #555; background: rgba(255,255,255,0.05); }

        .footer {
            padding: 12px 20px;
            background: #050505;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: #666;
        }

        .status-pill {
            padding: 3px 8px;
            border-radius: 10px;
            background: rgba(0, 255, 136, 0.1);
            color: #00ff88;
            font-weight: 700;
        }

        .minimized { height: 50px !important; width: 250px !important; }
        .minimized .search-bar, .minimized .table-container, .minimized .footer { display: none; }
    `);

    function sendTelegram(project, delta, current) {
        const text = encodeURIComponent(`🚨 Masking Alert: ${project.toUpperCase()}\nAdu Wena Gaana: ${Math.abs(delta)}\nCurrent Queue: ${current}`);
        fetch(`${TELEGRAM_URL}?chat_id=${CHAT_ID}&text=${text}`).catch(e => console.error(e));
    }

    function createUI() {
        const container = document.createElement('div');
        container.id = 'masking-premium';
        container.innerHTML = `
            <div id="masking-premium-header">
                <div class="premium-title"><span>🔍</span> MASKING MONITOR</div>
                <div class="controls">
                    <div class="control-dot dot-min" id="premium-min"></div>
                    <div class="control-dot dot-close" id="premium-close"></div>
                </div>
            </div>
            <div class="search-bar">
                <input type="text" id="masking-search" placeholder="Search projects...">
            </div>
            <div class="table-container">
                <table class="masking-table">
                    <thead>
                        <tr>
                            <th style="width: 35%" onclick="setSort(0)">Project</th>
                            <th style="width: 30%; text-align:right" onclick="setSort(1)">Outflow</th>
                            <th style="width: 35%; text-align:right" onclick="setSort(2)">Queue</th>
                        </tr>
                    </thead>
                    <tbody id="premium-table-body"></tbody>
                </table>
            </div>
            <div class="footer">
                <div id="last-update">Last Update: Never</div>
                <div class="status-pill" id="auto-status">LIVE</div>
            </div>
        `;
        document.body.appendChild(container);

        document.getElementById('masking-search').oninput = (e) => {
            searchQuery = e.target.value;
            render();
        };

        document.getElementById('premium-min').onclick = () => container.classList.toggle('minimized');
        document.getElementById('premium-close').onclick = () => container.remove();

        makeDraggable(container);
        return container;
    }

    function render() {
        if (!document.getElementById('premium-table-body')) return;
        const body = document.getElementById('premium-table-body');
        let filtered = projects.filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()));

        filtered.sort((a, b) => {
            let valA, valB;
            if (sortColumn === 0) { valA = a; valB = b; }
            else if (sortColumn === 1) { valA = projectData[a].outflow; valB = projectData[b].outflow; }
            else { valA = projectData[a].queueDiff; valB = projectData[b].queueDiff; }

            if (typeof valA === 'string') return sortDirection * valA.localeCompare(valB);
            return sortDirection * (valB - valA);
        });

        body.innerHTML = filtered.map(p => {
            const data = projectData[p];
            const qDeltaClass = data.queueDiff < 0 ? 'down' : (data.queueDiff > 0 ? 'up' : 'zero');
            const qDeltaText = data.queueDiff < 0 ? data.queueDiff : (data.queueDiff > 0 ? `+${data.queueDiff}` : '±0');
            
            const oDeltaClass = data.outflowDiff > 0 ? 'up' : (data.outflowDiff < 0 ? 'down' : 'zero');
            const oDeltaText = data.outflowDiff > 0 ? `+${data.outflowDiff}` : (data.outflowDiff < 0 ? data.outflowDiff : '±0');

            return `
                <tr>
                    <td class="p-name ${poolProjects.includes(p) ? 'pool' : ''}">${p.toUpperCase()}</td>
                    <td class="val-cell">
                        <span style="color: #ff9f43">${data.outflow}</span>
                        <span class="delta ${oDeltaClass}">${oDeltaText}</span>
                    </td>
                    <td class="val-cell">
                        <span>${data.queue}</span>
                        <span class="delta ${qDeltaClass}">${qDeltaText}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function fetchData(project) {
        // Fetch Queue
        $.ajax({
            url: "https://monitor.trax-cloud.com/api/datasources/proxy/29/render",
            method: "POST",
            data: {
                target: `prod.gauges.selector.queue.masking_engine.${project}.total`,
                from: "-1h", until: "now", format: "json"
            },
            success: (res) => {
                if (res[0] && res[0].datapoints.length) {
                    const last = res[0].datapoints.filter(d => d[0] !== null).pop();
                    if (last) {
                        const newVal = last[0];
                        const diff = projectData[project].queue !== 0 ? newVal - projectData[project].queue : 0;
                        
                        if (diff < -15) sendTelegram(project, diff, newVal);
                        
                        projectData[project].queuePrev = projectData[project].queue;
                        projectData[project].queue = newVal;
                        projectData[project].queueDiff = diff;
                    }
                }
                render();
            }
        });

        // Fetch Outflow
        $.ajax({
            url: "https://monitor.trax-cloud.com/api/datasources/proxy/29/render",
            method: "POST",
            data: {
                target: `prod.counters.selector.outflow.masking_engine.${project}.count`,
                from: "today", until: "now", format: "json"
            },
            success: (res) => {
                if (res[0] && res[0].datapoints.length) {
                    const total = res[0].datapoints.filter(d => d[0] !== null).reduce((a, b) => a + b[0], 0);
                    const diff = projectData[project].outflow !== 0 ? total - projectData[project].outflow : 0;
                    
                    projectData[project].outflowPrev = projectData[project].outflow;
                    projectData[project].outflow = total;
                    projectData[project].outflowDiff = diff;
                }
                render();
            }
        });
    }

    function refreshAll() {
        projects.forEach(p => fetchData(p));
        document.getElementById('last-update').innerText = `Last Update: ${new Date().toLocaleTimeString()}`;
    }

    window.setSort = (col) => {
        if (sortColumn === col) sortDirection *= -1;
        else { sortColumn = col; sortDirection = 1; }
        render();
    };

    function makeDraggable(el) {
        let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
        const header = el.querySelector('#masking-premium-header');
        header.onmousedown = (e) => {
            e.preventDefault();
            p3 = e.clientX; p4 = e.clientY;
            document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
            document.onmousemove = (e) => {
                e.preventDefault();
                p1 = p3 - e.clientX; p2 = p4 - e.clientY;
                p3 = e.clientX; p4 = e.clientY;
                el.style.top = (el.offsetTop - p2) + "px";
                el.style.left = (el.offsetLeft - p1) + "px";
            };
        };
    }

    function init() {
        createUI();
        refreshAll();
        setInterval(refreshAll, currentRefreshInterval);
    }

    if (typeof $ === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
        script.onload = init;
        document.head.appendChild(script);
    } else {
        init();
    }
})();
