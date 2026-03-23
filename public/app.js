// ════════════════════════════════════════════════
// PM JURIDIK — app.js (Complete Application Logic)
// Firebase + Gemini Pro + All UI Functions
// ════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, getDoc, query, where, doc, updateDoc, deleteDoc, orderBy, serverTimestamp, limit } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';

// ── Firebase Config ──
const firebaseConfig = {
  apiKey: "AIzaSyDJ7G8_f3kIRmZ0X0i4B0_3IwcBCmtIhZE",
  authDomain: "pm-juridik-applex.firebaseapp.com",
  projectId: "pm-juridik-applex",
  storageBucket: "pm-juridik-applex.firebasestorage.app",
  messagingSenderId: "361480860589",
  appId: "1:361480860589:web:d6f9f3d679167a545aa724d"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const storage = getStorage(fbApp);
const ADMIN_EMAIL = "patrick@mellberg.online";

// ── State ──
let currentUser = null;
let selectedCaseId = null;
let selectedCaseData = null;
let geminiApiKey = null;
let bureauSettings = {};
let isRecording = false;
let isPaused = false;
let recognition = null;
let recInterval = null;
let recSeconds = 0;
let fullTranscript = '';
let cameraStream = null;

// ════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════

function toast(msg, type = 'ok', duration = 3500) {
  const container = document.getElementById('toasts');
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  d.textContent = msg;
  container.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 300); }, duration);
}

function loader(show) {
  const el = document.getElementById('loader');
  if (show) { el.classList.remove('hide'); el.style.display = 'flex'; }
  else { el.classList.add('hide'); setTimeout(() => el.style.display = 'none', 500); }
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
window.openModal = openModal;
window.closeModal = closeModal;

function formatDate(d) {
  if (!d) return '';
  const date = d.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString('sv-SE');
}

function formatDateTime(d) {
  if (!d) return '';
  const date = d.toDate ? d.toDate() : new Date(d);
  return date.toLocaleString('sv-SE');
}

function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const map = { pdf: '📕', docx: '📘', doc: '📘', txt: '📝', jpg: '🖼️', jpeg: '🖼️', png: '🖼️' };
  return map[ext] || '📄';
}

function typeLabel(type) {
  const map = { civil: 'Civilmål', criminal: 'Brottmål', administrative: 'Förvaltningsmål', labor: 'Arbetsrättsmål', family: 'Familjemål', other: 'Övrigt' };
  return map[type] || type;
}

// ════════════════════════════════════
// AUTH
// ════════════════════════════════════

document.getElementById('loginBtn').addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
    toast('Inloggad!');
  } catch (e) {
    console.error('Login error:', e);
    toast('Inloggning misslyckades: ' + e.message, 'err');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await signOut(auth); toast('Utloggad'); }
  catch (e) { toast('Fel vid utloggning', 'err'); }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('shell').style.display = 'block';
    document.getElementById('uName').textContent = user.displayName || user.email;
    document.getElementById('avInit').textContent = (user.displayName || user.email || 'U').substring(0, 2).toUpperCase();
    if (user.email === ADMIN_EMAIL) {
      document.getElementById('adminTag').style.display = 'inline';
    }
    try {
      await loadBureauSettings();
      await loadCases();
      await loadReminders();
      updateStats();
    } catch (e) { console.error('Load error:', e); }
    loader(false);
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('shell').style.display = 'none';
    loader(false);
  }
});

// ════════════════════════════════════
// TAB NAVIGATION
// ════════════════════════════════════

window.showTab = function(tabName, btn) {
  document.querySelectorAll('.tpane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById('pane-' + tabName);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');
};

// ════════════════════════════════════
// BUREAU SETTINGS
// ════════════════════════════════════

