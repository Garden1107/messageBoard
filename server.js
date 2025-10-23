const express = require('express');
const path = require('path');
const fileUpload = require('express-fileupload');
const session = require('express-session'); 
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const fs = require('fs');
const bcrypt = require('bcrypt');
const app = express();
const port = 4002;
// 정적 파일 제공
app.use('/public', express.static(path.join(__dirname, 'public')));

// Middleware 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload()); // 파일 업로드 미들웨어
app.use(session({
    secret: 'secureSecretKey',
    resave: false,
    saveUninitialized: true
}));

// MySQL 연결 설정
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'web_project'
});

// MySQL 연결 확인
db.connect(err => {
    if (err) {
        console.error('DB 연결 실패:', err);
    } else {
        console.log('DB 연결 성공');
    }
});

// 정적 파일 (HTML, CSS, JS 등) 제공
app.use(express.static(path.join(__dirname, 'public')));

// /account 페이지 요청에 대한 GET 응답
app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

// /account 경로에 대한 POST 요청 처리
app.post('/account', (req, res) => {
    const { email, username, name, password } = req.body;

    // 비밀번호 암호화
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ success: false, message: '비밀번호 암호화 실패' });
        }

        // 이메일과 사용자 이름 중복 체크
        db.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: '데이터베이스 오류' });
            }

            if (results.length > 0) {
                return res.status(400).json({ success: false, message: '이메일 또는 사용자 이름이 이미 존재합니다.' });
            }

            // 사용자 등록
            const query = 'INSERT INTO users (email, username, name, password) VALUES (?, ?, ?, ?)';
            db.query(query, [email, username, name, hashedPassword], (err, result) => {
                if (err) {
                    console.error('SQL 오류:', err);
                    console.log('요청 데이터:', req.body);  // 폼 데이터
                    console.log('파일:', req.file);  // 파일 데이터
                    return res.status(500).json({ success: false, message: '등록 실패' });
                }

                // 성공 메시지와 함께 로그인 페이지로 돌아갈 수 있는 링크 제공
                res.send(`
                    <h1>회원가입 성공</h1>
                    <p>회원가입이 성공적으로 완료되었습니다.</p>
                    <p><a href="/login">로그인 페이지로 돌아가기</a></p>
                `);
            });
        });
    });
});



// 로그인 POST 요청 처리
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('입력된 사용자명:', username);
  console.log('입력된 비밀번호:', password);

  // MySQL 쿼리: 사용자가 입력한 username으로 DB에서 사용자 정보 찾기
  const query = 'SELECT * FROM users WHERE username = ?';
  
  db.execute(query, [username], (err, results) => {
    if (err) {
      console.error('쿼리 실행 중 오류 발생:', err);
      return res.send('데이터베이스 오류.');
    }

    if (results.length === 0) {
      return res.send('사용자없음.');
    }

    const user = results[0];  // 사용자 정보
    console.log('DB에서 가져온 사용자 정보:', user);

    // bcrypt로 비밀번호 비교
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        console.error('비밀번호 비교 중 오류 발생:', err);
        return res.send('로그인 오류.');
      }
      console.log('입력한 비밀번호:', password);
      console.log('저장된 비밀번호 해시:', user.password); // 해시된 비밀번호 확인

      if (match) {
        // 비밀번호가 맞으면 세션에 사용자 정보 저장
        req.session.user = user;
        return res.redirect('/profile');  // 로그인 성공시 프로필로 리다이렉트
      } else {
        return res.send('Invalid credentials.');
      }
    });
  });
});

// 로그인 페이지 렌더링
app.get('/login', (req, res) => {
    res.send(`
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f9;
                padding: 20px;
                max-width: 600px;
                margin: auto;
            }

            h1 {
                text-align: center;
            }

            form {
                display: flex;
                flex-direction: column;
            }

            label {
                margin: 10px 0 5px;
            }

            input {
                padding: 10px;
                margin-bottom: 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
            }

            button {
                padding: 10px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }

            button:hover {
                background-color: #45a049;
            }

            p {
                text-align: center;
            }

            a {
                color: #4CAF50;
            }
        </style>
        
        <h1>게시판에 오신걸 환영합니다!</h1>
        <img src="IMG_0007.PNG" width="600px" alt="사진없음">
        <h1>Login</h1>
        <form action="/login" method="POST">
            <label for="username">ID(username):</label>
            <input type="text" id="username" name="username" placeholder="Enter your ID(username)" required>

            <label for="password">Password:</label>
            <input type="password" id="password" name="password" placeholder="Enter your password" required>

            <button type="submit">Login</button>
        </form>

        <p>Don't have an account? <a href="/account">Register here</a></p>
    `);
});


// 로그아웃 처리
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('세션 삭제 중 오류 발생:', err);
            return res.send('로그아웃 중 오류가 발생했습니다.');
        }
        res.redirect('/login'); // 로그아웃 후 로그인 페이지로 이동
    });
});

