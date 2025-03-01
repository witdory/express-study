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





const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')

app.use(passport.initialize())
app.use(session({
  secret: '비번',
  resave : false,
  saveUninitialized : false,
  cookie : { maxAge : 7 * 24 * 60 * 60 * 1000},
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

app.get('/', (req, res) => {
  // res.sendFile(__dirname + '/index.html');
  res.redirect('/post/list/1')
}) 


app.use('/post',require('./routes/post.js'))
app.use('/shop', require('./routes/shop.js'))
app.use('/board', require('./routes/board.js'))
app.use('/chat',require('./routes/chat.js'))

app.use('/auth',require('./routes/auth.js'))






// app.get('/login', async (req, res) => {
//   // console.log(req.user)
//   res.render('login.ejs',{ redirect: req.query.redirect || '' })
// })  


// app.post('/login', async (req, res, next) => {
//   passport.authenticate('local', (error, user, info)=>{
//     if(error) return res.status(500).json(error)
//     if(!user) return res.status(401).json(info.message)

//       req.logIn(user, (err) => {
//         if (err) return next(err);
//         // POST 요청에서는 req.body.redirect 사용
//         const redirectUrl = req.body.redirect || '/';
//         res.redirect(redirectUrl);
//       });
//   })(req, res, next)
  
// })  

// app.get('/logout', (req, res, next) => {
//   req.logout(function(err) {
//     if (err) { return next(err); }
//     res.redirect('/');  // 로그아웃 후 원하는 페이지로 리다이렉션
//   });
// });

// app.get('/mypage', checkLogin, async (req, res) => {
//   // console.log(req.user)
//   res.render('mypage.ejs',{user: req.user})
  
// })  

// app.get('/register',(req, res)=>{
//   res.render('register.ejs')
// })

// app.post('/register',async (req, res)=>{

//   const existId = await db.collection('user').findOne({username : req.body.username})

//   if(existId){
//     console.log('아이디 중복')
//     res.redirect('/register')
//   } 
//   else if(req.body.password != req.body.confirmpassword){
//     console.log('비밀번호 불일치')
//     res.redirect('/register')
//   }
//   else{
//     let hash = await bcrypt.hash(req.body.password,10)
//     // console.log(hash)
//     await db.collection('user').insertOne({
//       username: req.body.username,
//       password: hash
//     })
//     res.redirect('/list')
//   }

  
// })



app.get('/search', async (req, res)=>{
  console.log(req.query.val)
  let searchCondition = [
    {$search : {
      index : 'title_index',
      text : { query : req.query.val, path : 'title' }
    }},
    {$sort : {createdAt : 1}},
    {$limit : 3}
    
  ] 

  let result = await db.collection('post').aggregate(searchCondition).toArray()
  res.render('search.ejs',{
    posts:result,
    user: req.user
  })
})




