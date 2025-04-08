// server.js
const express = require('express')
const app = express()
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

// server.js 상단, app.use(...)들 사이에 넣기!
app.use((req, res, next) => {
  console.log('✅ req.secure:', req.secure);
  console.log('✅ x-forwarded-proto:', req.headers['x-forwarded-proto']);
  console.log('✅ NODE_ENV:', process.env.NODE_ENV);
  next();
});


app.set('trust proxy', 1);



const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')

app.use(passport.initialize())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave : false,
  saveUninitialized : false,
  cookie : { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge : 7 * 24 * 60 * 60 * 1000
  },
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL,
    dbName : 'forum'
  })
}))

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
    console.log('http://localhost:8080 에서 서버 실행중')
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
  // res.sendFile(__dirname + '/index.html');
  // await db.collection('user').updateMany(
  //   { provider: { $exists: false } },
  //   { $set: { provider: 'local' } }
  // );
  // console.log("업데이트성공")
  res.redirect('/post/list/1')
}) 


app.use('/post',require('./routes/post.js'))
app.use('/shop', require('./routes/shop.js'))
app.use('/board', require('./routes/board.js'))
app.use('/chat',require('./routes/chat.js'))
app.use('/auth',require('./routes/auth.js'))





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




