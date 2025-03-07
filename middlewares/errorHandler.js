// middlewares/errorHandler.js
module.exports = (err, req, res, next) => {
    console.error(err.stack);
    
    // err.status가 설정되어 있으면 해당 상태코드 사용, 없으면 기본 500으로 처리
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: err.message || '서버 내부 오류 발생'
    });
  };