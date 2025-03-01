// socket/chatSocket.js
const { ObjectId } = require('mongodb');

module.exports = (io, db) => {
  io.on('connection', (socket) => {
    socket.on('age', (data) => {
      console.log('유저가 보낸 데이터: ', data);
      io.emit('name', 'kim');
    });

    socket.on('ask-join', (data) => {
      socket.join(data);
    });

    socket.on('message-send', async (data) => {
      await db.collection('messages').insertOne({
        roomId: new ObjectId(data.room),
        msg: data.msg,
        user: new ObjectId(data.user),
        sentAt: data.sentAt,
      });
      io.to(data.room).emit('message-broadcast', {
        msg: data.msg,
        user: data.user,
        sentAt: data.sentAt,
      });
      console.log(data);
    });
  });
};
