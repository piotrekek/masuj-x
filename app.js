import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// --- WKLEJ TUTAJ SWOJĄ KONFIGURACJĘ FIREBASE ---

// --- WKLEJ TUTAJ SWOJĄ KONFIGURACJĘ FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyABtkPUzR9q6RG0nqONAKFb4ECxDRjAqyI",
  authDomain: "masuj-x-db.firebaseapp.com",
  projectId: "masuj-x-db",
  storageBucket: "masuj-x-db.firebasestorage.app",
  messagingSenderId: "790553642823",
  appId: "1:790553642823:web:e7e70e0512f08fbe372e62",
  measurementId: "G-X4X10D5FGS"
};
// ------------------------------------------------


// ------------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const GLOBAL_PASSWORD = "masuj"; 
const ADMIN_PASSWORD = "889c";
let isAdmin = false;

let firstVisit = localStorage.getItem('masuj_x_first_visit');
if (!firstVisit) {
    firstVisit = Date.now();
    localStorage.setItem('masuj_x_first_visit', firstVisit);
}

let readTimestamps = JSON.parse(localStorage.getItem('masuj_x_read_timestamps')) || {};
let myUserId = localStorage.getItem('masuj_x_user_id');
if (!myUserId) {
    myUserId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('masuj_x_user_id', myUserId);
}
const myUserAgent = navigator.userAgent;

// --- ULEPSZONY SYSTEM KOLORÓW (Bardziej różnorodne odcienie) ---
function hslToHex(h, s, l) {
    l /= 100; const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function generateColor(userId, threadId) {
    const str = userId + threadId;
    let hash = 0x811c9dc5; 
    for (let i = 0; i < str.length; i++) { 
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0; 
    }
    const h = hash % 360;
    const s = 65 + ((hash >> 8) % 30);  // Nasycenie 65-95%
    const l = 55 + ((hash >> 16) % 20); // Jasność 55-75%
    return hslToHex(h, s, l); 
}

function formatTime(timestamp) {
    if (!timestamp) return 'Przed chwilą';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.toMillis ? timestamp.toMillis() : timestamp);
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) + ', ' + date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}
// -----------------------------------------------------------------

const loginScreen = document.getElementById('login-screen');
const threadsScreen = document.getElementById('threads-screen');
const chatScreen = document.getElementById('chat-screen');
const threadsList = document.getElementById('threads-list');
const postsList = document.getElementById('posts-list');
const newThreadBox = document.getElementById('new-thread-box');

let currentThreadId = null;
let unsubscribePosts = null;
let unsubscribeThreads = null;
let unsubscribeTyping = null;
let presenceInterval = null;
let unsubscribePresence = null;

function closeReactionMenu() {
    const oldMenu = document.querySelector('.reaction-menu');
    if(oldMenu) {
        const parent = oldMenu.closest('.thread-item') || oldMenu.closest('.post-item');
        if (parent) parent.style.zIndex = '1';
        oldMenu.remove();
    }
}

function generateReactionsHTML(reactionsObj, docId) {
    const emojiList = ['❤️', '👍', '😂', '👎', '❓'];
    let html = `<div class="reactions-container">`;
    emojiList.forEach(emoji => {
        const users = reactionsObj[emoji] || [];
        if (users.length > 0) {
            const active = users.includes(myUserId) ? 'active' : '';
            html += `<div class="reaction-badge ${active}" data-id="${docId}" data-emo="${emoji}">${emoji} ${users.length}</div>`;
        }
    });
    html += `<button class="react-add-btn" data-id="${docId}">+</button></div>`;
    return html;
}

function parseLinks(text) {
    const ytMatch = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (ytMatch) {
        const cleanText = text.replace(ytMatch[0], '');
        return cleanText + `<iframe width="100%" height="200" style="border-radius:12px; margin-top:10px; border:none;" src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen></iframe>`;
    }
    return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
}

