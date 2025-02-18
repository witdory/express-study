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

    const writerId = new ObjectId(req.query.writerId);
    const userId = req.user._id;
    const writer = await db.collection('user').findOne({_id : writerId})

    const chatRoom = await db.collection('chatroom').findOne({
        member: { $all: [ userId, writerId ] }
    });

    if (!chatRoom) {
        let roomName = req.user.username + ', ' + writer.username + '의 채팅방'
      await db.collection('chatroom').insertOne({
        roomName: roomName,
        member: [ userId, writerId ],
        createdAt: new Date()
      });

    }
    // console.log(req.user.username)
    res.redirect('/chat/list')
  })

router.get('/list', checkLogin, async(req, res)=>{
    let result = await db.collection('chatroom').find({
        member: req.user._id
    }).toArray()
    console.log(result)
    res.render('chatList.ejs',{rooms:result})
})

router.get('/detail/:id', checkLogin, async(req, res)=>{

    // console.log(req.user)
    let room = await db.collection('chatroom').findOne({
        _id: new ObjectId(req.params.id)
    })
    if(req.user._id.toString() == room.member[0] || req.user._id.toString() == room.member[1]){
        res.render('chatDetail.ejs',{
            room: room,
            
        })
    }
    else{
        res.send('접속불가')
    }
})

router.get('/messages', checkLogin, async (req, res) => {
    try {
      const roomId = new ObjectId(req.query.roomId);
      const messages = await db.collection('messages')
        .find({ roomId: roomId })
        .sort({ sentAt: 1 })
        .toArray();
        console.log(messages)
      res.json(messages); // 반드시 JSON 응답을 보냅니다.
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: '메시지 불러오기 실패' });
    }
  });

module.exports = router
