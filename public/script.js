let currentUser = null;
let currentTab = 'feed';

document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    document.getElementById('loginBtn').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    });
    document.getElementById('registerBtn').addEventListener('click', () => {
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('loginForm').style.display = 'none';
    });
    document.getElementById('loginSubmit').addEventListener('click', login);
    document.getElementById('regSubmit').addEventListener('click', register);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.tab;
            renderTab(currentTab);
        });
    });

    // Comments modal
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('commentsModal').style.display = 'none';
    });
    document.getElementById('commentSubmit').addEventListener('click', submitComment);
});

async function checkSession() {
    const res = await fetch('/api/me');
    if (res.ok) {
        const user = await res.json();
        currentUser = user;
        showMainContent();
    } else {
        showAuthForms();
    }
}

function showAuthForms() {
    document.getElementById('authForms').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('registerBtn').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'none';
}

function showMainContent() {
    document.getElementById('authForms').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('registerBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    renderTab(currentTab);
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        showMainContent();
    } else {
        alert('Ошибка входа');
    }
}

async function register() {
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        showMainContent();
    } else {
        alert('Пользователь уже существует');
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    showAuthForms();
}

async function renderTab(tab) {
    const container = document.getElementById('tabContent');
    switch (tab) {
        case 'feed': await renderFeed(container); break;
        case 'all': await renderAllPosts(container); break;
        case 'my': await renderMyPosts(container); break;
        case 'new': renderNewPost(container); break;
        case 'tags': renderTagSearch(container); break;
        case 'users': await renderUsers(container); break;
        default: container.innerHTML = '';
    }
}

// ---------- ЛЕНТА ----------
async function renderFeed(container) {
    const res = await fetch('/api/feed');
    const posts = await res.json();
    container.innerHTML = `<h2>Лента</h2>`;
    if (posts.length === 0) container.innerHTML += '<p>Нет постов от подписанных авторов</p>';
    else posts.forEach(p => renderPostCard(container, p));
}

// ---------- ВСЕ ПОСТЫ ----------
async function renderAllPosts(container) {
    const res = await fetch('/api/posts');
    const posts = await res.json();
    container.innerHTML = `<h2>Все публичные посты</h2>`;
    posts.forEach(p => renderPostCard(container, p));
}

// ---------- МОИ ПОСТЫ ----------
async function renderMyPosts(container) {
    const res = await fetch('/api/posts');
    const all = await res.json();
    const my = all.filter(p => p.authorId === currentUser.id);
    container.innerHTML = `<h2>Мои посты</h2>`;
    my.forEach(p => renderPostCard(container, p, true));
}

// ---------- СОЗДАТЬ ПОСТ ----------
function renderNewPost(container) {
    container.innerHTML = `
        <h2>Новый пост</h2>
        <form id="newPostForm">
            <label>Заголовок</label>
            <input type="text" id="postTitle" required>
            <label>Содержание</label>
            <textarea id="postContent" rows="5" required></textarea>
            <label>Теги (через запятую)</label>
            <input type="text" id="postTags" placeholder="например: javascript, react">
            <label><input type="checkbox" id="postPublic" checked> Публичный</label>
            <button type="submit">Опубликовать</button>
        </form>
    `;
    document.getElementById('newPostForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const tags = document.getElementById('postTags').value;
        const isPublic = document.getElementById('postPublic').checked;
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, tags, isPublic })
        });
        if (res.ok) {
            renderTab(currentTab);
        }
    });
}

// ---------- ПО ТЕГАМ ----------
function renderTagSearch(container) {
    container.innerHTML = `
        <h2>Поиск по тегам</h2>
        <input type="text" id="tagInput" placeholder="Введите тег">
        <button id="tagSearchBtn">Найти</button>
        <div id="tagResults"></div>
    `;
    document.getElementById('tagSearchBtn').addEventListener('click', async () => {
        const tag = document.getElementById('tagInput').value.trim();
        if (!tag) return;
        const res = await fetch(`/api/posts/tag/${encodeURIComponent(tag)}`);
        const posts = await res.json();
        const results = document.getElementById('tagResults');
        results.innerHTML = '';
        posts.forEach(p => renderPostCard(results, p));
    });
}

