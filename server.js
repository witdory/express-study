// server.js
const express = require('express')
const app = express()
const { MongoClient, ObjectId } = require('mongodb')
const methodOverride = require('method-override')
const bcrypt = require('bcrypt')

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
  app.listen(8080, () => {
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

app.get('/', (req, res) => {
  // res.sendFile(__dirname + '/index.html');
  res.redirect('/list')
}) 

app.get('/news', (req, res) => {
  db.collection('post').insertOne({title: '2월 2일'})
}) 

app.get('/list', async (req, res) => {
  let result = await db.collection('post').find().toArray()
  // console.log(result[0])
  res.render('list.ejs', {posts: result})
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
          await db.collection('post').insertOne({
            title: req.body.title,
            content: req.body.content,
            img: req.file.location
          })
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

    let result = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)})
    if(result == null){
      res.send('url 입력 오류')
    }
    else{
      console.log(result)
      res.render('detail.ejs',{post:result})
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
  await db.collection('post').deleteOne({_id:new ObjectId(req.query.postid)})
  .then(result => console.log('삭제됨', result));
  res.send('삭제완료')
})




app.get('/list/:page', async (req, res) => {
  // 1번~5번 글을 찾아서 result에 저장

  let result = await db.collection('post').find().skip((req.params.page-1)*5).limit(5).toArray()
  
  res.render('list.ejs', {posts: result})
})  

app.get('/api/list/next/:id', async (req, res) => {
  // 1번~5번 글을 찾아서 result에 저장

  let result = await db.collection('post')
  .find({_id : {$gt : new ObjectId(req.params.id)}})
  .limit(5).toArray()
  
  res.render('list.ejs', {posts: result})
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
  res.render('login.ejs')
})  


app.post('/login', async (req, res, next) => {
  passport.authenticate('local', (error, user, info)=>{
    if(error) return res.status(500).json(error)
    if(!user) return res.status(401).json(info.message)
    req.logIn(user, (err)=>{
      if(err) return next(err)
      res.redirect('/')
    })
  })(req, res, next)
  
})  


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

app.get('/search',async (req, res)=>{
  console.log(req.query.val)

  let result = await db.collection('post').find({$text : { $search : req.query.val}}).toArray()
  res.render('search.ejs',{posts:result})
})