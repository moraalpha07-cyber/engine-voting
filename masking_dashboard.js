// ==UserScript==
// @name         Masking Queue Real-Time Monitor
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Monitor Masking Queue with table layout, search, Hide Zero toggle, and Draggable interface.
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
        #masking-monitor {
            position: fixed;
            top: 20px;
            left: 20px;
            width: 480px;
            background: rgba(10, 10, 10, 0.95);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 100, 0, 0.3);
            border-radius: 16px;
            color: #fff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            overflow: hidden;
            transition: opacity 0.3s;
        }
        #masking-monitor-header {
            padding: 12px 15px;
            background: linear-gradient(90deg, rgba(255, 100, 0, 0.2), transparent);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }
        #masking-monitor-header h3 {
            margin: 0;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #ff9f43;
            pointer-events: none;
        }
        .header-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .toggle-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 100, 0, 0.2);
            color: #ff9f43;
            font-size: 10px;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: all 0.2s;
        }
        .toggle-btn:hover { background: rgba(255, 100, 0, 0.1); }
        .toggle-btn.active { background: #ff9f43; color: #000; font-weight: bold; border-color: #ff9f43; }

        #masking-search-container {
            padding: 8px 12px;
            background: rgba(255,255,255,0.03);
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        #masking-search {
            width: 100%;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            color: #fff;
            padding: 6px 10px;
            font-size: 12px;
            outline: none;
        }
        #masking-search:focus { border-color: rgba(255, 100, 0, 0.5); }

        #masking-table-container {
            max-height: 60vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 100, 0, 0.3) transparent;
        }
        table.masking-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            table-layout: fixed;
        }
        table.masking-table th {
            position: sticky;
            top: 0;
            background: #1a1a1a;
            padding: 12px 10px;
            text-align: left;
            color: #888;
            font-weight: 600;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            z-index: 1;
        }
        table.masking-table td {
            padding: 8px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .p-name { font-weight: 600; color: #ddd; width: 40%; }
        .m-col { text-align: right; width: 30%; }
        .m-val { font-weight: 700; font-family: monospace; font-size: 13px; }
        .m-delta { font-size: 10px; padding: 2px 4px; border-radius: 4px; margin-left: 5px; min-width: 35px; display: inline-block; text-align: center; }
        
        .up { color: #ff4d4d; background: rgba(255, 77, 77, 0.15); }
        .down { color: #00ff88; background: rgba(0, 255, 136, 0.15); }
        .zero { color: #555; background: rgba(255,255,255,0.05); }

        .last-updated { font-size: 10px; text-align: center; padding: 10px; color: #555; background: #0a0a0a; }
        #masking-minimize { cursor: pointer; color: #888; font-size: 18px; }
    `);

    const container = document.createElement('div');
    container.id = 'masking-monitor';
    container.innerHTML = `
        <div id="masking-monitor-header">
            <h3>Masking Monitor</h3>
            <div class="header-actions">
                <button id="masking-hide-zero" class="toggle-btn">Hide Zero</button>
                <span id="masking-minimize">−</span>
            </div>
        </div>
        <div id="masking-search-container">
            <input type="text" id="masking-search" placeholder="Search projects...">
        </div>
        <div id="masking-table-container">
            <table class="masking-table">
                <thead>
                    <tr>
                        <th class="p-name">PROJECT</th>
                        <th class="m-col" style="text-align:right">MASKING</th>
                        <th class="m-col" style="text-align:right">ENGINE</th>
                    </tr>
                </thead>
                <tbody id="masking-table-body">
                    <tr><td colspan="3" style="text-align:center; padding: 20px; color: #666;">Waiting for data...</td></tr>
                </tbody>
            </table>
        </div>
        <div class="last-updated" id="masking-last-updated">Never updated</div>
    `;
    document.body.appendChild(container);

    let currentData = null, searchQuery = "", hideZero = false;

    function renderTable() {
        if (!currentData) return;
        const body = document.getElementById('masking-table-body');
        let html = '';
        
        const projects = Object.keys(currentData)
            .filter(k => k !== '_lastUpdated')
            .filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));

        let visibleCount = 0;
        projects.forEach(p => {
            const metrics = currentData[p];
            const m = metrics["Masking"] || { total: 0, minuteDelta: 0 };
            const e = metrics["Masking Engine"] || { total: 0, minuteDelta: 0 };

            if (hideZero && m.total === 0 && e.total === 0) return;
            visibleCount++;

            const mDeltaClass = m.minuteDelta > 0 ? 'up' : (m.minuteDelta < 0 ? 'down' : 'zero');
            const mDeltaText = m.minuteDelta > 0 ? `+${m.minuteDelta}` : (m.minuteDelta === 0 ? '±0' : m.minuteDelta);
            const eDeltaClass = e.minuteDelta > 0 ? 'up' : (e.minuteDelta < 0 ? 'down' : 'zero');
            const eDeltaText = e.minuteDelta > 0 ? `+${e.minuteDelta}` : (e.minuteDelta === 0 ? '±0' : e.minuteDelta);

            html += `
                <tr>
                    <td class="p-name">${p.toUpperCase()}</td>
                    <td class="m-col" style="text-align:right">
                        <span class="m-val">${m.total}</span><span class="m-delta ${mDeltaClass}">${mDeltaText}</span>
                    </td>
                    <td class="m-col" style="text-align:right">
                        <span class="m-val">${e.total}</span><span class="m-delta ${eDeltaClass}">${eDeltaText}</span>
                    </td>
                </tr>
            `;
        });

        body.innerHTML = html || (hideZero ? '<tr><td colspan="3" style="text-align:center; padding: 20px;">All filtered queues are 0</td></tr>' : '<tr><td colspan="3" style="text-align:center; padding: 20px;">No matches found</td></tr>');
    }

    db.ref("masking/grafana/queue_metrics").on("value", (snapshot) => {
        currentData = snapshot.val();
        if (!currentData) return;
        renderTable();
        document.getElementById('masking-last-updated').innerText = `Updated: ${new Date(currentData._lastUpdated).toLocaleTimeString()}`;
    });

    document.getElementById('masking-search').oninput = (e) => {
        searchQuery = e.target.value;
        renderTable();
    };

    document.getElementById('masking-hide-zero').onclick = (e) => {
        hideZero = !hideZero;
        e.target.classList.toggle('active', hideZero);
        renderTable();
    };

    let minimized = false;
    document.getElementById('masking-minimize').onclick = () => {
        minimized = !minimized;
        document.getElementById('masking-table-container').style.display = minimized ? 'none' : 'block';
        document.getElementById('masking-search-container').style.display = minimized ? 'none' : 'block';
        document.getElementById('masking-minimize').innerText = minimized ? '+' : '−';
    };

    // 🔹 DRAGGABLE LOGIC
    let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
    const dragItem = document.getElementById('masking-monitor-header');
    
    dragItem.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target === dragItem || dragItem.contains(e.target)) isDragging = true;
    }
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
    }
    function dragEnd() { isDragging = false; }

})();