function renderPostHTML(data, docId) {
    let contentHTML = '';
    
    if (data.type === 'poll') {
        contentHTML = `<div class="poll-container dosis-text"><div class="poll-question">${data.poll.question}</div>`;
        let totalVotes = 0;
        data.poll.options.forEach(opt => totalVotes += (opt.votes ? opt.votes.length : 0));
        data.poll.options.forEach((opt, index) => {
            const votes = opt.votes ? opt.votes.length : 0;
            const percent = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
            const hasVoted = opt.votes && opt.votes.includes(myUserId);
            contentHTML += `
            <div class="poll-option ${hasVoted ? 'voted' : ''}" data-post="${docId}" data-opt="${index}">
                <div class="poll-bar" style="width: ${percent}%; background: ${hasVoted ? data.color : 'rgba(255,159,10,0.15)'}"></div>
                <div class="poll-text"><span>${opt.text}</span><span>${votes} (${percent}%)</span></div>
            </div>`;
        });
        contentHTML += `</div>`;
    } 
    else if (data.type === 'image') {
        contentHTML = `
            <div class="img-wrapper">
                <img src="${data.imageUrl}" alt="Ukryte zdjęcie">
                <div class="img-overlay dosis-text">
                    <span style="font-size: 2rem; margin-bottom: 5px;">👁️</span>
                    <span>Kliknij, by odkryć</span>
                </div>
            </div>
        `;
    }
    else {
        contentHTML = `<div class="post-content dosis-text">${parseLinks(data.text)}</div>`;
    }

    let adminHTML = '';
    if (isAdmin) {
        let uAgent = data.userAgent ? `📱 ${data.userAgent}` : 'Brak danych';
        adminHTML = `
            <div class="admin-controls">
                <div class="admin-badge">${uAgent}</div>
                <button class="admin-delete-btn" data-type="post" data-id="${docId}">🗑️ Usuń</button>
            </div>
        `;
    }

    const timeStr = formatTime(data.createdAt);

    return `
        <div class="post-header-flex">
            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${data.color}; box-shadow: 0 0 10px ${data.color};"></div>
            <span class="dosis-text" style="font-size: 0.95rem; color: ${data.color}; font-weight: 700; letter-spacing: 1px;">${data.color}</span>
            <span class="timestamp dosis-text">${timeStr}</span>
        </div>
        ${contentHTML}
        ${generateReactionsHTML(data.reactions || {}, docId)}
        ${adminHTML}
    `;
}

document.getElementById('login-btn').addEventListener('click', () => {
    const pw = document.getElementById('password-input').value;
    if (pw === GLOBAL_PASSWORD || pw === ADMIN_PASSWORD) {
        if (pw === ADMIN_PASSWORD) isAdmin = true;
        loginScreen.style.display = 'none';
        threadsScreen.style.display = 'flex';
        loadThreads();
    } else { document.getElementById('login-error').style.display = 'block'; }
});

document.getElementById('show-new-thread-btn').addEventListener('click', () => {
    newThreadBox.classList.remove('hidden'); document.getElementById('show-new-thread-btn').style.display = 'none';
});
document.getElementById('cancel-thread-btn').addEventListener('click', () => {
    newThreadBox.classList.add('hidden'); document.getElementById('show-new-thread-btn').style.display = 'flex';
});

document.getElementById('create-thread-btn').addEventListener('click', async () => {
    const title = document.getElementById('new-thread-title').value;
    const desc = document.getElementById('new-thread-desc').value;
    if (title.trim() === '') return;

    await addDoc(collection(db, "threads"), {
        title, description: desc, 
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), 
        userAgent: myUserAgent, reactions: {}
    });
    document.getElementById('new-thread-title').value = '';
    document.getElementById('new-thread-desc').value = '';
    newThreadBox.classList.add('hidden');
    document.getElementById('show-new-thread-btn').style.display = 'flex';
});

