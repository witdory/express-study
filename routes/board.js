const router = require('express').Router()


let db
let connectDB = require('./../database.js')

connectDB.then((client)=>{
  db = client.db('forum')
  
}).catch((err)=>{
  console.log(err)
})

const checkLogin = require('./../middlewares/checkLogin.js')

router.get('/sub/sports', checkLogin, (req, res) => {
    res.send('스포츠 게시판')
})
router.get('/sub/game', checkLogin, (req, res) => {
    res.send('게임 게시판')
}) 

module.exports = router
