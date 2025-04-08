// routes/auth.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const checkLogin = require('../middlewares/checkLogin'); // (checkLogin 미들웨어도 따로 파일로 분리)
const session = require('express-session');
require('dotenv').config()

const passport = require('passport')
const bcrypt = require('bcrypt')

router.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000*60*60
    }
}));


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

router.get('/kakao', (req, res, next)=>{
    if (req.query.redirect){
        req.session.redirectTo = req.query.redirect
    }
    console.log('req.query: ')
    console.log(req.query)
    passport.authenticate('kakao')(req, res, next)
    
})
router.get('/kakao/callback',(req, res, next)=>{
    // passport.authenticate('kakao', {
    //     failureRedirect: '/login',
    //     successRedirect: '/auth/mypage'
    // })
    console.log(req.session)
    passport.authenticate('kakao', (err, user, info)=>{
        if (err) return next(err);
        if (!user) return res.redirect('/login');

        const redirectTo = req.session.redirectTo || '/auth/mypage';
        //req.logIn하면서 req.session 객체가 부분만 갱신되는게 아니라 전체가 교체되기 때문에 미리 저장장
        delete req.session.redirectTo;

        req.logIn(user, (err) => {
            if (err) return next(err);
            res.redirect(redirectTo);
        });
    })(req, res, next)
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
        password: hash,
        provider: 'local',
        createdAt: new Date()
        })
        res.redirect('/post/list')
    }


})



module.exports = router