// 프로필 페이지
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // 세션에 사용자 정보가 없으면 로그인 페이지로 리다이렉트
    }

    const userId = req.session.user.id; // 로그인한 사용자의 ID

    // 사용자가 작성한 게시글 개수와 게시글 목록 조회
    const queryPostsCount = 'SELECT COUNT(*) AS postCount FROM posts WHERE author_id = ?';
    db.query(queryPostsCount, [userId], (err, result) => {
        if (err) {
            console.error('게시글 개수 조회 중 오류 발생:', err);
            return res.send('게시글 개수 조회 중 오류 발생');
        }

        const postCount = result[0].postCount; // 작성한 게시글 개수

        // 사용자가 작성한 게시글 목록 조회
        const queryPosts = 'SELECT * FROM posts WHERE author_id = ?';
        db.query(queryPosts, [userId], (err, posts) => {
            if (err) {
                console.error('게시글 조회 중 오류 발생:', err);
                return res.send('게시글을 불러오는 중 오류가 발생했습니다.');
            }

            // 게시글 목록을 HTML로 동적으로 생성
            let postListHtml = '';
            posts.forEach(post => {
                postListHtml += `
                    <li>
                        <a href="/post/${post.id}">${post.title}</a> <!-- 게시글 제목을 클릭하면 상세 페이지로 이동 -->
                    </li>
                `;
            });

            // 프로필 페이지에 사용자 이름, 게시글 개수, 게시글 목록 표시
            res.send(`
                <h1>Welcome ${req.session.user.username}!</h1>
                <p>작성한 게시글 개수: ${postCount}</p>
                <h3>작성한 게시글 목록</h3>
                <ul>
                    ${postListHtml}
                </ul>
                <br>
                <a href="/new">새 게시글 작성 및 업로드</a> <!-- 게시글 작성 페이지로 이동하는 링크 -->
                <br>
                <a href="/board">게시판으로 이동</a> <!-- 게시판 페이지로 이동하는 링크 -->
                <br>
                <a href="/logout">로그아웃</a> <!-- 로그아웃 버튼 -->
            `);
        });
    });
});

  

  
// 게시글 상세 페이지
app.get('/post/:id', (req, res) => {
  const postId = req.params.id; // 게시글 ID 가져오기

  // 게시글 정보 조회
  const queryPost = 'SELECT * FROM posts WHERE id = ?';
  db.query(queryPost, [postId], (err, results) => {
    if (err) {
      console.error('게시글 조회 중 오류 발생:', err);
      return res.send('게시글을 불러오는 중 오류가 발생했습니다.');
    }

    if (results.length === 0) {
      return res.send('게시글을 찾을 수 없습니다.');
    }

    const post = results[0]; // 게시글 정보

    // 게시글 상세 내용 출력
    res.send(`
      <h1>${post.title}</h1>
      <p>${post.content}</p>
      ${post.image ? `<img src="${post.image}" alt="게시글 이미지" style="max-width: 100%; height: auto;" />` : ''}
      <br>
      <a href="/edit/${postId}">편집</a>
      </form>
      <br><br>
      <a href="/profile">내 프로필로 돌아가기</a>
    `);
  });
});


// 게시판 페이지
app.get('/board', (req, res) => {
  const searchQuery = req.query.search || '';  // 검색어는 URL 파라미터로 받음
  
  // 게시글 검색 (제목 또는 작성자에서 검색)
  const query = `
    SELECT posts.id, posts.title, posts.author_id, users.username
    FROM posts
    JOIN users ON posts.author_id = users.id
    WHERE posts.title LIKE ? OR users.username LIKE ?`;

  db.query(query, [`%${searchQuery}%`, `%${searchQuery}%`], (err, results) => {
    if (err) {
      console.error('게시글 조회 중 오류 발생:', err);
      return res.send('게시글을 불러오는 중 오류가 발생했습니다.');
    }

    // 검색 결과가 있을 경우 게시글 목록과 함께 보여줌
    let postsHtml = results.map(post => {
      return `
        <div>
          <h2><a href="/post/${post.id}">${post.title}</a></h2>
          <p>작성자: ${post.username}</p>
        </div>
      `;
    }).join('');

    // 검색어가 있을 경우 검색 결과를 함께 표시
    res.send(`
      <h1>게시판</h1>
      <form method="GET" action="/board">
        <input type="text" name="search" value="${searchQuery}" placeholder="검색어를 입력하세요" />
        <button type="submit">검색</button>
      </form>
      <div>
        ${postsHtml || '검색 결과가 없습니다.'}
      </div>
    `);
  });
});

