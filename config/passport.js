// config/passport.js
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

module.exports = (db) => {
  passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
  }, 
    async (userId, userPassword, done) => {
    try {
      const result = await db.collection('user').findOne({ username: userId });
      if (!result) return done(null, false, { message: '아이디 DB에 없음' });
      const match = await bcrypt.compare(userPassword, result.password);
      if (!match) return done(null, false, { message: '비밀번호 불일치' });
      return done(null, result);
    } catch (err) {
      return done(err);
    }
  }));

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
