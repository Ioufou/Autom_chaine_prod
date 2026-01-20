let currentLogs = []; 
let isTreeView = true; 
let currentSkip = 0;
let isLoading = false;
let hasMoreData = true;

window.addEventListener('scroll', handleScroll);

async function newSearch() {
    currentSkip = 0;
    currentLogs = [];
    hasMoreData = true;
    document.getElementById('treeContainer').innerHTML = '';
    document.getElementById('listContainer').innerHTML = '';
    document.getElementById('resultsInfo').innerText = '';
    
    await fetchLogs();
}

function findSmartKey(obj, candidates, forbidden = []) {
    const keys = Object.keys(obj);

    for (const c of candidates) {
        if (obj[c]) return c;
    }

    for (const c of candidates) {
        const found = keys.find(k => k.toLowerCase() === c.toLowerCase());
        if (found) return found;
    }

    for (const c of candidates) {
        const found = keys.find(k => {
            const keyLow = k.toLowerCase();
            const candLow = c.toLowerCase();
            const containsForbidden = forbidden.some(bad => keyLow.includes(bad.toLowerCase()));
            return keyLow.includes(candLow) && !containsForbidden;
        });
        if (found) return found;
    }

    return null;
}

async function fetchLogs() {
    if (isLoading || !hasMoreData) return;
    
    isLoading = true;
    document.getElementById('loadingIndicator').style.display = 'block';

    const limit = document.getElementById('s_limit').value || 50;
    const params = new URLSearchParams();
    
    const fields = ['s_filename', 's_source', 's_title', 's_status'];
    const apiFields = ['filename', 'source', 'title', 'status'];
    fields.forEach((id, index) => {
        const val = document.getElementById(id).value;
        if(val) params.append(apiFields[index], val);
    });

    params.append('limit', limit);
    params.append('skip', currentSkip);

    try {
        const res = await fetch(`/api/search?${params.toString()}`);
        const newLogs = await res.json();
        
        document.getElementById('loadingIndicator').style.display = 'none';
        
        if (newLogs.length === 0) {
            hasMoreData = false;
            if (currentLogs.length === 0) document.getElementById('resultsInfo').innerText = "Aucun résultat.";
            isLoading = false;
            return;
        }

        if (newLogs.length < parseInt(limit)) {
            hasMoreData = false;
        }

        currentLogs = currentLogs.concat(newLogs);
        currentSkip += newLogs.length;

        document.getElementById('resultsInfo').innerText = `${currentLogs.length} éléments affichés.`;

        if (isTreeView) {
            renderTree(currentLogs);
        } else {
            appendToList(newLogs);
        }

    } catch(e) {
        console.error(e);
        document.getElementById('loadingIndicator').innerText = "Erreur chargement.";
    } finally {
        isLoading = false;
    }
}

function handleScroll() {
    if (isTreeView) return;

    const scrollPosition = window.innerHeight + window.scrollY;
    const bodyHeight = document.body.offsetHeight;

    if (scrollPosition >= bodyHeight - 100) {
        fetchLogs();
    }
}

async function uploadFile() {
    const fileInput = document.getElementById('logFile');
    const file = fileInput.files[0];
    const force = document.getElementById('forceUpload').checked;

    if (!file) return alert("Veuillez sélectionner un fichier.");
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('force', force);
    
    const statusElem = document.getElementById('uploadStatus');
    statusElem.innerText = "Envoi en cours...";
    
    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (res.ok) {
            statusElem.innerHTML = "⏳ - Traitement en cours...";
            statusElem.className = "status-warning";
            
            pollForFile(file.name);

            fileInput.value = '';
            document.getElementById('forceUpload').checked = false;
        } else if (res.status === 409) {
            statusElem.innerText = "⚠️ - Doublon : " + data.detail;
            statusElem.className = "status-warning";
        } else {
            statusElem.innerText = "Erreur : " + data.detail;
            statusElem.className = "status-error";
        }
    } catch(e) { 
        console.error(e);
        statusElem.innerText = "Erreur réseau"; 
        statusElem.className = "status-error";
    }
}

async function pollForFile(filename) {
    const statusElem = document.getElementById('uploadStatus');
    let attempts = 0;
    const maxAttempts = 600;

    const intervalId = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch('/api/files');
            const files = await res.json();

            if (files.includes(filename)) {
                clearInterval(intervalId);
                
                statusElem.innerText = "✅ - Traitement terminé avec succès !";
                statusElem.className = "status-ok";
                
                loadFiles();
            }
        } catch (e) {
            console.error("Erreur polling", e);
        }

        if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            statusElem.innerText = "⚠️ - Délai d'attente dépassé.";
            statusElem.className = "status-error";
        }
    }, 2000);
}