async function loadBureauSettings() {
  if (!currentUser) return;
  try {
    const q = query(collection(db, 'bureauSettings'), where('userId', '==', currentUser.uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      bureauSettings = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (bureauSettings.bureauName) {
        document.getElementById('hdrTitle').textContent = bureauSettings.bureauName;
        document.getElementById('bureauNameInput').value = bureauSettings.bureauName;
      }
      if (bureauSettings.email) document.getElementById('bureauEmailInput').value = bureauSettings.email;
      if (bureauSettings.phone) document.getElementById('bureauPhoneInput').value = bureauSettings.phone;
      if (bureauSettings.address) document.getElementById('bureauAddressInput').value = bureauSettings.address;
      if (bureauSettings.orgNr) document.getElementById('bureauOrgInput').value = bureauSettings.orgNr;
      if (bureauSettings.geminiKey) {
        geminiApiKey = bureauSettings.geminiKey;
        document.getElementById('geminiKeyInput').value = bureauSettings.geminiKey;
        if (document.getElementById('settingsGeminiKey')) {
          document.getElementById('settingsGeminiKey').value = bureauSettings.geminiKey;
        }
      }
      if (bureauSettings.logoUrl) {
        const hdrLogo = document.getElementById('hdrLogo');
        hdrLogo.src = bureauSettings.logoUrl;
        hdrLogo.style.display = 'block';
        const preview = document.getElementById('logoPreview');
        if (preview) { preview.src = bureauSettings.logoUrl; preview.style.display = 'block'; }
        document.getElementById('logoDropText').textContent = '✅ Logo uppladdad – klicka för att byta';
        // Update template logos
        document.querySelectorAll('.tpl-logo').forEach(img => {
          img.src = bureauSettings.logoUrl;
          img.style.display = 'block';
        });
      }
      if (document.getElementById('settingsBureauName')) {
        document.getElementById('settingsBureauName').value = bureauSettings.bureauName || '';
      }
    }
  } catch (e) { console.error('Bureau settings load error:', e); }
}

window.saveBureauSettings = async function() {
  if (!currentUser) return;
  const data = {
    userId: currentUser.uid,
    bureauName: document.getElementById('bureauNameInput').value,
    email: document.getElementById('bureauEmailInput').value,
    phone: document.getElementById('bureauPhoneInput').value,
    address: document.getElementById('bureauAddressInput').value,
    orgNr: document.getElementById('bureauOrgInput').value,
    updatedAt: serverTimestamp()
  };
  try {
    if (bureauSettings.id) {
      await updateDoc(doc(db, 'bureauSettings', bureauSettings.id), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'bureauSettings'), data);
    }
    toast('Byråinställningar sparade');
    await loadBureauSettings();
  } catch (e) { toast('Fel vid sparande', 'err'); console.error(e); }
};

