const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'secret-key-for-blog',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const files = {
    users: path.join(DATA_DIR, 'users.json'),
    posts: path.join(DATA_DIR, 'posts.json'),
    subscriptions: path.join(DATA_DIR, 'subscriptions.json'),
    comments: path.join(DATA_DIR, 'comments.json')
};

function readData(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return [];
    }
}

function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Инициализация пустых файлов
if (!fs.existsSync(files.users)) writeData(files.users, []);
if (!fs.existsSync(files.posts)) writeData(files.posts, []);
if (!fs.existsSync(files.subscriptions)) writeData(files.subscriptions, []);
if (!fs.existsSync(files.comments)) writeData(files.comments, []);

// ---------- ПОЛЬЗОВАТЕЛИ ----------
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const users = readData(files.users);
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    const newUser = { id: Date.now(), username, password };
    users.push(newUser);
    writeData(files.users, users);
    req.session.userId = newUser.id;
    res.json({ success: true, user: { id: newUser.id, username: newUser.username } });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readData(files.users);
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    res.json({ success: true, user: { id: user.id, username: user.username } });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const users = readData(files.users);
    const user = users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username });
});

app.get('/api/users', (req, res) => {
    const users = readData(files.users);
    res.json(users.map(u => ({ id: u.id, username: u.username })));
});

// ---------- ПОДПИСКИ ----------
app.post('/api/subscribe', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { targetId } = req.body;
    if (req.session.userId === targetId) return res.status(400).json({ error: 'Cannot subscribe to self' });
    const subs = readData(files.subscriptions);
    if (subs.find(s => s.follower === req.session.userId && s.followed === targetId)) {
        return res.status(400).json({ error: 'Already subscribed' });
    }
    subs.push({ follower: req.session.userId, followed: targetId });
    writeData(files.subscriptions, subs);
    res.json({ success: true });
});

app.post('/api/unsubscribe', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { targetId } = req.body;
    let subs = readData(files.subscriptions);
    subs = subs.filter(s => !(s.follower === req.session.userId && s.followed === targetId));
    writeData(files.subscriptions, subs);
    res.json({ success: true });
});

app.get('/api/subscriptions', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const subs = readData(files.subscriptions);
    const following = subs.filter(s => s.follower === req.session.userId).map(s => s.followed);
    res.json(following);
});

// ---------- ПОСТЫ ----------
app.get('/api/posts', (req, res) => {
    const posts = readData(files.posts);
    const users = readData(files.users);
    const comments = readData(files.comments);
    // public posts only (visible to all)
    let publicPosts = posts.filter(p => p.public !== false);
    // if user logged in, also include their own private posts
    if (req.session.userId) {
        const own = posts.filter(p => p.authorId === req.session.userId && p.public === false);
        publicPosts = publicPosts.concat(own);
    }
    // enrich with author name and comments count
    publicPosts = publicPosts.map(p => {
        const author = users.find(u => u.id === p.authorId);
        const postComments = comments.filter(c => c.postId === p.id);
        return { ...p, authorName: author ? author.username : 'Unknown', commentsCount: postComments.length };
    });
    res.json(publicPosts);
});

app.post('/api/posts', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { title, content, tags, isPublic } = req.body;
    const posts = readData(files.posts);
    const newPost = {
        id: Date.now(),
        title,
        content,
        authorId: req.session.userId,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        public: isPublic !== false,
        createdAt: new Date().toISOString()
    };
    posts.push(newPost);
    writeData(files.posts, posts);
    res.json(newPost);
});

app.put('/api/posts/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = parseInt(req.params.id);
    const posts = readData(files.posts);
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Post not found' });
    if (posts[index].authorId !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    const { title, content, tags, isPublic } = req.body;
    posts[index] = { ...posts[index], title, content, tags: tags ? tags.split(',').map(t => t.trim()) : [], public: isPublic !== false };
    writeData(files.posts, posts);
    res.json(posts[index]);
});

app.delete('/api/posts/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = parseInt(req.params.id);
    let posts = readData(files.posts);
    const post = posts.find(p => p.id === id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    posts = posts.filter(p => p.id !== id);
    writeData(files.posts, posts);
    res.json({ success: true });
});

// ---------- КОММЕНТАРИИ ----------
app.get('/api/posts/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id);
    const comments = readData(files.comments);
    const users = readData(files.users);
    const postComments = comments.filter(c => c.postId === postId);
    const enriched = postComments.map(c => {
        const user = users.find(u => u.id === c.authorId);
        return { ...c, authorName: user ? user.username : 'Unknown' };
    });
    res.json(enriched);
});

app.post('/api/comments', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { postId, content } = req.body;
    const comments = readData(files.comments);
    const newComment = {
        id: Date.now(),
        postId: parseInt(postId),
        authorId: req.session.userId,
        content,
        createdAt: new Date().toISOString()
    };
    comments.push(newComment);
    writeData(files.comments, comments);
    res.json(newComment);
});

// ---------- ЛЕНТА ПО ПОДПИСКАМ ----------
app.get('/api/feed', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const subs = readData(files.subscriptions);
    const followedIds = subs.filter(s => s.follower === req.session.userId).map(s => s.followed);
    const posts = readData(files.posts);
    const users = readData(files.users);
    const comments = readData(files.comments);
    // только публичные посты от подписанных авторов + свои посты (все)
    let feed = posts.filter(p => {
        if (p.authorId === req.session.userId) return true;
        if (p.public === false) return false;
        return followedIds.includes(p.authorId);
    });
    feed = feed.map(p => {
        const author = users.find(u => u.id === p.authorId);
        const postComments = comments.filter(c => c.postId === p.id);
        return { ...p, authorName: author ? author.username : 'Unknown', commentsCount: postComments.length };
    });
    // сортировка по дате (новые сверху)
    feed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(feed);
});

// ---------- ПОИСК ПО ТЕГАМ ----------
app.get('/api/posts/tag/:tag', (req, res) => {
    const tag = req.params.tag;
    const posts = readData(files.posts);
    const users = readData(files.users);
    const comments = readData(files.comments);
    let filtered = posts.filter(p => p.tags && p.tags.includes(tag) && (p.public !== false || (req.session.userId && p.authorId === req.session.userId)));
    filtered = filtered.map(p => {
        const author = users.find(u => u.id === p.authorId);
        const postComments = comments.filter(c => c.postId === p.id);
        return { ...p, authorName: author ? author.username : 'Unknown', commentsCount: postComments.length };
    });
    res.json(filtered);
});

app.listen(PORT, () => {
    console.log(`Blog server running on http://localhost:${PORT}`);
});