// config/passport.js
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
// const NaverStrategy = require('passport-naver-v2').Strategy; // 필요시 주석 해제
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

module.exports = (db) => {
  // 1. Local Strategy (아이디/비번)
  passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
  },
    async (userId, userPassword, done) => {
      try {
        const result = await db.collection('user').findOne({
          username: userId,
          provider: 'local'
        });
        if (!result) return done(null, false, { message: '존재하지 않는 ID입니다.' });
        const match = await bcrypt.compare(userPassword, result.password);
        if (!match) return done(null, false, { message: '비밀번호 불일치' });

        return done(null, result);
      } catch (err) {
        return done(err);
      }
    }
  ));

  // 2. Kakao Strategy
  passport.use(new KakaoStrategy({
    clientID: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET || '', // 빈 문자열 허용
    callbackURL: process.env.KAKAO_CALLBACK_URL
  },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const kakaoId = profile.id;
        const username = profile.displayName || profile.username;
        const profileImage = profile._json?.kakao_account?.profile?.profile_image_url || null;

        let user = await db.collection('user').findOne({ kakaoId });

        if (!user) {
          user = {
            kakaoId,
            username,
            profileImage,
            role: 'user',
            provider: 'kakao',
            createdAt: new Date()
          }
          const insertResult = await db.collection('user').insertOne(user);
          user._id = insertResult.insertedId;
        } else {
          await db.collection('user').updateOne(
            { _id: user._id },
            { $set: { username, profileImage } }
          );
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  // // 3. Naver Strategy (필요시 주석 해제)
  // passport.use(new NaverStrategy({
  //   clientID: process.env.NAVER_CLIENT_ID,
  //   clientSecret: process.env.NAVER_CLIENT_SECRET,
  //   callbackURL: process.env.NAVER_CALLBACK_URL,
  // },
  //   async (accessToken, refreshToken, profile, done) => {
  //     try {
  //       const naverId = profile.id;
  //       const username = profile.displayName || profile.username;
  //       const email = profile.emails?.[0]?.value || null;
  //       const profileImage = profile.profileImage || null;
  //       let user = await db.collection('user').findOne({ naverId });

  //       if (!user) {
  //         user = {
  //           naverId,
  //           username,
  //           email,
  //           profileImage,
  //           role: 'user',
  //           provider: 'naver',
  //           createdAt: new Date()
  //         };
  //         const insertResult = await db.collection('user').insertOne(user);
  //         user._id = insertResult.insertedId;
  //       }
  //       return done(null, user);
  //     } catch (err) {
  //       return done(err);
  //     }
  //   }
  // ));

  // 4. serializeUser - process.nextTick 제거
  passport.serializeUser((user, done) => {
    console.log("serializeUser 호출됨:", user.username);
    // process.nextTick 제거하고 직접 호출
    done(null, { id: user._id, username: user.username });
  });

  // 5. deserializeUser - process.nextTick 제거
  passport.deserializeUser(async (user, done) => {
    console.log("deserializeUser 호출됨:", user);
    try {
      const result = await db.collection('user').findOne({ _id: new ObjectId(user.id) });
      if (result) {
        delete result.password;
        console.log("deserializeUser 성공:", result.username);
        done(null, result);
      } else {
        console.log("deserializeUser: DB에서 사용자 찾지 못함, 세션 데이터 사용");
        done(null, user);
      }
    } catch (err) {
      console.log("deserializeUser 에러:", err);
      done(err);
    }
  });
};
