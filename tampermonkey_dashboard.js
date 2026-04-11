// ==UserScript==
// @name         Trax Queue Real-Time Monitor
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Monitor Trax Queue with table layout highlighting Voting Engine.
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
            width: 480px;
            background: rgba(10, 15, 25, 0.9);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(0, 212, 255, 0.3);
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
        #trax-monitor-header {
            padding: 12px 15px;
            background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.1));
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
        #trax-table-container {
            max-height: 70vh;
            overflow-y: auto;
            scrollbar-width: thin;
        }
        table.trax-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        table.trax-table th {
            position: sticky;
            top: 0;
            background: #0f172a;
            padding: 10px;
            text-align: left;
            color: #64748b;
            font-weight: 500;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            z-index: 1;
        }
        table.trax-table td {
            padding: 8px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .p-name { font-weight: 600; color: #cbd5e1; width: 160px; }
        .v-val { font-weight: 700; text-align: right; font-family: monospace; font-size: 13px; color: #fff; }
        .v-delta { font-size: 10px; padding: 2px 4px; border-radius: 4px; margin-left: 5px; min-width: 35px; display: inline-block; text-align: center; }
        
        .up { color: #ff4d4d; background: rgba(255, 77, 77, 0.15); }
        .down { color: #00ff88; background: rgba(0, 255, 136, 0.15); }
        .zero { color: #475569; background: rgba(255,255,255,0.05); }

        .last-updated { font-size: 10px; text-align: center; padding: 10px; color: #475569; background: #020617; }
        #trax-minimize { cursor: pointer; color: #475569; font-size: 18px; }
    `);

    const container = document.createElement('div');
    container.id = 'trax-monitor';
    container.innerHTML = `
        <div id="trax-monitor-header">
            <h3>Trax Monitor</h3>
            <span id="trax-minimize">−</span>
        </div>
        <div id="trax-table-container">
            <table class="trax-table">
                <thead>
                    <tr>
                        <th>PROJECT</th>
                        <th style="text-align:right">TOTAL</th>
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

    db.ref("trax/queue_metrics").on("value", (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const body = document.getElementById('trax-table-body');
        let html = '';
        const projects = Object.keys(data).filter(k => k !== '_lastUpdated');
        
        projects.forEach(p => {
            const metrics = data[p];
            
            // Calculate pseudo-total if actual total isn't explicit, or use "Validation" as main if that's what's meant.
            // Actually, we'll try to find any metric named "Total" or just the sum of main ones.
            // But usually the user wants "Validation" or just a representative metric.
            // I'll look for "Validation" for "TOTAL" column or sum.
            const main = metrics["Validation"] || { total: 0, minuteDelta: 0 };

            const mDeltaClass = main.minuteDelta > 0 ? 'up' : (main.minuteDelta < 0 ? 'down' : 'zero');
            const mDeltaText = main.minuteDelta > 0 ? `+${main.minuteDelta}` : (main.minuteDelta === 0 ? '±0' : main.minuteDelta);

            html += `
                <tr>
                    <td class="p-name">${p.toUpperCase()}</td>
                    <td style="text-align:right">
                        <span class="v-val">${main.total}</span><span class="v-delta ${mDeltaClass}">${mDeltaText}</span>
                    </td>
                </tr>
            `;
        });

        body.innerHTML = html;
        document.getElementById('trax-last-updated').innerText = `Updated: ${new Date(data._lastUpdated).toLocaleTimeString()}`;
    });

    let minimized = false;
    document.getElementById('trax-minimize').onclick = () => {
        minimized = !minimized;
        document.getElementById('trax-table-container').style.display = minimized ? 'none' : 'block';
        document.getElementById('trax-minimize').innerText = minimized ? '+' : '−';
    };

})();
