const checkLogin = (req, res, next) =>{
    
    if (!req.user) {
      return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    
    next()
  }

module.exports = checkLogin;
