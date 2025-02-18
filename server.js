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



const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
// const connectDB = require('./database.js')
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : process.env.S3_KEY,
      secretAccessKey : process.env.S3_SECRET
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'seolguforum',
    key: function (req, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})



let db
let connectDB = require('./database.js')

connectDB.then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')
  server.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})
}).catch((err)=>{
  console.log(err)
})


const checkLogin = (req, res, next) =>{
  if(!req.user){
    return res.redirect('/login')
  }
  next()
}


app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.get('/', (req, res) => {
  // res.sendFile(__dirname + '/index.html');
  res.redirect('/list')
}) 

app.get('/news', (req, res) => {
  db.collection('post').insertOne({title: '2월 2일'})
}) 

app.get('/list', async (req, res) => {
  // let result = await db.collection('post').find().sort({ createdAt: -1 }).toArray()
  // // console.log(result[0])
  // res.render('list.ejs', {
  //   posts: result,
  // user: req.user})
  res.redirect('/list/1')
}) 


app.get('/write', async (req, res) => {

  // let result = await db.collection('post').find().toArray()
  // res.render('write.ejs', {posts: result})
  if(req.user){
    res.render('write.ejs')
  }
  else{
    res.redirect('/login')
  }
}) 


app.post('/newpost', async (req, res)=>{
  // console.log(req.body)
  // console.log(req.file)

  upload.single('img1')(req, res, async (err)=>{
    if(err) return res.send('업로드 에러')


      try{
        if(req.body.title == ''){
          res.send('제목을 입력하세요')
        }
        else{
          if(req.file){
            await db.collection('post').insertOne({
              title: req.body.title,
              content: req.body.content,
              createdAt: new Date(),
              img: req.file.location,
              user: req.user._id,
              username: req.user.username,
              viewCount: 0
            })
          }
          else{
            await db.collection('post').insertOne({
              title: req.body.title,
              content: req.body.content,
              createdAt: new Date(),
              user: req.user._id,
              username: req.user.username,
              viewCount: 0

            })
          }
          console.log('글 작성 성공')
          res.redirect('/list')
        }
      }
      catch(e){
        console.log(e)
        res.status(500).send('서버 에러 발생')
      }
  })
})


app.get('/detail/:id', async (req, res)=>{
  try{

    let post = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)})
    let comments = await db.collection('comment').find({parentId: new ObjectId(req.params.id)}).toArray()
    await db.collection('post').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { viewCount: 1 } }
    );

    if(post == null ){
      res.send('게시글이 존재하지 않습니다.')
    }
    else{
      // console.log(post)
      res.render('detail.ejs',{
        post:post,
        comments: comments
      })
    }

    
  }
  catch(e){
    console.log(e)
    res.status(500).send('url 오류')
  }

})


app.get('/edit/:id', async (req, res)=>{
  try{

   let result = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)})
   if(result == null){
     res.send('url 입력 오류')
   }
   else if(result.user.toString() != req.user._id.toString()){
    res.send('작성자만 수정할 수 있습니다')
   
   }
   else{
     console.log(result)
     res.render('edit.ejs',{post:result})
   }
   
 }
 catch(e){
   console.log(e)
   res.status(500).send('url 오류')
 }

})

app.post('/edit/:id', async (req, res)=>{
  console.log(req.body)

  try{
    if(req.body.title == ''){
      res.send('제목을 입력하세요')
    }
    else{
      await db.collection('post').updateOne({_id : new ObjectId(req.params.id)}, {$set:{title : req.body.title, content: req.body.content}})
      res.redirect('/detail/'+ req.params.id)
    }
  }
  catch(e){
    console.log(e)
    res.status(500).send('서버 에러 발생')
  }
})


app.delete('/api/posts', async (req, res)=> {
  console.log(req.query)
  await db.collection('post').deleteOne({
    _id:new ObjectId(req.query.postid),
    user: new ObjectId(req.user._id)
  })
  .then(result => console.log('삭제됨', result));
  res.send('삭제완료')
})