window.saveGeminiKey = async function() {
  if (!currentUser) return;
  const key = document.getElementById('geminiKeyInput').value.trim();
  if (!key) { toast('Ange en API-nyckel', 'warn'); return; }
  try {
    if (bureauSettings.id) {
      await updateDoc(doc(db, 'bureauSettings', bureauSettings.id), { geminiKey: key, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'bureauSettings'), {
        userId: currentUser.uid,
        geminiKey: key,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    geminiApiKey = key;
    toast('API-nyckel sparad');
    await loadBureauSettings();
  } catch (e) { toast('Fel vid sparande av nyckel', 'err'); console.error(e); }
};

window.uploadLogo = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Välj en bildfil', 'warn'); return; }
  try {
    toast('Laddar upp logo...');
    const storageRef = sRef(storage, `logos/${currentUser.uid}/${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    if (bureauSettings.id) {
      await updateDoc(doc(db, 'bureauSettings', bureauSettings.id), { logoUrl: url, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'bureauSettings'), {
        userId: currentUser.uid,
        logoUrl: url,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    toast('Logo uppladdad');
    await loadBureauSettings();
  } catch (e) { toast('Fel vid uppladdning', 'err'); console.error(e); }
};

window.saveSettings = async function() {
  if (!currentUser) return;
  const name = document.getElementById('settingsBureauName').value;
  const key = document.getElementById('settingsGeminiKey').value;
  const data = { userId: currentUser.uid, bureauName: name, geminiKey: key, updatedAt: serverTimestamp() };
  try {
    if (bureauSettings.id) {
      await updateDoc(doc(db, 'bureauSettings', bureauSettings.id), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'bureauSettings'), data);
    }
    if (key) geminiApiKey = key;
    toast('Inställningar sparade');
    closeModal('settingsModal');
    await loadBureauSettings();
  } catch (e) { toast('Fel vid sparande', 'err'); console.error(e); }
};

// ════════════════════════════════════
// CASE MANAGEMENT
// ════════════════════════════════════

let casesCache = [];

async function loadCases() {
  if (!currentUser) return;
  try {
    const q = query(collection(db, 'cases'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    casesCache = [];
    const list = document.getElementById('caseList');
    list.innerHTML = '';

    if (snap.empty) {
      list.innerHTML = '<div class="empty"><div class="eico">📁</div><p>Inga fall ännu</p></div>';
      return;
    }

    snap.forEach(d => {
      const c = { id: d.id, ...d.data() };
      casesCache.push(c);
      const div = document.createElement('div');
      div.className = 'ci' + (selectedCaseId === d.id ? ' active' : '');
      div.onclick = () => selectCase(d.id);
      const statusClass = (c.status || 'open');
      div.innerHTML = `
        <div class="ci-name">${c.title || 'Namnlöst fall'}</div>
        <div class="ci-meta">${c.court || ''} ${c.ref ? '• ' + c.ref : ''}</div>
        <span class="ci-tag ${statusClass}">${c.status === 'closed' ? 'Avslutat' : c.status === 'in_progress' ? 'Pågående' : 'Öppet'}</span>
      `;
      list.appendChild(div);
    });

    // Populate reminder case dropdown
    const nrCase = document.getElementById('nr-case');
    if (nrCase) {
      nrCase.innerHTML = '<option value="">— Inget fall —</option>';
      casesCache.forEach(c => {
        nrCase.innerHTML += `<option value="${c.id}">${c.title}</option>`;
      });
    }
  } catch (e) { console.error('Load cases error:', e); }
}

function selectCase(id) {
  selectedCaseId = id;
  selectedCaseData = casesCache.find(c => c.id === id) || null;

  // Highlight in sidebar
  document.querySelectorAll('.ci').forEach(el => el.classList.remove('active'));
  const items = document.querySelectorAll('.ci');
  const idx = casesCache.findIndex(c => c.id === id);
  if (items[idx]) items[idx].classList.add('active');

  // Update UI
  const label = document.getElementById('activeCaseName');
  if (label && selectedCaseData) {
    label.textContent = selectedCaseData.title || 'Valt fall';
  }
  const aiCase = document.getElementById('aiCaseName');
  if (aiCase && selectedCaseData) {
    aiCase.textContent = selectedCaseData.title || 'Valt fall';
  }

  // Load case documents
  loadDocuments();
  loadTranscripts();
}

window.createCase = async function() {
  if (!currentUser) return;
  const title = document.getElementById('nc-title').value.trim();
  if (!title) { toast('Ange ett fallnamn', 'warn'); return; }

  const data = {
    userId: currentUser.uid,
    title,
    type: document.getElementById('nc-type').value,
    court: document.getElementById('nc-court').value.trim(),
    opponent: document.getElementById('nc-party').value.trim(),
    ref: document.getElementById('nc-ref').value.trim(),
    deadline: document.getElementById('nc-deadline').value || null,
    description: document.getElementById('nc-desc').value.trim(),
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, 'cases'), data);
    toast('Fall skapat: ' + title);
    closeModal('newCaseModal');
    // Clear form
    ['nc-title', 'nc-court', 'nc-party', 'nc-ref', 'nc-desc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('nc-deadline').value = '';
    document.getElementById('nc-type').value = 'civil';
    await loadCases();
    selectCase(docRef.id);
    updateStats();
    addActivity('📁 Nytt fall skapat: ' + title);
  } catch (e) { toast('Fel vid skapande av fall', 'err'); console.error(e); }
};

// ════════════════════════════════════
// DOCUMENTS
// ════════════════════════════════════

async function loadDocuments() {
  const grid = document.getElementById('docGrid');
  if (!selectedCaseId) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="eico">📂</div><p>Välj ett fall och ladda upp dokument</p></div>';
    return;
  }

  try {
    const q = query(collection(db, 'documents'), where('caseId', '==', selectedCaseId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    grid.innerHTML = '';

    if (snap.empty) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="eico">📂</div><p>Inga dokument ännu — ladda upp ovan</p></div>';
      return;
    }

    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'dcard';
      div.innerHTML = `
        <div class="dico">${getFileIcon(data.name)}</div>
        <div class="dname">${data.name}</div>
        <div class="dmeta">${formatDate(data.createdAt)}</div>
        <div class="dbtns">
          <button class="dbtn" onclick="window.downloadDoc('${data.url}', '${data.name}')">⬇️</button>
          <button class="dbtn del" onclick="window.deleteDoc('${d.id}', '${data.storagePath || ''}')">🗑️</button>
        </div>
      `;
      grid.appendChild(div);
    });
  } catch (e) { console.error('Load docs error:', e); }
}

// File upload
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

if (dropZone) {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) await uploadFiles(e.dataTransfer.files);
  });
}

if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length) await uploadFiles(e.target.files);
    e.target.value = '';
  });
}

async function uploadFiles(files) {
  if (!selectedCaseId) { toast('Välj ett fall först', 'warn'); return; }
  if (!currentUser) return;

  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) { toast(`${file.name} är för stor (max 25 MB)`, 'warn'); continue; }
    try {
      toast(`Laddar upp ${file.name}...`);
      const storagePath = `documents/${currentUser.uid}/${selectedCaseId}/${Date.now()}_${file.name}`;
      const storageRef = sRef(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'documents'), {
        userId: currentUser.uid,
        caseId: selectedCaseId,
        name: file.name,
        type: file.type,
        size: file.size,
        url,
        storagePath,
        createdAt: serverTimestamp()
      });
      toast(`${file.name} uppladdat`);
      addActivity(`📄 Dokument uppladdat: ${file.name}`);
    } catch (e) { toast(`Fel vid uppladdning av ${file.name}`, 'err'); console.error(e); }
  }
  loadDocuments();
  updateStats();
}

window.downloadDoc = function(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.download = name || 'dokument';
  a.click();
};

window.deleteDoc = async function(docId, storagePath) {
  if (!confirm('Radera detta dokument?')) return;
  try {
    await deleteDoc(doc(db, 'documents', docId));
    if (storagePath) {
      try { await deleteObject(sRef(storage, storagePath)); } catch (e) { /* ignore if file already gone */ }
    }
    toast('Dokument raderat');
    loadDocuments();
    updateStats();
  } catch (e) { toast('Fel vid radering', 'err'); console.error(e); }
};

// ════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════

window.toggleTemplateLogos = function() {
  const show = document.querySelector('.logo-chk')?.checked;
  document.querySelectorAll('.tpl-logo').forEach(img => {
    img.style.display = (show && img.src) ? 'block' : 'none';
  });
};

window.generateTemplate = async function(type) {
  if (!selectedCaseId || !selectedCaseData) {
    toast('Välj ett fall först', 'warn');
    return;
  }

  const templates = {
    stamning: {
      title: 'Stämningsansökan',
      content: `STÄMNINGSANSÖKAN

Till ${selectedCaseData.court || '[Domstol]'}

Kärande: ${selectedCaseData.title || '[Namn]'}
Svarande: ${selectedCaseData.opponent || '[Motpart]'}
Mål nr: ${selectedCaseData.ref || '[Målnummer]'}

YRKANDE
[Belopp/Yrkande]

GRUNDER
[Beskrivning av grunder]

BEVISNING
[Lista bilagor]

Ort och datum: ${new Date().toLocaleDateString('sv-SE')}

___________________________
Ombud / Kärande`
    },
    yttrande: {
      title: 'Yttrande',
      content: `YTTRANDE

Till Domstolen
Mål nr: ${selectedCaseData.ref || '[Målnummer]'}
Datum: ${new Date().toLocaleDateString('sv-SE')}

1. [Punkt 1]
2. [Punkt 2]

YRKANDE
[Yrkande]

___________________________
${bureauSettings.bureauName || 'PM Juridik'}`
    },
    fullmakt: {
      title: 'Fullmakt',
      content: `FULLMAKT

Fullmaktsgivare: [Namn, personnummer]
Fullmaktshavare: [Juristens namn]
Byrå: ${bureauSettings.bureauName || '[Byrånamn]'}

Härmed befullmäktigas ovanstående att företräda mig
i mål nr: ${selectedCaseData.ref || '[Målnummer]'}
vid ${selectedCaseData.court || '[Domstol]'}

Ort och datum: _____________

___________________________
Underskrift`
    },
    kostnad: {
      title: 'Kostnadsräkning',
      content: `KOSTNADSRÄKNING

Mål nr: ${selectedCaseData.ref || '[Målnummer]'}
Domstol: ${selectedCaseData.court || '[Domstol]'}
Ombud: ${bureauSettings.bureauName || '[Byrå]'}

Ombudsarvode:    ___ timmar × ___ kr/timme = ___ kr
Utlägg:          ___ kr
Summa exkl moms: ___ kr
Moms 25%:        ___ kr
TOTALT:          ___ kr

Bankgiro: [Nr]
Org.nr: ${bureauSettings.orgNr || '[Org.nr]'}

Datum: ${new Date().toLocaleDateString('sv-SE')}`
    },
    svar: {
      title: 'Svarsskrivelse',
      content: `SVARSSKRIVELSE

Till: [Motpart/Domstol]
Angående: ${selectedCaseData.title || '[Ärende]'}
Mål nr: ${selectedCaseData.ref || '[Målnummer]'}
Datum: ${new Date().toLocaleDateString('sv-SE')}

Med anledning av er skrivelse daterad [datum] får vi anföra följande:

[Innehåll]

Med vänlig hälsning,
${bureauSettings.bureauName || 'PM Juridik'}
${bureauSettings.address || ''}`
    },
    overklagan: {
      title: 'Överklagan',
      content: `ÖVERKLAGANDE

Till Hovrätten

Klagande: ${selectedCaseData.title || '[Namn]'}
Motpart: ${selectedCaseData.opponent || '[Motpart]'}

Överklagat avgörande: [Dom/Beslut] meddelat av
${selectedCaseData.court || '[Tingsrätt]'} den [datum]
i mål nr ${selectedCaseData.ref || '[Målnummer]'}

YRKANDE
Att hovrätten ändrar [tingsrättens dom/beslut] och [yrkande]

GRUNDER
[Grunder för överklagandet]

Datum: ${new Date().toLocaleDateString('sv-SE')}

___________________________
${bureauSettings.bureauName || 'Ombud'}`
    }
  };

  const tpl = templates[type];
  if (!tpl) { toast('Okänd mall', 'err'); return; }

  // Generate and download as .txt (or use Gemini to enhance if key exists)
  if (geminiApiKey) {
    toast('Genererar mall med AI...');
    try {
      const enhanced = await callGemini(`Du är en svensk jurist. Fyll i denna juridiska mall med relevant information baserat på fallet. Behåll formateringen. Gör texten professionell.\n\nFalldata: ${JSON.stringify(selectedCaseData)}\n\nMall:\n${tpl.content}`);
      downloadTextFile(tpl.title + '.txt', enhanced);
      addActivity(`📄 Mall genererad med AI: ${tpl.title}`);
      return;
    } catch (e) { console.error('Gemini template error:', e); }
  }

  downloadTextFile(tpl.title + '.txt', tpl.content);
  addActivity(`📄 Mall genererad: ${tpl.title}`);
};

function downloadTextFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Dokument laddat ner: ' + name);
}

// ════════════════════════════════════
// REMINDERS
// ════════════════════════════════════

async function loadReminders() {
  if (!currentUser) return;
  try {
    const q = query(collection(db, 'reminders'), where('userId', '==', currentUser.uid), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    const list = document.getElementById('reminderList');
    list.innerHTML = '';

    if (snap.empty) {
      list.innerHTML = '<div class="empty"><div class="eico">🔔</div><p>Inga påminnelser ännu</p></div>';
      return;
    }

    snap.forEach(d => {
      const r = d.data();
      const div = document.createElement('div');
      div.className = 'remcard';
      const prioClass = r.priority || 'medel';
      div.innerHTML = `
        <div class="remico">🔔</div>
        <div class="reminfo">
          <div class="remtitle">${r.title}</div>
          <div class="remdate">${r.date || ''} ${r.caseName ? '• ' + r.caseName : ''}</div>
          ${r.note ? `<div class="remdate">${r.note}</div>` : ''}
          <span class="remtag ${prioClass}">${prioClass === 'hög' ? '🔴 Hög' : prioClass === 'låg' ? '🟢 Låg' : '🟡 Medel'}</span>
        </div>
        <button class="remdel" onclick="window.deleteReminder('${d.id}')">🗑️</button>
      `;
      list.appendChild(div);
    });
  } catch (e) { console.error('Load reminders error:', e); }
}

window.createReminder = async function() {
  if (!currentUser) return;
  const title = document.getElementById('nr-title').value.trim();
  const date = document.getElementById('nr-date').value;
  if (!title || !date) { toast('Ange titel och datum', 'warn'); return; }

  const caseId = document.getElementById('nr-case').value;
  const caseName = caseId ? (casesCache.find(c => c.id === caseId)?.title || '') : '';

  try {
    await addDoc(collection(db, 'reminders'), {
      userId: currentUser.uid,
      title,
      date,
      priority: document.getElementById('nr-prio').value,
      caseId: caseId || null,
      caseName,
      note: document.getElementById('nr-note').value.trim(),
      createdAt: serverTimestamp()
    });
    toast('Påminnelse skapad');
    closeModal('newReminderModal');
    document.getElementById('nr-title').value = '';
    document.getElementById('nr-date').value = '';
    document.getElementById('nr-note').value = '';
    await loadReminders();
    updateStats();
    addActivity('🔔 Påminnelse skapad: ' + title);
  } catch (e) { toast('Fel vid skapande', 'err'); console.error(e); }
};

window.deleteReminder = async function(id) {
  if (!confirm('Radera denna påminnelse?')) return;
  try {
    await deleteDoc(doc(db, 'reminders', id));
    toast('Påminnelse raderad');
    loadReminders();
    updateStats();
  } catch (e) { toast('Fel vid radering', 'err'); console.error(e); }
};

// ════════════════════════════════════
// STATISTICS & ACTIVITY
// ════════════════════════════════════

async function updateStats() {
  if (!currentUser) return;
  try {
    // Cases
    const caseSnap = await getDocs(query(collection(db, 'cases'), where('userId', '==', currentUser.uid)));
    const totalCases = caseSnap.size;
    const activeCases = caseSnap.docs.filter(d => d.data().status !== 'closed').length;

    // Documents
    const docSnap = await getDocs(query(collection(db, 'documents'), where('userId', '==', currentUser.uid)));
    const totalDocs = docSnap.size;

    // Reminders
    const remSnap = await getDocs(query(collection(db, 'reminders'), where('userId', '==', currentUser.uid)));
    const totalRem = remSnap.size;

    // Transcripts
    const transSnap = await getDocs(query(collection(db, 'transcripts'), where('userId', '==', currentUser.uid)));
    const totalTrans = transSnap.size;

    // Update overview stats
    document.getElementById('st-cases').textContent = activeCases;
    document.getElementById('st-docs').textContent = totalDocs;
    document.getElementById('st-rem').textContent = totalRem;
    document.getElementById('st-trans').textContent = totalTrans;

    // Update sidebar stats
    const sbStats = document.getElementById('sbStats');
    if (sbStats) {
      sbStats.innerHTML = `
        📁 Fall: ${totalCases} (${activeCases} aktiva)<br>
        📄 Dokument: ${totalDocs}<br>
        🔔 Påminnelser: ${totalRem}<br>
        🎙️ Transkriptioner: ${totalTrans}
      `;
    }
  } catch (e) { console.error('Stats error:', e); }
}

function addActivity(text) {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  // Remove empty state
  const empty = feed.querySelector('.empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'actitem';
  item.innerHTML = `
    <span class="actico">📌</span>
    <span class="acttext">${text}</span>
    <span class="acttime">${new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
  `;
  feed.prepend(item);
}

// ════════════════════════════════════
// GEMINI AI
// ════════════════════════════════════

async function callGemini(prompt) {
  if (!geminiApiKey) throw new Error('Ingen Gemini API-nyckel konfigurerad');

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Gemini API error: ' + err);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Inget svar från AI';
}

window.sendAI = async function() {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  if (!geminiApiKey) {
    toast('Konfigurera Gemini API-nyckel under Byrå-fliken först', 'warn');
    return;
  }

  const msgContainer = document.getElementById('aiMessages');

  // Add user message
  const userDiv = document.createElement('div');
  userDiv.className = 'msg user';
  userDiv.textContent = msg;
  msgContainer.appendChild(userDiv);

  // Add loading
  const loadDiv = document.createElement('div');
  loadDiv.className = 'msg ai';
  loadDiv.textContent = '⏳ Tänker...';
  msgContainer.appendChild(loadDiv);
  msgContainer.scrollTop = msgContainer.scrollHeight;

  try {
    let context = 'Du är en svensk juridisk AI-assistent för PM Juridik. Svara på svenska. Var professionell och koncis.\n\n';
    if (selectedCaseData) {
      context += `Aktuellt fall: ${selectedCaseData.title}\nTyp: ${typeLabel(selectedCaseData.type)}\nDomstol: ${selectedCaseData.court || 'Ej angiven'}\nMotpart: ${selectedCaseData.opponent || 'Ej angiven'}\nMålnr: ${selectedCaseData.ref || 'Ej angivet'}\nBeskrivning: ${selectedCaseData.description || 'Ingen'}\n\n`;
    }
    context += 'Användarens fråga: ' + msg;

    const response = await callGemini(context);
    loadDiv.textContent = response;
  } catch (e) {
    loadDiv.textContent = '❌ Fel: ' + e.message;
    loadDiv.classList.add('err');
  }
  msgContainer.scrollTop = msgContainer.scrollHeight;
};

window.aiQuick = function(prompt) {
  document.getElementById('aiInput').value = prompt;
  window.sendAI();
};

// ════════════════════════════════════
// RECORDER / DICTAPHONE
// ════════════════════════════════════

window.toggleRecording = function() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
};

function startRecording() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    toast('Din webbläsare stöder inte taligenkänning. Använd Chrome.', 'err');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'sv-SE';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        final += e.results[i][0].transcript + ' ';
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    if (final) fullTranscript += final;
    document.getElementById('liveTranscript').textContent = fullTranscript + (interim ? '...' + interim : '');
  };

  recognition.onerror = (e) => {
    console.error('Recognition error:', e.error);
    if (e.error !== 'no-speech') {
      toast('Inspelningsfel: ' + e.error, 'err');
    }
  };

  recognition.onend = () => {
    if (isRecording && !isPaused) {
      try { recognition.start(); } catch (e) { /* ignore */ }
    }
  };

  recognition.start();
  isRecording = true;
  isPaused = false;
  recSeconds = 0;
  fullTranscript = '';
  document.getElementById('liveTranscript').textContent = 'Lyssnar...';
  document.getElementById('recBtn').classList.add('recording');
  document.getElementById('recStatus').textContent = '🔴 Spelar in...';
  document.getElementById('pauseBtn').style.display = 'inline-flex';
  document.getElementById('recActions').style.display = 'none';

  recInterval = setInterval(() => {
    if (!isPaused) {
      recSeconds++;
      const m = String(Math.floor(recSeconds / 60)).padStart(2, '0');
      const s = String(recSeconds % 60).padStart(2, '0');
      document.getElementById('recTimer').textContent = `${m}:${s}`;
    }
  }, 1000);
}

function stopRecording() {
  isRecording = false;
  isPaused = false;
  if (recognition) { recognition.stop(); recognition = null; }
  if (recInterval) { clearInterval(recInterval); recInterval = null; }
  document.getElementById('recBtn').classList.remove('recording');
  document.getElementById('recStatus').textContent = 'Inspelning klar';
  document.getElementById('pauseBtn').style.display = 'none';
  if (fullTranscript.trim()) {
    document.getElementById('recActions').style.display = 'flex';
  }
}

window.togglePause = function() {
  if (isPaused) {
    isPaused = false;
    if (recognition) try { recognition.start(); } catch (e) { /* ignore */ }
    document.getElementById('recStatus').textContent = '🔴 Spelar in...';
    document.getElementById('pauseBtn').innerHTML = '⏸️';
  } else {
    isPaused = true;
    if (recognition) recognition.stop();
    document.getElementById('recStatus').textContent = '⏸️ Pausad';
    document.getElementById('pauseBtn').innerHTML = '▶️';
  }
};

window.copyTranscript = function() {
  navigator.clipboard.writeText(fullTranscript).then(() => toast('Transkript kopierat'));
};

window.clearRecording = function() {
  fullTranscript = '';
  recSeconds = 0;
  document.getElementById('liveTranscript').textContent = 'Transkribering visas här under inspelning…';
  document.getElementById('recTimer').textContent = '00:00';
  document.getElementById('recActions').style.display = 'none';
  document.getElementById('recStatus').textContent = 'Redo att spela in';
};

window.identifySpeakersUI = async function() {
  if (!fullTranscript.trim()) { toast('Inget transkript att analysera', 'warn'); return; }
  if (!geminiApiKey) { toast('Konfigurera Gemini API-nyckel först', 'warn'); return; }

  toast('Identifierar talare med AI...');
  try {
    const prompt = `Du är en expert på att analysera transkriberade samtal. Analysera detta transkript och identifiera olika talare. Märk varje del med [Talare A], [Talare B] etc. Returnera det formaterade transkriptet med talar-etiketter.\n\nTranskript:\n${fullTranscript}`;
    const result = await callGemini(prompt);
    document.getElementById('liveTranscript').textContent = result;
    fullTranscript = result;
    toast('Talare identifierade');
  } catch (e) { toast('Fel vid talar-identifiering: ' + e.message, 'err'); }
};

window.saveTranscriptToFirestore = async function() {
  if (!currentUser || !fullTranscript.trim()) { toast('Inget att spara', 'warn'); return; }

  try {
    await addDoc(collection(db, 'transcripts'), {
      userId: currentUser.uid,
      caseId: selectedCaseId || null,
      caseName: selectedCaseData?.title || null,
      content: fullTranscript,
      duration: recSeconds,
      createdAt: serverTimestamp()
    });
    toast('Transkript sparat');
    addActivity('🎙️ Transkript sparat' + (selectedCaseData ? ': ' + selectedCaseData.title : ''));
    updateStats();
    loadTranscripts();
  } catch (e) { toast('Fel vid sparande', 'err'); console.error(e); }
};

window.downloadTranscriptDocx = function() {
  if (!fullTranscript.trim()) { toast('Inget att ladda ner', 'warn'); return; }
  const filename = `Transkript_${new Date().toISOString().slice(0, 10)}.txt`;
  downloadTextFile(filename, fullTranscript);
};

async function loadTranscripts() {
  if (!currentUser) return;
  const list = document.getElementById('transcriptList');
  if (!list) return;

  try {
    let q;
    if (selectedCaseId) {
      q = query(collection(db, 'transcripts'), where('caseId', '==', selectedCaseId), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'transcripts'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(10));
    }
    const snap = await getDocs(q);

    if (snap.empty) {
      list.innerHTML = '<div class="empty"><div class="eico">🎙️</div><p>Inga sparade transkriptioner</p></div>';
      return;
    }

    list.innerHTML = '';
    snap.forEach(d => {
      const t = d.data();
      const div = document.createElement('div');
      div.className = 'remcard';
      div.style.cursor = 'pointer';
      const dur = t.duration ? `${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, '0')}` : '';
      div.innerHTML = `
        <div class="remico">🎙️</div>
        <div class="reminfo">
          <div class="remtitle">${t.caseName || 'Utan fall'} ${dur ? '(' + dur + ')' : ''}</div>
          <div class="remdate">${formatDateTime(t.createdAt)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;max-height:40px;overflow:hidden">${(t.content || '').substring(0, 120)}...</div>
        </div>
        <button class="remdel" onclick="event.stopPropagation();window.deleteTranscript('${d.id}')">🗑️</button>
      `;
      div.onclick = () => {
        fullTranscript = t.content || '';
        document.getElementById('liveTranscript').textContent = fullTranscript;
        document.getElementById('recActions').style.display = 'flex';
      };
      list.appendChild(div);
    });
  } catch (e) { console.error('Load transcripts error:', e); }
}

window.deleteTranscript = async function(id) {
  if (!confirm('Radera denna transkription?')) return;
  try {
    await deleteDoc(doc(db, 'transcripts', id));
    toast('Transkription raderad');
    loadTranscripts();
    updateStats();
  } catch (e) { toast('Fel vid radering', 'err'); }
};

// ════════════════════════════════════
// SCANNER / OCR
// ════════════════════════════════════

window.startCamera = async function() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = document.getElementById('camPreview');
    video.srcObject = cameraStream;
    video.style.display = 'block';
    document.getElementById('snapBtn').style.display = 'inline-flex';
    document.getElementById('stopCamBtn').style.display = 'inline-flex';
    document.getElementById('startCamBtn').style.display = 'none';
  } catch (e) {
    toast('Kunde inte starta kameran: ' + e.message, 'err');
    console.error(e);
  }
};

window.takeSnapshot = function() {
  const video = document.getElementById('camPreview');
  const canvas = document.getElementById('snapCanvas');
  if (!video.srcObject) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.style.display = 'block';

  // OCR via Gemini
  performOcr(canvas.toDataURL('image/jpeg', 0.9));
};

window.stopCamera = function() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  document.getElementById('camPreview').style.display = 'none';
  document.getElementById('snapBtn').style.display = 'none';
  document.getElementById('stopCamBtn').style.display = 'none';
  document.getElementById('startCamBtn').style.display = 'inline-flex';
};

window.scanFromFile = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const canvas = document.getElementById('snapCanvas');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.style.display = 'block';
      performOcr(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

async function performOcr(imageDataUrl) {
  const resultBox = document.getElementById('ocrResult');
  resultBox.textContent = '⏳ Extraherar text...';

  if (!geminiApiKey) {
    resultBox.textContent = '⚠️ Konfigurera Gemini API-nyckel under Byrå-fliken för OCR.';
    return;
  }

  try {
    const base64 = imageDataUrl.split(',')[1];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Extrahera ALL text från denna bild. Behåll originalformatering och struktur så gott det går. Svara ENBART med den extraherade texten, inga kommentarer.' },
            { inlineData: { mimeType: 'image/jpeg', data: base64 } }
          ]
        }]
      })
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Ingen text hittades';
    resultBox.textContent = text;
    document.getElementById('scanActions').style.display = 'flex';
  } catch (e) {
    resultBox.textContent = '❌ OCR-fel: ' + e.message;
    console.error(e);
  }
}

window.copyOcr = function() {
  const text = document.getElementById('ocrResult').textContent;
  navigator.clipboard.writeText(text).then(() => toast('Text kopierad'));
};

window.addOcrToCase = async function() {
  if (!selectedCaseId) { toast('Välj ett fall först', 'warn'); return; }
  if (!currentUser) return;

  const text = document.getElementById('ocrResult').textContent;
  if (!text || text.startsWith('⏳') || text.startsWith('⚠️')) { toast('Ingen text att spara', 'warn'); return; }

  try {
    await addDoc(collection(db, 'documents'), {
      userId: currentUser.uid,
      caseId: selectedCaseId,
      name: `Skannad_${new Date().toISOString().slice(0, 10)}.txt`,
      type: 'text/plain',
      content: text,
      source: 'scanner',
      createdAt: serverTimestamp()
    });
    toast('Text tillagd i akten');
    loadDocuments();
    addActivity('📷 Skannat dokument tillagt i akt');
  } catch (e) { toast('Fel vid sparande', 'err'); console.error(e); }
};

window.analyzeOcrWithGemini = async function() {
  if (!geminiApiKey) { toast('Konfigurera Gemini API-nyckel först', 'warn'); return; }
  const text = document.getElementById('ocrResult').textContent;
  if (!text || text.startsWith('⏳')) { toast('Ingen text att analysera', 'warn'); return; }

  toast('Analyserar med AI...');
  try {
    const result = await callGemini(`Du är en svensk jurist. Analysera följande juridiska dokument och ge en sammanfattning, identifiera viktiga punkter, deadlines och eventuella risker.\n\nDokument:\n${text}`);
    document.getElementById('ocrResult').textContent = `ORIGINAL:\n${text}\n\n───── AI-ANALYS ─────\n${result}`;
    toast('Analys klar');
  } catch (e) { toast('Analysfel: ' + e.message, 'err'); }
};

// ════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════

// Show login screen initially
loader(true);
document.getElementById('loginScreen').style.display = 'none';
document.getElementById('shell').style.display = 'none';

console.log('PM Juridik v0.9 Beta loaded');
