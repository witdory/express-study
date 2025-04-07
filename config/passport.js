// config/passport.js
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

module.exports = (db) => {
  passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
  }, 
    async (userId, userPassword, done) => {
    try {
      const result = await db.collection('user').findOne({ 
        username: userId,
        provider:'local'
       });
      if (!result) return done(null, false, { message: '아이디 DB에 없음' });
      const match = await bcrypt.compare(userPassword, result.password);
      if (!match) return done(null, false, { message: '비밀번호 불일치' });
      
      return done(null, result);
    } catch (err) {
      return done(err);
    }
  }));

  const clientID = process.env.KAKAO_CLIENT_ID;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  const callbackURL = process.env.KAKAO_CALLBACK_URL;

  passport.use(new KakaoStrategy({
    clientID : clientID,
    clientSecret: clientSecret, // clientSecret을 사용하지 않는다면 넘기지 말거나 빈 스트링을 넘길 것
    callbackURL : callbackURL
  },
    async (accessToken, refreshToken, profile, done) => {
      // 사용자의 정보는 profile에 들어있다.
      
      try {
        const kakaoId = profile.id;
        const username = profile.displayName || profile.username;
        // const email = profile._json?.kakao_account?.email
        let user = await db.collection('user').findOne({kakaoId});

        if(!user){
          user = {
            kakaoId,
            username,
            profider: 'kakao',
            createdAt: new Date()
          }
          const insertResult = await db.collection('user').insertOne(user);
          user._id = insertResult.insertedId
        }
        return done(null, user);
      } catch(err){
        return done(err);
      }
    }
  ))

  passport.serializeUser((user, done) => {
    process.nextTick(() => {
      done(null, { id: user._id, username: user.username });
    });
  });

  passport.deserializeUser(async (user, done) => {
    try {
      const result = await db.collection('user').findOne({ _id: new ObjectId(user.id) });
      if (result) {
        delete result.password;
        process.nextTick(() => done(null, result));
      } else {
        process.nextTick(() => done(null, user));
      }
    } catch (err) {
      process.nextTick(() => done(err));
    }
  });
};
