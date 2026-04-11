// ==UserScript==
// @name         Voting Engine Real-Time Monitor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Monitor Voting Engine metrics from Firebase with 1-minute deltas.
// @author       Antigravity
// @match        *://monitor.trax-cloud.com/*
// @match        *://*.firebaseio.com/*
// @grant        GM_addStyle
// @require      https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js
// @require      https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js
// ==/UserScript==

(function() {
    'use strict';

    // 🔴 SETTINGS - PASTE YOUR FIREBASE URL HERE
    const FIREBASE_DB_URL = "https://projectallow-default-rtdb.firebaseio.com/"; 

    // 🔹 Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp({ databaseURL: FIREBASE_DB_URL });
    }
    const db = firebase.database();

    // 🔹 Styles
    GM_addStyle(`
        #voting-monitor {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            max-height: 80vh;
            background: rgba(10, 20, 10, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 255, 136, 0.2);
            border-radius: 16px;
            color: #fff;
            font-family: 'Inter', sans-serif;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            overflow: hidden;
            transition: all 0.3s ease;
        }
        #voting-monitor-header {
            padding: 15px;
            background: rgba(0, 255, 136, 0.1);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }
        #voting-monitor-header h3 {
            margin: 0;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #00ff88;
        }
        #voting-monitor-content {
            padding: 10px;
            overflow-y: auto;
            flex-grow: 1;
        }
        .project-card {
            margin-bottom: 15px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            padding: 10px;
        }
        .project-name {
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 8px;
            color: #aaa;
            border-left: 3px solid #00ff88;
            padding-left: 8px;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 4px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .metric-name { width: 140px; }
        .metric-value { font-weight: 600; text-align: right; width: 60px; }
        .metric-delta { 
            width: 60px; 
            text-align: right; 
            font-size: 11px;
            padding: 1px 4px;
            border-radius: 4px;
        }
        .delta-up { color: #ff4d4d; background: rgba(255, 77, 77, 0.1); }
        .delta-down { color: #00ff88; background: rgba(0, 255, 136, 0.1); }
        .delta-zero { color: #666; }
        .last-updated {
            font-size: 10px;
            text-align: center;
            padding: 8px;
            color: #555;
        }
        #voting-minimize {
            cursor: pointer;
            font-size: 18px;
            padding: 0 5px;
        }
    `);

    // 🔹 Create UI
    const container = document.createElement('div');
    container.id = 'voting-monitor';
    container.innerHTML = `
        <div id="voting-monitor-header">
            <h3>Voting Engine Monitor</h3>
            <span id="voting-minimize">−</span>
        </div>
        <div id="voting-monitor-content">
            <div style="text-align:center; padding: 20px; color: #666;">Waiting for data...</div>
        </div>
        <div class="last-updated" id="voting-last-updated">Never updated</div>
    `;
    document.body.appendChild(container);

    // 🔹 Listen for Updates (engine-voting/grafana/queue_metrics)
    db.ref("engine-voting/grafana/queue_metrics").on("value", (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        let html = '';
        const projects = Object.keys(data).filter(k => k !== '_lastUpdated');
        
        projects.forEach(project => {
            html += `<div class="project-card">
                <div class="project-name">${project.toUpperCase()}</div>`;
            
            const metrics = data[project];
            Object.keys(metrics).forEach(mName => {
                const m = metrics[mName];
                const deltaClass = m.minuteDelta > 0 ? 'delta-up' : (m.minuteDelta < 0 ? 'delta-down' : 'delta-zero');
                const deltaText = m.minuteDelta > 0 ? `+${m.minuteDelta}` : (m.minuteDelta === 0 ? '±0' : m.minuteDelta);
                
                html += `
                    <div class="metric-row">
                        <span class="metric-value">${m.total}</span>
                        <span class="metric-delta ${deltaClass}">${deltaText}</span>
                    </div>
                `;
            });
            html += `</div>`;
        });

        document.getElementById('voting-monitor-content').innerHTML = html;
        document.getElementById('voting-last-updated').innerText = `Last Updated: ${new Date(data._lastUpdated).toLocaleTimeString()}`;
    });

    // 🔹 Interactivity (Minimize)
    let minimized = false;
    document.getElementById('voting-minimize').onclick = () => {
        minimized = !minimized;
        document.getElementById('voting-monitor-content').style.display = minimized ? 'none' : 'block';
        document.getElementById('voting-minimize').innerText = minimized ? '+' : '−';
    };

    // 🔹 Make Draggable
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    const dragItem = document.getElementById('voting-monitor-header');
    dragItem.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target === dragItem || dragItem.contains(e.target)) { isDragging = true; }
    }
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, container);
        }
    }
    function setTranslate(xPos, yPos, el) { el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)"; }
    function dragEnd(e) { isDragging = false; }

})();
