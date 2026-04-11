// ==UserScript==
// @name         Voting Engine Real-Time Monitor
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Monitor Voting Engine with a compact table layout.
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
        #voting-monitor {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 380px;
            background: rgba(10, 25, 15, 0.9);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(0, 255, 136, 0.3);
            border-radius: 16px;
            color: #fff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            overflow: hidden;
            transition: all 0.3s ease;
        }
        #voting-monitor-header {
            padding: 12px 15px;
            background: linear-gradient(90deg, transparent, rgba(0, 255, 136, 0.1));
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #voting-monitor-header h3 {
            margin: 0;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #00ff88;
        }
        #voting-table-container {
            max-height: 60vh;
            overflow-y: auto;
            scrollbar-width: thin;
        }
        table.voting-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        table.voting-table th {
            position: sticky;
            top: 0;
            background: #061f12;
            padding: 10px;
            text-align: left;
            color: #4ade80;
            font-weight: 500;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            z-index: 1;
        }
        table.voting-table td {
            padding: 8px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .p-name { font-weight: 600; color: #bdf6d9; width: 180px; }
        .v-val { font-weight: 700; text-align: right; font-family: monospace; font-size: 13px; color: #fff; }
        .v-delta { font-size: 10px; padding: 2px 4px; border-radius: 4px; margin-left: 5px; min-width: 35px; display: inline-block; text-align: center; }
        
        .up { color: #ff4d4d; background: rgba(255, 77, 77, 0.15); }
        .down { color: #00ff88; background: rgba(0, 255, 136, 0.15); }
        .zero { color: #555; background: rgba(255,255,255,0.05); }

        .last-updated { font-size: 10px; text-align: center; padding: 10px; color: #4ade80; background: #010a05; opacity: 0.6; }
        #voting-minimize { cursor: pointer; color: #4ade80; font-size: 18px; }
    `);

    const container = document.createElement('div');
    container.id = 'voting-monitor';
    container.innerHTML = `
        <div id="voting-monitor-header">
            <h3>Voting Engine Monitor</h3>
            <span id="voting-minimize">−</span>
        </div>
        <div id="voting-table-container">
            <table class="voting-table">
                <thead>
                    <tr>
                        <th>PROJECT</th>
                        <th style="text-align:right">VALUE</th>
                    </tr>
                </thead>
                <tbody id="voting-table-body">
                    <tr><td colspan="2" style="text-align:center; padding: 20px; color: #4ade80;">Waiting for data...</td></tr>
                </tbody>
            </table>
        </div>
        <div class="last-updated" id="voting-last-updated">Never updated</div>
    `;
    document.body.appendChild(container);

    db.ref("engine-voting/grafana/queue_metrics").on("value", (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const body = document.getElementById('voting-table-body');
        let html = '';
        const projects = Object.keys(data).filter(k => k !== '_lastUpdated');
        
        projects.forEach(p => {
            const metrics = data[p];
            // Since this feeder only has one metric (Voting Engine), we'll grab the first one found or specifically 'Voting Engine'
            const mKey = Object.keys(metrics)[0];
            const m = metrics[mKey] || { total: 0, minuteDelta: 0 };

            const deltaClass = m.minuteDelta > 0 ? 'up' : (m.minuteDelta < 0 ? 'down' : 'zero');
            const deltaText = m.minuteDelta > 0 ? `+${m.minuteDelta}` : (m.minuteDelta === 0 ? '±0' : m.minuteDelta);

            html += `
                <tr>
                    <td class="p-name">${p.toUpperCase()}</td>
                    <td style="text-align:right">
                        <span class="v-val">${m.total}</span><span class="v-delta ${deltaClass}">${deltaText}</span>
                    </td>
                </tr>
            `;
        });

        body.innerHTML = html;
        document.getElementById('voting-last-updated').innerText = `Updated: ${new Date(data._lastUpdated).toLocaleTimeString()}`;
    });

    let minimized = false;
    document.getElementById('voting-minimize').onclick = () => {
        minimized = !minimized;
        document.getElementById('voting-table-container').style.display = minimized ? 'none' : 'block';
        document.getElementById('voting-minimize').innerText = minimized ? '+' : '−';
    };

})();