function loadThreads() {
    const q = query(collection(db, "threads"), orderBy("updatedAt", "desc"));
    if(unsubscribeThreads) unsubscribeThreads();
    
    unsubscribeThreads = onSnapshot(q, (snapshot) => {
        threadsList.innerHTML = '';
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            const div = document.createElement('div');
            
            let isUnread = false;
            let threadTime = 0;
            if (data.updatedAt && data.updatedAt.toMillis) threadTime = data.updatedAt.toMillis();
            else if (data.createdAt && data.createdAt.toMillis) threadTime = data.createdAt.toMillis();
            else threadTime = Date.now(); 

            const lastRead = readTimestamps[docId] || 0;
            if (threadTime > lastRead && threadTime > firstVisit) { isUnread = true; }
            
            div.className = `thread-item fade-in ${isUnread ? 'unread-highlight' : ''}`;
            div.id = `thread-${docId}`;
            
            div.addEventListener('click', (e) => {
                if (e.target.closest('.reaction-badge') || e.target.closest('.react-add-btn') || e.target.closest('.reaction-menu') || e.target.closest('.admin-delete-btn')) return;
                
                readTimestamps[docId] = Date.now();
                localStorage.setItem('masuj_x_read_timestamps', JSON.stringify(readTimestamps));
                div.classList.remove('unread-highlight'); 
                
                openThread(docId, data.title, data.description);
            });
            
            let adminHTML = '';
            if (isAdmin) {
                let uAgent = data.userAgent ? `📱 ${data.userAgent}` : 'Brak danych';
                adminHTML = `
                    <div class="admin-controls">
                        <div class="admin-badge">${uAgent}</div>
                        <button class="admin-delete-btn" data-type="thread" data-id="${docId}">🗑️ Usuń Wątek</button>
                    </div>
                `;
            }

            const timeStr = formatTime(data.createdAt);
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h3 class="dosis-text" style="margin-bottom: 0;">${data.title}</h3>
                    <span class="timestamp dosis-text" style="margin-left:10px;">${timeStr}</span>
                </div>
                <div style="margin-top: 12px;">
                    ${generateReactionsHTML(data.reactions || {}, docId)}
                </div>
                ${adminHTML}
            `;
            threadsList.appendChild(div);
        });
    });
}

function openThread(threadId, title, desc) {
    currentThreadId = threadId;
    threadsScreen.style.display = 'none'; chatScreen.style.display = 'flex';
    
    postsList.innerHTML = `
        <div class="inline-header fade-in">
            <h2 class="dosis-text">${title}</h2>
            <div id="live-viewers" class="live-badge dosis-text hidden"></div>
            <p class="dosis-text">${desc}</p>
        </div>
    `; 
    
    const presenceRef = doc(db, `threads/${threadId}/presence`, myUserId);
    setDoc(presenceRef, { time: Date.now() });
    presenceInterval = setInterval(() => { if(currentThreadId === threadId) setDoc(presenceRef, { time: Date.now() }); }, 10000);
    
    if (unsubscribePresence) unsubscribePresence();
    unsubscribePresence = onSnapshot(collection(db, `threads/${threadId}/presence`), (snap) => {
        let count = 0;
        snap.forEach(d => { if(Date.now() - d.data().time < 20000) count++; });
        const viewerBadge = document.getElementById('live-viewers');
        if (count > 0) {
            viewerBadge.classList.remove('hidden');
            viewerBadge.innerHTML = `<div class="live-dot"></div> ${count} ${count === 1 ? 'osoba czyta' : (count < 5 ? 'osoby czytają' : 'osób czyta')}`;
        } else { viewerBadge.classList.add('hidden'); }
    });
    
    if (unsubscribeTyping) unsubscribeTyping();
    unsubscribeTyping = onSnapshot(collection(db, `threads/${threadId}/typing`), (snapshot) => {
        const typingUsers = [];
        snapshot.forEach(d => { if (d.id !== myUserId && Date.now() - d.data().time < 5000) typingUsers.push(d.data().color); });
        const typInd = document.getElementById('typing-indicator');
        if (typingUsers.length > 0) {
            typInd.classList.remove('hidden');
            typInd.innerHTML = `<span class="dosis-text" style="color:${typingUsers[0]};">${typingUsers[0]}</span> <span class="typing-dots dosis-text">pisze</span>`;
        } else { typInd.classList.add('hidden'); }
    });

    const q = query(collection(db, "threads", threadId, "posts"), orderBy("createdAt", "asc"));
    if (unsubscribePosts) unsubscribePosts(); 
    
    unsubscribePosts = onSnapshot(q, (snapshot) => {
        let addedNew = false;
        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const docId = change.doc.id;
            
            if (change.type === "added" || change.type === "modified") {
                if (change.type === "added") addedNew = true;
                
                let div = document.getElementById(`post-${docId}`);
                let wasRevealed = false; // PAMIĘĆ ZDJĘCIA
                
                if (div) {
                    const imgWrap = div.querySelector('.img-wrapper');
                    if (imgWrap && imgWrap.classList.contains('revealed')) wasRevealed = true;
                } else {
                    div = document.createElement('div');
                    div.className = 'post-item'; div.id = `post-${docId}`;
                    postsList.appendChild(div);
                }
                
                div.style.borderLeft = `4px solid ${data.color}`;
                div.style.boxShadow = `-4px 0px 18px -5px ${data.color}, 0 8px 24px rgba(0,0,0,0.4)`;
                div.innerHTML = renderPostHTML(data, docId);
                
                if (wasRevealed) {
                    const newImgWrap = div.querySelector('.img-wrapper');
                    if (newImgWrap) newImgWrap.classList.add('revealed');
                }
            }
            if (change.type === "removed") {
                const div = document.getElementById(`post-${docId}`);
                if (div) div.remove();
            }
        });
        
        readTimestamps[threadId] = Date.now();
        localStorage.setItem('masuj_x_read_timestamps', JSON.stringify(readTimestamps));

        const isAtBottom = postsList.scrollHeight - postsList.scrollTop - postsList.clientHeight < 150;
        if (addedNew && isAtBottom) {
            postsList.scrollTop = postsList.scrollHeight; 
        }
    });
}

document.getElementById('back-btn').addEventListener('click', () => {
    if (currentThreadId) deleteDoc(doc(db, `threads/${currentThreadId}/presence`, myUserId));
    clearInterval(presenceInterval);
    
    chatScreen.style.display = 'none'; threadsScreen.style.display = 'flex';
    if (unsubscribePosts) unsubscribePosts(); 
    if (unsubscribeTyping) unsubscribeTyping();
    if (unsubscribePresence) unsubscribePresence();
    currentThreadId = null;
});

let typingTimeout;
document.getElementById('new-post-content').addEventListener('input', () => {
    if(!currentThreadId) return;
    const color = generateColor(myUserId, currentThreadId);
    setDoc(doc(db, `threads/${currentThreadId}/typing`, myUserId), { color, time: Date.now() });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { deleteDoc(doc(db, `threads/${currentThreadId}/typing`, myUserId)); }, 2000);
});

document.getElementById('toggle-poll-btn').addEventListener('click', () => { document.getElementById('poll-creator').classList.toggle('hidden'); });
document.getElementById('cancel-poll-btn').addEventListener('click', () => { document.getElementById('poll-creator').classList.add('hidden'); });

document.getElementById('trigger-image-btn').addEventListener('click', () => {
    document.getElementById('image-upload').click();
});

document.getElementById('image-upload').addEventListener('change', (e) => {
    if (!currentThreadId) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let width = img.width; let height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6); 

            const color = generateColor(myUserId, currentThreadId);
            await addDoc(collection(db, "threads", currentThreadId, "posts"), {
                type: 'image', imageUrl: dataUrl, color, userAgent: myUserAgent, createdAt: serverTimestamp(), reactions: {}
            });
            await updateDoc(doc(db, "threads", currentThreadId), { updatedAt: serverTimestamp() });
            setTimeout(() => { postsList.scrollTop = postsList.scrollHeight; }, 100);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
});

document.getElementById('send-poll-btn').addEventListener('click', async () => {
    if (!currentThreadId) return;
    const q = document.getElementById('poll-question').value;
    const opts = [];
    [1, 2, 3, 4].forEach(i => {
        const val = document.getElementById(`poll-opt${i}`).value.trim();
        if (val) opts.push({ text: val, votes: [] });
    });
    
    if(q.trim() === '' || opts.length < 2) {
        alert("Podaj pytanie i co najmniej 2 opcje!"); return;
    }
    
    const color = generateColor(myUserId, currentThreadId);
    await addDoc(collection(db, "threads", currentThreadId, "posts"), {
        type: 'poll', color, userAgent: myUserAgent, createdAt: serverTimestamp(), reactions: {},
        poll: { question: q, options: opts }
    });
    
    document.getElementById('poll-question').value = '';
    [1,2,3,4].forEach(i => document.getElementById(`poll-opt${i}`).value = '');
    document.getElementById('poll-creator').classList.add('hidden');

    await updateDoc(doc(db, "threads", currentThreadId), { updatedAt: serverTimestamp() });
    setTimeout(() => { postsList.scrollTop = postsList.scrollHeight; }, 100);
});

document.getElementById('send-post-btn').addEventListener('click', async () => {
    if (!currentThreadId) return;
    const input = document.getElementById('new-post-content');
    if (input.value.trim() === '') return;
    
    const color = generateColor(myUserId, currentThreadId);
    await addDoc(collection(db, "threads", currentThreadId, "posts"), {
        type: 'text', text: input.value, color, userAgent: myUserAgent, createdAt: serverTimestamp(), reactions: {}
    });
    input.value = ''; 

    await updateDoc(doc(db, "threads", currentThreadId), { updatedAt: serverTimestamp() });
    setTimeout(() => { postsList.scrollTop = postsList.scrollHeight; }, 100);
});

document.addEventListener('click', async (e) => {
    // --- AKCJE ADMINA ---
    const deleteBtn = e.target.closest('.admin-delete-btn');
    if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        const type = deleteBtn.getAttribute('data-type');
        if (confirm("Usunąć bezpowrotnie?")) {
            try {
                if (type === 'thread') await deleteDoc(doc(db, "threads", id));
                else if (type === 'post' && currentThreadId) await deleteDoc(doc(db, "threads", currentThreadId, "posts", id));
            } catch(err) { console.error(err); }
        }
        return;
    }

    const imgWrap = e.target.closest('.img-wrapper');
    if (imgWrap) {
        imgWrap.classList.toggle('revealed');
        return;
    }

    const pollOpt = e.target.closest('.poll-option');
    if (pollOpt && currentThreadId) {
        const postId = pollOpt.getAttribute('data-post');
        const optIndex = parseInt(pollOpt.getAttribute('data-opt'));
        const postRef = doc(db, "threads", currentThreadId, "posts", postId);
        
        try {
            const docSnap = await getDoc(postRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const options = data.poll.options;
                const wasVoted = options[optIndex].votes.includes(myUserId);
                
                options.forEach(opt => {
                    const idx = opt.votes.indexOf(myUserId);
                    if (idx > -1) opt.votes.splice(idx, 1);
                });
                if (!wasVoted) options[optIndex].votes.push(myUserId);
                
                await updateDoc(postRef, { "poll.options": options });
            }
        } catch(err) { console.error("Błąd głosowania:", err); }
        return;
    }

    const addBtn = e.target.closest('.react-add-btn');
    if (addBtn) {
        closeReactionMenu(); 

        const id = addBtn.getAttribute('data-id');
        const menu = document.createElement('div');
        menu.className = 'reaction-menu';
        menu.innerHTML = `
            <span data-id="${id}" data-emo="❤️">❤️</span>
            <span data-id="${id}" data-emo="👍">👍</span>
            <span data-id="${id}" data-emo="😂">😂</span>
            <span data-id="${id}" data-emo="👎">👎</span>
            <span data-id="${id}" data-emo="❓">❓</span>
        `;
        
        const parentBox = addBtn.closest('.thread-item') || addBtn.closest('.post-item');
        if (parentBox) parentBox.style.zIndex = '100';
        
        addBtn.parentElement.parentElement.appendChild(menu);
        return; 
    }

    const emoTarget = e.target.closest('.reaction-menu span') || e.target.closest('.reaction-badge');
    if (emoTarget) {
        const id = emoTarget.getAttribute('data-id');
        const emoji = emoTarget.getAttribute('data-emo');
        const isPost = currentThreadId && document.getElementById(`post-${id}`);
        const ref = isPost ? doc(db, "threads", currentThreadId, "posts", id) : doc(db, "threads", id);
        
        const updateField = `reactions.${emoji}`;
        const isBadgeAndActive = emoTarget.classList.contains('active');
        
        try {
            if (isBadgeAndActive) await updateDoc(ref, { [updateField]: arrayRemove(myUserId) });
            else await updateDoc(ref, { [updateField]: arrayUnion(myUserId) });
        } catch(err) { console.error("Error", err); }
        
        closeReactionMenu();
        return;
    }

    if (!e.target.closest('.react-add-btn') && !e.target.closest('.reaction-menu')) {
        closeReactionMenu();
    }
});

window.addEventListener("beforeunload", () => {
    if (currentThreadId) {
        deleteDoc(doc(db, `threads/${currentThreadId}/presence`, myUserId));
    }
});
