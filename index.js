const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session setup
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
  })
);

// MySQL DB 연결
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL');
});

// 홈페이지 요청 처리 (GET /)
app.get('/', (req, res) => {
  // 로그인된 사용자 정보를 ejs 템플릿에 전달하여 렌더링
  res.render('index', { user: req.session.user });
});

// 사용자 등록 페이지 (GET)
app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account.html')); // account.html 경로 지정
});

// 사용자 등록 (POST)
app.post('/account', async (req, res) => {
  const { email, name, username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  // 이메일과 사용자 이름 중복 체크
  db.query(
    'SELECT * FROM users WHERE email = ? OR username = ?',
    [email, username],
    (err, results) => {
      if (err) {
        return res.status(500).send('Database error');
      }

      if (results.length > 0) {
        return res.status(400).send('Email or username already exists');
      }

      // 사용자 등록
      db.query(
        'INSERT INTO users (email, name, username, password) VALUES (?, ?, ?, ?)',
        [email, name, username, hashedPassword],
        (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send('Error creating user');
          }
          res.redirect('/');
        }
      );
    }
  );
});

// 로그인 페이지 (GET)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html')); // index.html 경로 지정
});

// 로그인 (POST)
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) throw err;
    if (results.length > 0 && (await bcrypt.compare(password, results[0].password))) {
      req.session.user = results[0];
      res.redirect('/profile');
    } else {
      res.send('Invalid credentials.');
    }
  });
});

// 프로필 페이지 (GET)
app.get('/profile', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const user = req.session.user;

  db.query('SELECT * FROM posts WHERE author_id = ?', [user.id], (err, posts) => {
    if (err) throw err;
    res.render('profile', { user, posts });
  });
});

// 게시판 페이지 (GET)
app.get('/board', (req, res) => {
  const searchTerm = req.query.search || '';
  db.query(
    'SELECT * FROM posts WHERE title LIKE ? OR content LIKE ?',
    [`%${searchTerm}%`, `%${searchTerm}%`],
    (err, posts) => {
      if (err) throw err;
      res.render('board', { posts });
    }
  );
});

// 게시글 상세 보기 (GET)
app.get('/post/:id', (req, res) => {
  const postId = req.params.id;
  db.query('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) throw err;
    if (post.length > 0) {
      res.render('post', { post: post[0] });
    } else {
      res.send('Post not found.');
    }
  });
});

// 게시글 업로드 (GET)
app.get('/new', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('new-post');
});

// 게시글 업로드 (POST)
app.post('/new', (req, res) => {
  const { title, content } = req.body;
  const authorId = req.session.user.id;
  db.query(
    'INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)',
    [title, content, authorId],
    (err) => {
      if (err) throw err;
      res.redirect('/board');
    }
  );
});

// 게시글 편집 (GET)
app.get('/edit/:id', (req, res) => {
  const postId = req.params.id;
  if (!req.session.user) return res.redirect('/');
  db.query('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) throw err;
    if (post.length > 0) {
      res.render('edit-post', { post: post[0] });
    } else {
      res.send('Post not found.');
    }
  });
});

// 게시글 편집 (POST)
app.post('/edit/:id', (req, res) => {
  const postId = req.params.id;
  const { title, content } = req.body;
  db.query(
    'UPDATE posts SET title = ?, content = ? WHERE id = ?',
    [title, content, postId],
    (err) => {
      if (err) throw err;
      res.redirect('/board');
    }
  );
});

// 게시글 삭제 (POST)
app.post('/delete/:id', (req, res) => {
  const postId = req.params.id;
  db.query('DELETE FROM posts WHERE id = ?', [postId], (err) => {
    if (err) throw err;
    res.redirect('/board');
  });
});

// 로그아웃 기능 (GET)
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) throw err;
    res.redirect('/');
  });
});

// 서버 시작
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