function clearSearch() {
    document.querySelectorAll('input[type="text"]').forEach(i => i.value = '');
    document.getElementById('resultsInfo').innerText = '';
    document.getElementById('treeContainer').innerHTML = '';
    document.getElementById('listContainer').innerHTML = '';
}

async function searchLogs() {
    const params = new URLSearchParams();
    const fields = ['s_filename', 's_source', 's_title', 's_status'];
    const apiFields = ['filename', 'source', 'title', 'status'];

    fields.forEach((id, index) => {
        const val = document.getElementById(id).value;
        if(val) params.append(apiFields[index], val);
    });

    try {
        const res = await fetch(`/api/search?${params.toString()}`);
        currentLogs = await res.json();
        
        document.getElementById('resultsInfo').innerText = `${currentLogs.length} éléments trouvés.`;
        render();
    } catch(e) {
        console.error(e);
        alert("Erreur lors de la recherche");
    }
}

function toggleView() {
    isTreeView = !isTreeView;
    const treeC = document.getElementById('treeContainer');
    const listC = document.getElementById('listContainer');

    if (isTreeView) {
        listC.classList.add('hidden');
        treeC.classList.remove('hidden');
        renderTree(currentLogs);
    } else {
        treeC.classList.add('hidden');
        listC.classList.remove('hidden');
        listC.innerHTML = '';
        appendToList(currentLogs);
    }
}

function appendToList(logs) {
    const container = document.getElementById('listContainer');
    
    logs.forEach(log => {
        const d = log.data;
        const statusClass = (d['Status'] || '').toLowerCase().includes('success') ? 'success' : 'error';
        
        const typeKey = findSmartKey(d, ['Type'], []) || 'Type';
        const rawType = d[typeKey] || 'File';
        const type = String(rawType).trim().toLowerCase();
        const isFolder = type.includes('folder');

        const sizeKey = findSmartKey(d, ['Size', 'Taille'], []);
        const sizeVal = sizeKey ? d[sizeKey] : '';

        const showSize = !isFolder && sizeVal && sizeVal !== '0 Bytes';

        const sizeHtml = showSize 
            ? `<span class="file-size">(${sizeVal})</span>` 
            : '';

        const div = document.createElement('div');
        div.className = `list-card ${statusClass}`;
        div.innerHTML = `
            <div><strong>${d['Title']}</strong> (${d['Type']}) ${sizeHtml}</div>
            <div style="font-size:0.85em; color:#666;">${d['Source']}</div>
            <div style="font-size:0.85em;">Status: ${d['Status']}</div>
        `;
        container.appendChild(div);
    });
}

function render() {
    const treeC = document.getElementById('treeContainer');
    const listC = document.getElementById('listContainer');

    if (isTreeView) {
        listC.classList.add('hidden');
        treeC.classList.remove('hidden');
        renderTree(currentLogs);
    } else {
        treeC.classList.add('hidden');
        listC.classList.remove('hidden');
        renderList(currentLogs);
    }
}