app.get('/list/:page', async (req, res) => {
  // 1번~5번 글을 찾아서 result에 저장

  let result = await db.collection('post')
  .find()
  .sort({ createdAt: -1 })
  .skip((req.params.page-1)*10)
  .limit(10)
  .toArray()
  
  res.render('list.ejs', {posts: result, user: req.user})
})  

app.get('/list/next/:id', async (req, res) => {
  // 1번~5번 글을 찾아서 result에 저장

  let result = await db.collection('post')
  .find({_id : {$gt : new ObjectId(req.params.id)}})
  .limit(10).toArray()
  
  res.render('list.ejs', {posts: result, user: req.user})
})  



passport.use(new LocalStrategy(async (userId, userPassword, cb) => {
  let result = await db.collection('user').findOne({ username : userId})
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }
  if (await bcrypt.compare(userPassword, result.password)) {
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비밀번호 불일치' });
  }
}))

passport.serializeUser((user, done) => {
  console.log(user)
  process.nextTick(()=> {
    done(null, {id : user._id, username : user.username})
  })
})

passport.deserializeUser(async (user, done) => {

  let result = await db.collection('user').findOne({_id :  new ObjectId(user.id)})
  delete result.password
  process.nextTick(()=>{
    done(null, result)
  })
})


app.get('/login', async (req, res) => {
  // console.log(req.user)
  res.render('login.ejs',{ redirect: req.query.redirect || '' })
})  


app.post('/login', async (req, res, next) => {
  passport.authenticate('local', (error, user, info)=>{
    if(error) return res.status(500).json(error)
    if(!user) return res.status(401).json(info.message)

      req.logIn(user, (err) => {
        if (err) return next(err);
        // POST 요청에서는 req.body.redirect 사용
        const redirectUrl = req.body.redirect || '/';
        res.redirect(redirectUrl);
      });
  })(req, res, next)
  
})  

app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');  // 로그아웃 후 원하는 페이지로 리다이렉션
  });
});

app.get('/mypage', checkLogin, async (req, res) => {
  // console.log(req.user)
  res.render('mypage.ejs',{user: req.user})
  
})  

app.get('/register',(req, res)=>{
  res.render('register.ejs')
})

app.post('/register',async (req, res)=>{

  const existId = await db.collection('user').findOne({username : req.body.username})

  if(existId){
    console.log('아이디 중복')
    res.redirect('/register')
  } 
  else if(req.body.password != req.body.confirmpassword){
    console.log('비밀번호 불일치')
    res.redirect('/register')
  }
  else{
    let hash = await bcrypt.hash(req.body.password,10)
    // console.log(hash)
    await db.collection('user').insertOne({
      username: req.body.username,
      password: hash
    })
    res.redirect('/list')
  }

  
})

app.use('/shop', require('./routes/shop.js'))

app.use('/board', require('./routes/board.js'))

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

app.post('/comment', async (req, res)=>{
  if(req.user){
    await db.collection('comment').insertOne({
      content: req.body.content,
      writerId: new ObjectId(req.user._id),
      writerName: req.user.username,
      parentId: new ObjectId(req.query.parent),
      createdAt: new Date(),
  
    })
    await db.collection('post').updateOne(
      { _id: new ObjectId(req.query.parent) },
      { $inc: { commentCount: 1 } }
    );
    res.redirect('/detail/'+req.query.parent)
  }
  else{
    res.redirect('/login')
  }
  
})

app.use('/chat',require('./routes/chat.js'))


io.on('connection',(socket)=>{

  socket.on('age',(data)=>{
    console.log('유저가 보낸 데이터: ', data)
    io.emit('name', 'kim')
  })

  socket.on('ask-join',(data)=>{
    socket.join(data)

  })
  socket.on('message-send',async (data)=>{
    await db.collection('messages').insertOne({
      roomId: new ObjectId(data.room),
      msg: data.msg,
      user: new ObjectId(data.user),
      sentAt: data.sentAt
    })
    io.to(data.room).emit('message-broadcast',{
      msg: data.msg,
      user: data.user,
      sentAt: data.sentAt
    })
    console.log(data)
  })

})