// 새 게시글 업로드 페이지
app.get('/new', (req, res) => {
    if (!req.session.user) {
      return res.redirect('/login');  // 로그인 안 한 경우 로그인 페이지로 리다이렉트
    }
  
    res.send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>새 게시글 작성</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
          h1 {
            color: #333;
          }
          form {
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 400px;
            display: flex;
            flex-direction: column;
          }
          input[type="text"],
          textarea,
          input[type="file"] {
            margin-bottom: 15px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            width: 100%;
            font-size: 14px;
          }
          textarea {
            height: 100px;
            resize: none;
          }
          button {
            background-color: #4CAF50;
            color: white;
            padding: 10px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
          }
          button:hover {
            background-color: #45a049;
          }
        </style>
      </head>
      <body>
        <h1>새 게시글 작성 및 업로드</h1>
        <form method="POST" action="/new" enctype="multipart/form-data">
          <input type="text" name="title" placeholder="제목" required />
          <textarea name="content" placeholder="내용" required></textarea>
          <input type="file" name="image" accept="image/*" />
          <button type="submit">게시글 업로드</button>
        </form>
      </body>
      </html>
    `);
  });
  

  

// 새 게시글 업로드 처리
app.post('/new', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); // 로그인하지 않으면 로그인 페이지로 리다이렉트
  }

  const { title, content } = req.body;
  const author_id = req.session.user.id;

  // 이미지 파일 처리
  const image = req.files ? req.files.image : null;
  let imagePath = null;

  if (image) {
    // 이미지 저장 경로 설정
    imagePath = `/uploads/${Date.now()}-${image.name}`;
    const savePath = path.join(__dirname, 'public', imagePath);

    // 이미지 파일 저장
    image.mv(savePath, err => {
      if (err) {
        console.error('이미지 업로드 오류:', err);
        return res.send('이미지 업로드 실패');
      }
    });
  }

  // 데이터베이스에 게시글 추가
  const query = 'INSERT INTO posts (title, content, author_id, image) VALUES (?, ?, ?, ?)';
  db.query(query, [title, content, author_id, imagePath], (err, result) => {
    if (err) {
      console.error('게시글 업로드 오류:', err);
      return res.send('게시글 업로드 실패');
    }

    res.redirect('/board'); // 게시글 업로드 후 게시판 페이지로 리다이렉트
  });
});

// 편집 페이지 출력
app.get('/edit/:id', (req, res) => {
  const postId = req.params.id; // 게시글 ID 가져오기

  // 게시글 정보 조회
  const queryPost = 'SELECT * FROM posts WHERE id = ?';
  db.query(queryPost, [postId], (err, results) => {
    if (err) {
      console.error('게시글 조회 중 오류 발생:', err);
      return res.send('게시글을 불러오는 중 오류가 발생했습니다.');
    }

    if (results.length === 0) {
      return res.send('게시글을 찾을 수 없습니다.');
    }

    const post = results[0]; // 게시글 정보

    // 편집 페이지 출력
    res.send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>게시글 편집</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
          h1 {
            color: #333;
          }
          form {
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 600px;
            display: flex;
            flex-direction: column;
          }
          input[type="text"],
          textarea,
          input[type="file"] {
            margin-bottom: 15px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            width: 100%;
            font-size: 14px;
          }
          textarea {
            height: 150px;
            resize: none;
          }
          button {
            background-color: #4CAF50;
            color: white;
            padding: 10px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
          }
          button:hover {
            background-color: #45a049;
          }
          a {
            color: #4CAF50;
            text-decoration: none;
            margin-top: 15px;
            font-size: 14px;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <h1>게시글 편집</h1>
        <form method="POST" action="/edit/${postId}" enctype="multipart/form-data">
          <input type="text" name="title" value="${post.title}" required />
          <textarea name="content" required>${post.content}</textarea>
          <input type="file" name="image" accept="image/*" />
          <button type="submit">수정</button>
        </form>
        <br>
        <form method="POST" action="/delete/${postId}" style="display: inline;">
          <button type="submit" style="color: red;">삭제</button>
        </form>
        <br>
        <a href="/post/${postId}">돌아가기</a>
      </body>
      </html>
    `);
  });
});


// 게시글 수정 처리
app.post('/edit/:id', (req, res) => {
  const postId = req.params.id;
  const { title, content } = req.body;

  // 이미지 파일 처리
  const image = req.files ? req.files.image : null;
  let query, params;

  if (image) {
    const imagePath = `/uploads/${image.name}`;
    image.mv(path.join(__dirname, 'public', imagePath), err => {
      if (err) {
        console.error('이미지 업로드 오류:', err);
        return res.send('이미지 업로드 실패');
      }
    });

    query = 'UPDATE posts SET title = ?, content = ?, image = ? WHERE id = ?';
    params = [title, content, imagePath, postId];
  } else {
    query = 'UPDATE posts SET title = ?, content = ? WHERE id = ?';
    params = [title, content, postId];
  }

  db.query(query, params, (err, result) => {
    if (err) {
      console.error('게시글 수정 오류:', err);
      return res.send('게시글 수정 실패');
    }

    res.redirect(`/post/${postId}`);
  });
});


// 게시글 삭제 처리
app.post('/delete/:id', (req, res) => {
  const postId = req.params.id;

  const query = 'DELETE FROM posts WHERE id = ?';
  db.query(query, [postId], (err, result) => {
    if (err) {
      console.error('게시글 삭제 오류:', err);
      return res.send('게시글 삭제 실패');
    }

    res.redirect('/profile');
  });
});


// 서버 시작
app.listen(port, () => {
    console.log(`서버가 http://localhost:${port}에서 실행 중입니다.`);
});