function renderTree(logs) {
    const container = document.getElementById('treeContainer');
    container.innerHTML = '';

    if (logs.length === 0) return;

    const root = {};

    logs.forEach(log => {
        const d = log.data;
        
        const titleKey = findSmartKey(d, ['Title', 'Name', 'Nom', 'File'], ['id', 'date', 'time']) || Object.keys(d)[0];
        const sourceKey = findSmartKey(d, ['Source', 'Path', 'Chemin'], ['id']);
        const statusKey = findSmartKey(d, ['Status', 'Statut'], []);
        const typeKey = findSmartKey(d, ['Type'], []);
        const sizeKey = findSmartKey(d, ['Size', 'Taille', 'Poids', 'Length'], []);

        const title = (d[titleKey] || 'Sans titre').trim();
        const type = (d[typeKey] || 'File').toLowerCase();
        const sizeVal = sizeKey ? d[sizeKey] : '';
        let rawPath = d[sourceKey] || '';
        
        let parts = rawPath.split(/[\\/]/).filter(p => p);

        if (parts.length > 0 && parts[parts.length - 1].trim() === title) {
            parts.pop();
        }

        let currentLevel = root;
        parts.forEach(part => {
            if (!currentLevel[part]) {
                currentLevel[part] = { __type: 'folder', __children: {}, __status: 'ok', __isVirtual: true };
            }
            if (d[statusKey] && d[statusKey].toLowerCase() !== 'successful') {
                currentLevel[part].__status = 'error';
            }
            currentLevel = currentLevel[part].__children;
        });

        if (!currentLevel[title]) {
             currentLevel[title] = { 
                 __type: type, 
                 __children: {}, 
                 __data: d, 
                 __status: (d[statusKey] || '').toLowerCase() === 'successful' ? 'ok' : 'error',
                 __size: sizeVal
             };
        } else {
            currentLevel[title].__data = d;
            currentLevel[title].__type = type;
            currentLevel[title].__size = sizeVal;
            if ((d[statusKey] || '').toLowerCase() !== 'successful') {
                currentLevel[title].__status = 'error';
            }
        }
    });

    function createNodeHtml(name, node) {
        const hasChildren = Object.keys(node.__children).length > 0;
        const isFolder = node.__type === 'folder' || hasChildren;
        const statusClass = node.__status === 'error' ? 'status-error' : 'status-ok';
        const icon = isFolder ? '📂' : '📄';

        let sizeHtml = '';
        if (node.__size && node.__size !== '0 Bytes' && !isFolder) {
            sizeHtml = `<span class="file-size">(${node.__size})</span>`;
        }

        if (isFolder) {
            let childrenHtml = '';
            
            const keys = Object.keys(node.__children).sort((a, b) => {
                const nodeA = node.__children[a];
                const nodeB = node.__children[b];
                const typeA = (nodeA.__type === 'folder' || Object.keys(nodeA.__children).length > 0) ? 0 : 1;
                const typeB = (nodeB.__type === 'folder' || Object.keys(nodeB.__children).length > 0) ? 0 : 1;
                if (typeA !== typeB) return typeA - typeB;
                return a.localeCompare(b);
            });

            for (const key of keys) childrenHtml += createNodeHtml(key, node.__children[key]);
            
            const openAttr = node.__status === 'error' ? 'open' : '';
            
            return `
                <details ${openAttr}>
                    <summary class="${statusClass}">
                        <span class="icon folder-icon">${icon}</span><strong>${name}</strong>
                    </summary>
                    <div class="tree-children">
                        ${childrenHtml}
                    </div>
                </details>
            `;
        } else {
            return `
            <div class="tree-item">
                <span class="icon file-icon">
                    ${icon}
                </span>
                <span class="${statusClass}">
                    ${name}
                </span>
                ${sizeHtml}
            </div>`;
        }
    }

    let html = '';
    Object.keys(root).sort().forEach(k => html += createNodeHtml(k, root[k]));
    container.innerHTML = html || '<p>🍃 - Aucune donnée.</p>';
}

function renderList(logs) {
    const container = document.getElementById('listContainer');
    container.innerHTML = '';
    logs.forEach(log => {
        const d = log.data;
        const statusClass = (d['Status'] || '').toLowerCase().includes('success') ? 'success' : 'error';
        container.innerHTML += `
            <div class="list-card ${statusClass}">
                <div><strong>${d['Title']}</strong> (${d['Type']})</div>
                <div style="font-size:0.85em; color:#666;">${d['Source']}</div>
                <div style="font-size:0.85em;">Status: ${d['Status']}</div>
            </div>`;
    });
}

document.addEventListener('DOMContentLoaded', loadFiles);

async function loadFiles() {
    const listContainer = document.getElementById('importedFilesList');
    try {
        const res = await fetch('/api/files');
        const files = await res.json();
        
        listContainer.innerHTML = '';
        
        if (files.length === 0) {
            listContainer.innerHTML = '<div style="padding:10px; color:#999; font-size:0.8em;">Aucun fichier importé.</div>';
            return;
        }

        files.forEach(filename => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <span class="file-name" onclick="fillSearchFilename('${filename}')" title="Filtrer sur ce fichier">${filename}</span>
                <button class="btn-delete" onclick="deleteFile('${filename}')" title="Supprimer tout le contenu de ce fichier">🗑️</button>
            `;
            listContainer.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<div class="status-error" style="padding:5px;">Erreur chargement</div>';
    }
}

async function deleteFile(filename) {
    if (!confirm(`Voulez-vous vraiment supprimer TOUTES les données du fichier "${filename}" ?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/files?filename=${encodeURIComponent(filename)}`, { 
            method: 'DELETE' 
        });
        
        const data = await res.json();
        
        if (res.ok) {
            loadFiles();
            alert(data.message);
            if (document.getElementById('s_filename').value === filename) {
                clearSearch();
            }
        } else {
            alert("Erreur: " + data.detail);
        }
    } catch (e) {
        alert("Erreur réseau lors de la suppression.");
    }
}

function fillSearchFilename(name) {
    document.getElementById('s_filename').value = name;
}