// routes/post.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const checkLogin = require('../middlewares/checkLogin'); // (checkLogin 미들웨어도 따로 파일로 분리)

require('dotenv').config()


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




// DB 연결은 어떻게?
// - 현재 server.js에서 db를 전역 변수로 관리하고 있으니, 임시로 require 해서 써도 되고,
//   별도의 db.js(혹은 database.js)에서 client를 export 받아도 됩니다.

let db
let connectDB = require('./../database.js')

connectDB.then((client)=>{
  db = client.db('forum')
  
}).catch((err)=>{
  console.log(err)
})

// const checkLogin = require('./../checkLogin.js')












// /list
router.get('/list', async (req, res) => {
  // 원래 server.js에서 하던 로직 그대로
  // let result = await db.collection('post').find().sort({ createdAt: -1 }).toArray();
  // res.render('list.ejs', { posts: result, user: req.user });
  // ...
  res.redirect('/post/list/1');
});

// /list/:page
router.get('/list/:page', async (req, res) => {
    let page = parseInt(req.params.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
  
    const totalCount = await db.collection('post').countDocuments();
    const totalPages = Math.ceil(totalCount / limit);
  
    let result = await db
      .collection('post')
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  
    res.render('list.ejs', {
      posts: result,
      user: req.user,
      currentPage: page,
      totalPages: totalPages
    });
  });

// /detail/:id
router.get('/detail/:id', async (req, res) => {
  try {
    let post = await db.collection('post').findOne({ _id: new ObjectId(req.params.id) });
    if (!post) return res.send('게시글이 존재하지 않습니다.');

    // 조회수 증가
    await db.collection('post').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { viewCount: 1 } }
    );

    let comments = await db
      .collection('comment')
      .find({ parentId: new ObjectId(req.params.id) })
      .toArray();

    res.render('detail.ejs', {
      post: post,
      comments: comments,
      user: req.user,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send('url 오류');
  }
});

// /write
router.get('/write', checkLogin, (req, res) => {
  res.render('write.ejs');
});

// /newpost
router.post('/newpost', checkLogin, async (req, res) => {
  // 만약 업로드가 있다면:
  upload.single('img1')(req, res, async (err) => {
    if (err) return res.send('업로드 에러');

    try {
      if (req.body.title === '') {
        return res.send('제목을 입력하세요');
      }

      let newPost = {
        title: req.body.title,
        content: req.body.content,
        createdAt: new Date(),
        user: req.user._id,
        username: req.user.username,
        viewCount: 0,
        like:0,
        dislike:0
      };

      // 이미지가 있다면 img 필드 추가
      if (req.file) {
        newPost.img = req.file.location;
      }

      await db.collection('post').insertOne(newPost);
      console.log('글 작성 성공');
      res.redirect('/post/list');
    } catch (e) {
      console.log(e);
      res.status(500).send('서버 에러 발생');
    }
  });
});

// /edit/:id
router.get('/edit/:id', checkLogin, async (req, res) => {
  try {
    let result = await db.collection('post').findOne({ _id: new ObjectId(req.params.id) });
    if (!result) {
      return res.send('url 입력 오류');
    }
    if (result.user.toString() !== req.user._id.toString()) {
      return res.send('작성자만 수정할 수 있습니다');
    }
    res.render('edit.ejs', { post: result });
  } catch (e) {
    console.log(e);
    res.status(500).send('url 오류');
  }
});

// /edit/:id (POST)
router.post('/edit/:id', checkLogin, async (req, res) => {
  try {
    if (req.body.title === '') {
      return res.send('제목을 입력하세요');
    }
    await db.collection('post').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title: req.body.title, content: req.body.content } }
    );
    res.redirect('/post/detail/' + req.params.id);
  } catch (e) {
    console.log(e);
    res.status(500).send('서버 에러 발생');
  }
});

// /api/posts (DELETE)
router.delete('/api/posts', checkLogin, async (req, res) => {
  try {
    await db.collection('post').deleteOne({
      _id: new ObjectId(req.query.postid),
      user: new ObjectId(req.user._id),
    });
    console.log('삭제됨');
    res.send('삭제완료');
  } catch (e) {
    console.log(e);
    res.status(500).send('서버 에러 발생');
  }
});

router.post('/comment', async (req, res)=>{
  console.log(req)
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
    res.redirect('/post/detail/'+req.query.parent)
  }
  else{
    res.redirect('/login')
  }
})

router.post('/detail/:id/like', checkLogin,  async(req, res)=>{
  await db.collection('post').updateOne(
    {_id: new ObjectId(req.params.id)},
    {$inc: {like:1}}
  )
  // let result = await db.collection('post').findOne({
  //   _id:new ObjectId(req.params.id)
  // })
  // console.log(result)
  res.redirect('/post/detail/'+req.params.id)
})

router.post('/detail/:id/dislike', checkLogin,  async(req, res)=>{
  await db.collection('post').updateOne(
    {_id: new ObjectId(req.params.id)},
    {$inc: {dislike:1}}
  )
  // let result = await db.collection('post').findOne({
  //   _id:new ObjectId(req.params.id)
  // })
  // console.log(result)
  res.redirect('/post/detail/'+req.params.id)
})


module.exports = router;
