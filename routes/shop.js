const router = require('express').Router()



let db
let connectDB = require('./../database.js')

connectDB.then((client)=>{
  db = client.db('forum')
  
}).catch((err)=>{
  console.log(err)
})


router.get('/shirts', async(req, res)=>{
    let result = await db.collection('post').find().toArray()
    // console.log(result)
    res.send('셔츠판매')
})
router.get('/pants', (req, res)=>{
    res.send('바지판매')
})



module.exports = router
