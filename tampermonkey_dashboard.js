// ==UserScript==
// @name         Trax Queue Real-Time Monitor
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Monitor Trax Queue with table layout and Hide Zero toggle.
// @author       Antigravity
// @match        *://monitor.trax-cloud.com/*
// @match        *://*.firebaseio.com/*
// @grant        GM_addStyle
// @require      https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js
// @require      https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js
// ==/UserScript==

(function() {
    'use strict';

    const FIREBASE_DB_URL = "https://projectallow-default-rtdb.firebaseio.com/"; 

    if (!firebase.apps.length) {
        firebase.initializeApp({ databaseURL: FIREBASE_DB_URL });
    }
    const db = firebase.database();

    GM_addStyle(`
        #trax-monitor {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 420px;
            background: rgba(10, 15, 25, 0.95);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(0, 212, 255, 0.3);
            border-radius: 16px;
            color: #fff;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #trax-monitor-header {
            padding: 12px 15px;
            background: linear-gradient(90deg, rgba(0, 212, 255, 0.1), transparent);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #trax-monitor-header h3 {
            margin: 0;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #00d4ff;
        }
        .header-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .toggle-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 212, 255, 0.2);
            color: #00d4ff;
            font-size: 10px;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: all 0.2s;
        }
        .toggle-btn:hover { background: rgba(0, 212, 255, 0.1); }
        .toggle-btn.active { background: #00d4ff; color: #000; font-weight: bold; border-color: #00d4ff; }

        #trax-table-container {
            max-height: 70vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 212, 255, 0.3) transparent;
        }
        table.trax-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            table-layout: fixed;
        }
        table.trax-table th {
            position: sticky;
            top: 0;
            background: #0f172a;
            padding: 12px 10px;
            text-align: left;
            color: #64748b;
            font-weight: 600;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            z-index: 1;
        }
        table.trax-table td {
            padding: 8px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .p-name { font-weight: 600; color: #cbd5e1; width: 60%; }
        .v-col { text-align: right; width: 40%; }
        .v-val { font-weight: 700; font-family: 'Roboto Mono', monospace; font-size: 13px; color: #fff; }
        .v-delta { font-size: 10px; padding: 2px 5px; border-radius: 4px; margin-left: 6px; min-width: 35px; display: inline-block; text-align: center; }
        
        .up { color: #ff4d4d; background: rgba(255, 77, 77, 0.15); }
        .down { color: #00ff88; background: rgba(0, 255, 136, 0.15); }
        .zero { color: #475569; background: rgba(255,255,255,0.05); }

        .last-updated { font-size: 10px; text-align: center; padding: 10px; color: #475569; background: #020617; border-top: 1px solid rgba(255,255,255,0.05); }
        #trax-minimize { cursor: pointer; color: #475569; font-size: 18px; transition: color 0.2s; }
        #trax-minimize:hover { color: #fff; }
    `);

    const container = document.createElement('div');
    container.id = 'trax-monitor';
    container.innerHTML = `
        <div id="trax-monitor-header">
            <h3>Trax Monitor</h3>
            <div class="header-actions">
                <button id="trax-hide-zero" class="toggle-btn">Hide Zero</button>
                <span id="trax-minimize">−</span>
            </div>
        </div>
        <div id="trax-table-container">
            <table class="trax-table">
                <thead>
                    <tr>
                        <th class="p-name">PROJECT</th>
                        <th class="v-col" style="text-align:right">TOTAL</th>
                    </tr>
                </thead>
                <tbody id="trax-table-body">
                    <tr><td colspan="2" style="text-align:center; padding: 20px; color: #475569;">Waiting for data...</td></tr>
                </tbody>
            </table>
        </div>
        <div class="last-updated" id="trax-last-updated">Never updated</div>
    `;
    document.body.appendChild(container);

    let hideZero = false;
    let cachedData = null;

    function renderTable() {
        if (!cachedData) return;
        const body = document.getElementById('trax-table-body');
        let html = '';
        const projects = Object.keys(cachedData).filter(k => k !== '_lastUpdated');
        
        let visibleCount = 0;
        projects.forEach(p => {
            const metrics = cachedData[p];
            const main = metrics["Validation"] || { total: 0, minuteDelta: 0 };

            if (hideZero && main.total === 0) return;
            visibleCount++;

            const mDeltaClass = main.minuteDelta > 0 ? 'up' : (main.minuteDelta < 0 ? 'down' : 'zero');
            const mDeltaText = main.minuteDelta > 0 ? `+${main.minuteDelta}` : (main.minuteDelta === 0 ? '±0' : main.minuteDelta);

            html += `
                <tr>
                    <td class="p-name">${p.toUpperCase()}</td>
                    <td class="v-col" style="text-align:right">
                        <span class="v-val">${main.total}</span><span class="v-delta ${mDeltaClass}">${mDeltaText}</span>
                    </td>
                </tr>
            `;
        });

        if (visibleCount === 0 && hideZero) {
            html = '<tr><td colspan="2" style="text-align:center; padding: 20px; color: #475569;">All current queues are 0</td></tr>';
        }

        body.innerHTML = html;
        document.getElementById('trax-last-updated').innerText = `Updated: ${new Date(cachedData._lastUpdated).toLocaleTimeString()}`;
    }

    db.ref("trax/queue_metrics").on("value", (snapshot) => {
        cachedData = snapshot.val();
        renderTable();
    });

    // 🔹 Toggle Zero Logic
    document.getElementById('trax-hide-zero').onclick = (e) => {
        hideZero = !hideZero;
        e.target.classList.toggle('active', hideZero);
        renderTable();
    };

    // 🔹 Minimize Logic
    let minimized = false;
    document.getElementById('trax-minimize').onclick = () => {
        minimized = !minimized;
        document.getElementById('trax-table-container').style.display = minimized ? 'none' : 'block';
        document.getElementById('trax-minimize').innerText = minimized ? '+' : '−';
        container.style.height = minimized ? 'auto' : '';
    };

})();
