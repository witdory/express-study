// config/passport.js
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
const NaverStrategy = require('passport-naver-v2').Strategy;
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
      if (!result) return done(null, false, { message: '존재하지 않는 ID입니다.' });
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
        const profileImage = profile._json?.kakao_account?.profile?.profile_image_url || null;
        // console.log(profile)
        // console.log(profileImage)
        // const email = profile._json?.kakao_account?.email
        let user = await db.collection('user').findOne({kakaoId});

        if(!user){
          user = {
            kakaoId,
            username,
            profileImage,
            role: 'user',
            provider: 'kakao',
            createdAt: new Date()
          }
          const insertResult = await db.collection('user').insertOne(user);
          user._id = insertResult.insertedId
        }
        else{
          await db.collection('user').updateOne(
            {_id : user._id},
            {$set: {username, profileImage}}
          );
        }
        return done(null, user);
      } catch(err){
        return done(err);
      }
    }
  ))

  // const naverClientID = process.env.NAVER_CLIENT_ID;
  // const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
  // const naverCallbackURL = process.env.NAVER_CALLBACK_URL;

  // passport.use(new NaverStrategy({
  //   clientID: naverClientID,
  //   clientSecret: naverClientSecret,
  //   callbackURL: naverCallbackURL,
  // },
  // async (accessToken, refreshToken, profile, done) => {
  //     try {
  //         // profile에는 네이버에서 받은 사용자 정보가 담겨있음
  //         const naverId = profile.id;
  //         const username = profile.displayName || profile.username;
  //         const email = profile.emails?.[0]?.value || null;
  //         const profileImage = profile.profileImage || null;  // profileImage 필드가 추가되어 있음

  //         // DB에 유저 있는지 찾기
  //         let user = await db.collection('user').findOne({ naverId });

  //         // 없으면 새로 생성
  //         if (!user) {
  //             user = {
  //                 naverId,
  //                 username,
  //                 email,
  //                 profileImage,
  //                 role: 'user',
  //                 provider: 'naver',
  //                 createdAt: new Date()
  //             };
  //             const insertResult = await db.collection('user').insertOne(user);
  //             user._id = insertResult.insertedId;
  //         }

  //         // 성공
  //         return done(null, user);
  //     } catch (err) {
  //         return done(err);
  //     }
  // }));

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
