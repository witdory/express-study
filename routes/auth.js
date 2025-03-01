// routes/auth.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const checkLogin = require('../middlewares/checkLogin'); // (checkLogin 미들웨어도 따로 파일로 분리)

require('dotenv').config()

const passport = require('passport')




let db
let connectDB = require('./../database.js')

connectDB.then((client)=>{
  db = client.db('forum')
//   require('./../config/passport')(db);
  
}).catch((err)=>{
  console.log(err)
})


router.get('/login', async (req, res) => {
    // console.log(req.user)
    res.render('login.ejs',{ redirect: req.query.redirect || '' })
  })  
  
  
router.post('/login', async (req, res, next) => {
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

router.get('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');  // 로그아웃 후 원하는 페이지로 리다이렉션
    });
});

router.get('/mypage', checkLogin, async (req, res) => {
    // console.log(req.user)
    res.render('mypage.ejs',{user: req.user})

})  

router.get('/register',(req, res)=>{
    res.render('register.ejs')
})

router.post('/register',async (req, res)=>{

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



module.exports = router
