const router = require('express').Router()
const { ObjectId } = require('mongodb');

// router.set('view engine', 'ejs');  // EJS 템플릿 엔진 사용
// app.set('views', __dirname + '/views');  // views 폴더 위치 설정


let db
let connectDB = require('./../database.js')

connectDB.then((client)=>{
  console.log('DB연결성공2')
  db = client.db('forum')
  
}).catch((err)=>{
  console.log(err)
})

const checkLogin = require('./../checkLogin.js')

router.get('/request', checkLogin, async(req, res)=>{
    await db.collection('chatroom').insertOne({
      member: [req.user._id, new ObjectId(req.query.writerId)],
      date: new Date()
    })
    res.redirect('/chat/list')
  })

router.get('/list', checkLogin, async(req, res)=>{
    let result = await db.collection('chatroom').find({
        member: req.user._id
    }).toArray()
    res.render('chatList.ejs',{rooms:result})
})

router.get('/detail/:id', checkLogin, async(req, res)=>{

    // console.log(req.user)
    let room = await db.collection('chatroom').findOne({
        _id: new ObjectId(req.params.id)
    })
    if(req.user._id.toString() == room.member[0] || req.user._id.toString() == room.member[1]){
        res.render('chatDetail.ejs',{room: room})
    }
    else{
        res.send('접속불가')
    }
})

module.exports = router
