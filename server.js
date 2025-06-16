// server.js
require('dotenv').config()
const express = require('express')
const app = express()
const path = require('path')
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redis = require('redis');

// Redis URL 설정은 그대로 유지
let redisUrl
if (process.env.NODE_ENV === 'production') {
  redisUrl = 'redis://redis:6379'
} else if (process.env.NODE_ENV === 'development') {
  redisUrl = 'redis://localhost:6379'
} else if (process.env.NODE_ENV === 'k3s') {
  redisUrl = 'redis://redis-service:6379'
} else {
  redisUrl = 'redis://localhost:6379'
}

console.log('🔍 Using Redis URL:', redisUrl);

// ✅ 핵심 수정: legacyMode 추가
const redisClient = redis.createClient({ 
  url: redisUrl,
  legacyMode: true  // ⭐️ 이것이 핵심!
});

redisClient.on('error', (err) => {
  console.error('❌ Redis 에러:', err);
});

// ✅ 연결 방식 개선
redisClient.connect()
  .then(() => {
    console.log('✅ Redis 연결 완료');
    // 연결 테스트
    return redisClient.ping();
  })
  .then((result) => {
    console.log('✅ Redis PING:', result);
  })
  .catch((err) => {
    console.error('❌ Redis 연결 실패:', err);
  });

// — HTTP 서버 & Socket.io — 
const { createServer } = require('http')
const { Server } = require('socket.io')
const server = createServer(app)
const io = new Server(server)

// — MongoDB, Passport 설정 — 
const { MongoClient, ObjectId } = require('mongodb')
const connectDB = require('./database.js')
const passport = require('passport')

// — Express 기본 설정 — 
app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// — 신뢰할 프록시 설정 — 
app.set('trust proxy', 1)                                      

// — 세션 & Passport 미들웨어 — 
app.use(session({
  secret: process.env.SESSION_SECRET,                        
  resave: false,
  saveUninitialized: false,
  store: new RedisStore({ client: redisClient }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',             
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}))
app.use(passport.initialize())
app.use(passport.session())

// — 요청 로그 출력 (Passport deserialize 이후) — 
app.use((req, res, next) => {
  console.log('---[REQ]-------------------')
  console.log('쿠키:', req.headers.cookie)
  console.log('세션:', req.session)
  console.log('passport user:', req.user)
  next()
})

// — DB 연결 후 나머지 설정 — 
connectDB.then(client => {
  const db = client.db('forum')

  // Passport serialize/deserialize 설정 (반드시 먼저!)
  require('./config/passport')(db)
  console.log('✅ Passport 설정 완료')

  // — 라우터 설정 (Passport 설정 후!) — 
  const checkLogin = require('./middlewares/checkLogin.js')
  app.use((req, res, next) => {
    res.locals.user = req.user
    next()
  })

  app.get('/', (req, res) => res.redirect('/post/list/1'))
  app.use('/post', require('./routes/post.js'))
  app.use('/shop', require('./routes/shop.js'))
  app.use('/board', require('./routes/board.js'))
  app.use('/chat', require('./routes/chat.js'))
  app.use('/auth', require('./routes/auth.js'))

  app.get('/health', (req, res) => res.sendStatus(200))
  
  // search 라우트들도 여기로 이동 (db 변수 사용 때문에)
  app.get('/search', async (req, res) => {
    const page = parseInt(req.query.page) || 1
    const limit = 10
    const totalCount = await db.collection('post').countDocuments()
    const totalPages = Math.ceil(totalCount / limit)
    const result = await db.collection('post')
      .aggregate([
        { $search: { index: 'title_index', text: { query: req.query.val, path: 'title' } } },
        { $sort: { createdAt: 1 } },
        { $limit: limit }
      ]).toArray()
    res.render('search.ejs', {
      posts: result,
      value: req.query.val,
      user: req.user,
      currentPage: page,
      totalPages
    })
  })
  
  app.post('/search', async (req, res) => {
    const page = parseInt(req.body.page) || 1
    const limit = 10
    const totalCount = await db.collection('post').countDocuments()
    const totalPages = Math.ceil(totalCount / limit)
    const result = await db.collection('post')
      .aggregate([
        { $search: { index: 'title_index', text: { query: req.body.val, path: 'title' } } },
        { $sort: { createdAt: 1 } },
        { $limit: limit }
      ]).toArray()
    res.render('search.ejs', {
      posts: result,
      value: req.body.val,
      user: req.user,
      currentPage: page,
      totalPages
    })
  })

  // Socket.io 초기화
  require('./socket/chatSocket')(io, db)

  server.listen(8080, () => {
    console.log('✅ http://localhost:8080 에서 서버 실행중')
  })
}).catch(console.error)