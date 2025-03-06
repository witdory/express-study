const checkLogin = (req, res, next) =>{
    // if(!req.user){
    //   return res.redirect('/login')
    // }
    if (!req.user) {
      return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    // if (!req.user) {
    //   req.session.redirectTo = req.originalUrl;
    //   return res.redirect('/login');
    // }
    next()
  }

module.exports = checkLogin;
