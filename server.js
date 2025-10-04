// server.js
const express = require('express')
const app = express()

// const session = require('express-session');
const {RedisStore} = require('connect-redis')// 최신 버전은 default import
const redis = require('redis');

const isProd = process.env.NODE_ENV === 'production';

// ① 운영(컨테이너 ↔ 컨테이너) ─ 컨테이너 DNS 이름
// ② 개발(호스트 ↔ 컨테이너)  ─ localhost:6379 로 바인딩
const redisUrl = isProd
  ? 'redis://mystack_redis:6379'
  : 'redis://localhost:6379'; // Linux Docker Desktop이면 host.docker.internal 도 가능
const client = redis.createClient({
  url: redisUrl
});

client.connect().then(() => {
  console.log('✅ Redis 연결 성공');
}).catch(console.error);

const { MongoClient, ObjectId } = require('mongodb')
const methodOverride = require('method-override')
const bcrypt = require('bcrypt')

const { createServer } = require('http')
const { Server } = require('socket.io')
const server = createServer(app)
const io = new Server(server)

const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

app.use(morgan('combined',{ stream: accessLogStream }));


require("dotenv").config()
const url = process.env.DB_URL

app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended:true}))




app.set('trust proxy', 1);
app.use((req, res, next) => {
  // 개발 중에는 캐시 비활성화
  if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});


const session = require('express-session')
const passport = require('passport')
// const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')

// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave : false,
//   saveUninitialized : false,
//   cookie : { 
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     maxAge : 7 * 24 * 60 * 60 * 1000
//   },
//   store : MongoStore.create({
//     mongoUrl : process.env.DB_URL,
//     dbName : 'forum'
//   })
// }))

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave : false,
  saveUninitialized : false,
  cookie : { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge : 7 * 24 * 60 * 60 * 1000
  },
  store : new RedisStore({
    client:client
  })
}))

app.use(passport.initialize())

app.use(passport.session()) 



let db
let connectDB = require('./database.js')

connectDB.then((client)=>{
  db = client.db('forum')

  // Passport 설정
  require('./config/passport')(db);
  // Socket.io 초기화
  require('./socket/chatSocket')(io, db);


  server.listen(8080, () => {
    console.log('✅ http://localhost:8080 에서 서버 실행중')
})
}).catch((err)=>{
  console.log(err)
})


const checkLogin = require('./middlewares/checkLogin.js')


app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.get('/', async (req, res) => {
  res.redirect('/post/list/1')
}) 


app.use('/post',require('./routes/post.js'))
app.use('/shop', require('./routes/shop.js'))
app.use('/board', require('./routes/board.js'))
app.use('/chat',require('./routes/chat.js'))
app.use('/auth',require('./routes/auth.js'))



app.get('/health', (req, res) => {
  res.sendStatus(200);
});

app.get('/search', async (req, res)=>{
  let page = parseInt(req.params.page) || 1;
  const limit = 10;
  const totalCount = await db.collection('post').countDocuments();
    const totalPages = Math.ceil(totalCount / limit);
  // console.log(req.query.val)
  let searchCondition = [
    {$search : {
      index : 'title_index',
      text : { query : req.query.val, path : 'title' }
    }},
    {$sort : {createdAt : 1}},
    {$limit : limit}
    
  ] 

  let result = await db.collection('post').aggregate(searchCondition).toArray()
  res.render('search.ejs',{
    posts:result,
    value: req.params.val,
    user: req.user,
    currentPage: page,
    totalPages: totalPages
  })
})

app.post('/search', async(req, res)=>{
  let page = parseInt(req.body.page) || 1;
  const limit = 10;
  const totalCount = await db.collection('post').countDocuments();
  const totalPages = Math.ceil(totalCount / limit);

  let searchCondition = [
    { $search: {
        index: 'title_index',
        text: { query: req.body.val, path: 'title' }
      }
    },
    { $sort: { createdAt: 1 } },
    { $limit: limit }
  ];
  let result = await db.collection('post').aggregate(searchCondition).toArray();

  res.render('search.ejs', {
    posts: result,
    value: req.body.val,
    user: req.user,
    currentPage:page,
    totalPages: totalPages
  })

})




