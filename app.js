import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// --- TUTAJ WKLEISZ SWOJĄ KONFIGURACJĘ FIREBASE (Z ETAPU 2) ---
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

function generateColor(userId, threadId) {
    const str = userId + threadId;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        value = Math.min(255, value + 80); 
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

const loginScreen = document.getElementById('login-screen');
const threadsScreen = document.getElementById('threads-screen');
const chatScreen = document.getElementById('chat-screen');
const threadsList = document.getElementById('threads-list');
const postsList = document.getElementById('posts-list');
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

// Tworzenie watku
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
});

// Ladowanie watkow
function loadThreads() {
    const q = query(collection(db, "threads"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        threadsList.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'thread-item';
            div.innerHTML = `<h3>${data.title}</h3><p>${data.description}</p>`;
            div.onclick = () => openThread(doc.id, data.title, data.description);
            threadsList.appendChild(div);
        });
    });
}

// Otwieranie watku
function openThread(threadId, title, desc) {
    currentThreadId = threadId;
    threadsScreen.style.display = 'none';
    chatScreen.style.display = 'block';
    document.getElementById('current-thread-title').innerText = title;
    document.getElementById('current-thread-desc').innerText = desc;
    
    const myColorInThisThread = generateColor(myUserId, currentThreadId);
    document.getElementById('new-post-content').style.borderColor = myColorInThisThread;
    document.getElementById('new-post-content').placeholder = `Twoj kolor w tym watku to ${myColorInThisThread}`;

    const q = query(collection(db, `threads/${threadId}/posts`), orderBy("createdAt", "asc"));
    
    if (unsubscribePosts) unsubscribePosts(); 
    
    unsubscribePosts = onSnapshot(q, (snapshot) => {
        postsList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'post-item';
            div.style.borderColor = data.color;
            // Delikatne podswietlenie tla postu w kolorze usera
            div.style.backgroundColor = data.color + '20'; 
            
            // Logika lajkow
            const likesArray = data.likes || [];
            const hasLiked = likesArray.includes(myUserId);
            const likesCount = likesArray.length;

            div.innerHTML = `
                <div><span style="color:${data.color}; font-size:1.5em; text-shadow: 1px 1px 0px #000;">☻</span> ${data.text}</div>
                <div class="post-footer">
                    <button class="like-btn ${hasLiked ? 'liked' : ''}" data-id="${docSnap.id}" data-liked="${hasLiked}">
                        🔥 ${likesCount}
                    </button>
                </div>
            `;
            postsList.appendChild(div);
        });
        
        // Podpiecie eventow pod przyciski lajkow
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.onclick = async () => {
                const postId = btn.getAttribute('data-id');
                const isLiked = btn.getAttribute('data-liked') === 'true';
                const postRef = doc(db, `threads/${currentThreadId}/posts`, postId);
                
                if (isLiked) {
                    await updateDoc(postRef, { likes: arrayRemove(myUserId) });
                } else {
                    await updateDoc(postRef, { likes: arrayUnion(myUserId) });
                }
            };
        });

        postsList.scrollTop = postsList.scrollHeight; 
    });
}

// Powrot do listy
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

    await addDoc(collection(db, `threads/${currentThreadId}/posts`), {
        text: text,
        color: myColorInThisThread,
        likes: [], // Pusta tablica na start
        createdAt: serverTimestamp()
    });
    document.getElementById('new-post-content').value = '';
});