// ---------- ПОЛЬЗОВАТЕЛИ ----------
async function renderUsers(container) {
    const res = await fetch('/api/users');
    const users = await res.json();
    const subsRes = await fetch('/api/subscriptions');
    const following = subsRes.ok ? await subsRes.json() : [];
    container.innerHTML = `<h2>Пользователи</h2>`;
    users.forEach(u => {
        if (u.id === currentUser.id) return;
        const isSub = following.includes(u.id);
        const div = document.createElement('div');
        div.className = 'post-card';
        div.innerHTML = `
            <p><strong>${u.username}</strong></p>
            <button class="${isSub ? 'unsubscribe' : 'subscribe'}" data-id="${u.id}">
                ${isSub ? 'Отписаться' : 'Подписаться'}
            </button>
        `;
        container.appendChild(div);
        const btn = div.querySelector('button');
        btn.addEventListener('click', async () => {
            const url = isSub ? '/api/unsubscribe' : '/api/subscribe';
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetId: u.id })
            });
            renderUsers(container);
        });
    });
}

// ---------- КАРТОЧКА ПОСТА ----------
function renderPostCard(container, post, isOwner = false) {
    const div = document.createElement('div');
    div.className = 'post-card';
    div.innerHTML = `
        <h3>${post.title}</h3>
        <div class="meta">Автор: ${post.authorName} | ${new Date(post.createdAt).toLocaleString()}</div>
        <p>${post.content}</p>
        <div class="tags">${post.tags ? post.tags.map(t => `<span>${t}</span>`).join('') : ''}</div>
        <div class="actions">
            <button class="comment" data-id="${post.id}">💬 Комментарии (${post.commentsCount || 0})</button>
            ${isOwner ? `
                <button class="edit" data-id="${post.id}">✏️ Редактировать</button>
                <button class="delete" data-id="${post.id}">🗑️ Удалить</button>
            ` : ''}
        </div>
    `;
    container.appendChild(div);

    // Комментарии
    div.querySelector('.comment').addEventListener('click', () => openComments(post.id));

    // Редактирование
    if (isOwner) {
        const editBtn = div.querySelector('.edit');
        if (editBtn) {
            editBtn.addEventListener('click', () => editPost(post.id));
        }
        const delBtn = div.querySelector('.delete');
        if (delBtn) {
            delBtn.addEventListener('click', async () => {
                if (confirm('Удалить пост?')) {
                    await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
                    renderTab(currentTab);
                }
            });
        }
    }
}

// ---------- КОММЕНТАРИИ ----------
let currentPostId = null;

async function openComments(postId) {
    currentPostId = postId;
    const modal = document.getElementById('commentsModal');
    modal.style.display = 'flex';
    const list = document.getElementById('commentsList');
    const res = await fetch(`/api/posts/${postId}/comments`);
    const comments = await res.json();
    list.innerHTML = comments.map(c => `
        <div class="comment-item">
            <strong>${c.authorName}</strong> (${new Date(c.createdAt).toLocaleString()})<br>
            ${c.content}
        </div>
    `).join('');
    document.getElementById('commentInput').value = '';
}

async function submitComment() {
    const content = document.getElementById('commentInput').value.trim();
    if (!content || !currentPostId) return;
    await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: currentPostId, content })
    });
    openComments(currentPostId);
    // Обновить счетчик комментариев (перерисовать таб)
    renderTab(currentTab);
}

// ---------- РЕДАКТИРОВАНИЕ ПОСТА ----------
function editPost(postId) {
    // Простое редактирование: переходим на вкладку "Мои посты" и предлагаем изменить
    // Для простоты переключим на вкладку new и заполним данными
    // Найдем пост
    fetch('/api/posts')
        .then(res => res.json())
        .then(posts => {
            const post = posts.find(p => p.id === postId);
            if (!post) return;
            // Переключаем вкладку на new
            document.querySelector('.tab[data-tab="new"]').click();
            // Заполняем форму
            document.getElementById('postTitle').value = post.title;
            document.getElementById('postContent').value = post.content;
            document.getElementById('postTags').value = post.tags ? post.tags.join(', ') : '';
            document.getElementById('postPublic').checked = post.public !== false;
            // Изменяем обработчик на обновление
            const form = document.getElementById('newPostForm');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const title = document.getElementById('postTitle').value;
                const content = document.getElementById('postContent').value;
                const tags = document.getElementById('postTags').value;
                const isPublic = document.getElementById('postPublic').checked;
                await fetch(`/api/posts/${postId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, tags, isPublic })
                });
                renderTab('my');
                // Восстановить обработчик
                form.onsubmit = null;
                document.getElementById('newPostForm').onsubmit = async (e) => {
                    e.preventDefault();
                    const title = document.getElementById('postTitle').value;
                    const content = document.getElementById('postContent').value;
                    const tags = document.getElementById('postTags').value;
                    const isPublic = document.getElementById('postPublic').checked;
                    await fetch('/api/posts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, content, tags, isPublic })
                    });
                    renderTab(currentTab);
                };
            };
        });
}