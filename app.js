
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABtkPUzR9q6RG0nqONAKFb4ECxDRjAqyI",
  authDomain: "masuj-x-db.firebaseapp.com",
  projectId: "masuj-x-db",
  storageBucket: "masuj-x-db.firebasestorage.app",
  messagingSenderId: "790553642823",
  appId: "1:790553642823:web:e7e70e0512f08fbe372e62",
  measurementId: "G-X4X10D5FGS"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const GLOBAL_PASSWORD = "masuj"; 

let myUserId = localStorage.getItem('masuj_x_user_id');
if (!myUserId) {
    myUserId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('masuj_x_user_id', myUserId);
}

// Magiczna funkcja zamieniająca HSL na piękny kod HEX
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function generateColor(userId, threadId) {
    const str = userId + threadId;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360; 
    return hslToHex(h, 85, 65); // Generuje idealny HEX dla ciemnego motywu
}

const loginScreen = document.getElementById('login-screen');
const threadsScreen = document.getElementById('threads-screen');
const chatScreen = document.getElementById('chat-screen');
const threadsList = document.getElementById('threads-list');
const postsList = document.getElementById('posts-list');
const newThreadBox = document.getElementById('new-thread-box');

let currentThreadId = null;
let unsubscribePosts = null;

// Logowanie
document.getElementById('login-btn').addEventListener('click', () => {
    if (document.getElementById('password-input').value === GLOBAL_PASSWORD) {
        loginScreen.style.display = 'none';
        threadsScreen.style.display = 'block';
        loadThreads();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
});

document.getElementById('show-new-thread-btn').addEventListener('click', () => {
    newThreadBox.classList.remove('hidden');
    document.getElementById('show-new-thread-btn').style.display = 'none';
});

document.getElementById('cancel-thread-btn').addEventListener('click', () => {
    newThreadBox.classList.add('hidden');
    document.getElementById('show-new-thread-btn').style.display = 'flex';
});

// Tworzenie wątku
document.getElementById('create-thread-btn').addEventListener('click', async () => {
    const title = document.getElementById('new-thread-title').value;
    const desc = document.getElementById('new-thread-desc').value;
    if (title.trim() === '') return;

    await addDoc(collection(db, "threads"), {
        title: title,
        description: desc,
        createdAt: serverTimestamp()
    });
    
    document.getElementById('new-thread-title').value = '';
    document.getElementById('new-thread-desc').value = '';
    newThreadBox.classList.add('hidden');
    document.getElementById('show-new-thread-btn').style.display = 'flex';
});

// Ładowanie wątków
function loadThreads() {
    const q = query(collection(db, "threads"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        threadsList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'thread-item fade-in';
            div.innerHTML = `<h3 class="dosis-text">${data.title}</h3><p class="dosis-text">${data.description}</p>`;
            div.onclick = () => openThread(docSnap.id, data.title, data.description);
            threadsList.appendChild(div);
        });
    });
}

// Otwieranie wątku i czatu
function openThread(threadId, title, desc) {
    currentThreadId = threadId;
    threadsScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    document.getElementById('current-thread-title').innerText = title;
    document.getElementById('current-thread-desc').innerText = desc;
    
    const q = query(collection(db, "threads", threadId, "posts"), orderBy("createdAt", "asc"));
    
    if (unsubscribePosts) unsubscribePosts(); 
    
    unsubscribePosts = onSnapshot(q, (snapshot) => {
        postsList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'post-item';
            
            div.style.borderLeft = `4px solid ${data.color}`;
            div.style.boxShadow = `-4px 0px 18px -5px ${data.color}, 0 8px 24px rgba(0,0,0,0.4)`;
            
            const likesArray = data.likes || [];
            const hasLiked = likesArray.includes(myUserId);
            const likesCount = likesArray.length;

            div.innerHTML = `
                <!-- Identyfikator koloru wyświetlany jako kod HEX -->
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${data.color}; box-shadow: 0 0 10px ${data.color};"></div>
                    <span class="dosis-text" style="font-size: 0.95rem; color: ${data.color}; font-weight: 700; letter-spacing: 1px;">${data.color}</span>
                </div>
                
                <div class="post-content dosis-text">${data.text}</div>
                
                <button class="like-btn ${hasLiked ? 'liked' : ''}">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span>${likesCount}</span>
                </button>
            `;
            
            const likeBtn = div.querySelector('.like-btn');
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const postRef = doc(db, "threads", currentThreadId, "posts", docSnap.id);
                
                try {
                    if (hasLiked) {
                        await updateDoc(postRef, { likes: arrayRemove(myUserId) });
                    } else {
                        await updateDoc(postRef, { likes: arrayUnion(myUserId) });
                    }
                } catch (error) {
                    console.error("Błąd lajkowania:", error);
                }
            });

            postsList.appendChild(div);
        });
        
        postsList.scrollTop = postsList.scrollHeight; 
    });
}

// Powrót do listy
document.getElementById('back-btn').addEventListener('click', () => {
    chatScreen.style.display = 'none';
    threadsScreen.style.display = 'block';
    if (unsubscribePosts) unsubscribePosts();
    currentThreadId = null;
});

// Dodawanie posta
document.getElementById('send-post-btn').addEventListener('click', async () => {
    const text = document.getElementById('new-post-content').value;
    if (text.trim() === '' || !currentThreadId) return;

    const myColorInThisThread = generateColor(myUserId, currentThreadId);
    
    const input = document.getElementById('new-post-content');
    input.value = ''; 
    
    await addDoc(collection(db, "threads", currentThreadId, "posts"), {
        text: text,
        color: myColorInThisThread,
        likes: [], 
        createdAt: serverTimestamp()
    });
});