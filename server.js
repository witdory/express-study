const express = require('express')
const app = express()
require("dotenv").config()
const url = process.env.DB_URL
app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended:true}))
const { MongoClient, ObjectId } = require('mongodb')

let db
new MongoClient(url).connect().then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')
  app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})
}).catch((err)=>{
  console.log(err)
})




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

  let result = await db.collection('post').find().toArray()
  res.render('write.ejs', {posts: result})

}) 


app.post('/newpost', async (req, res)=>{
  console.log(req.body)

  try{
    if(req.body.title == ''){
      res.send('제목을 입력하세요')
    }
    else{
      await db.collection('post').insertOne({
        title: req.body.title,
        content: req.body.content
      })
      res.redirect('/list')
    }
  }
  catch(e){
    console.log(e)
    res.status(500).send('서버 에러 발생')
  }
})


app.get('/detail/:id', async (req, res)=>{
   try{

    let result = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)})
    if(result == null){
      res.send('url 입력 오류류')
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