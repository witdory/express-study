
const { MongoClient } = require("mongodb");

const url = process.env.DB_URL;
const client = new MongoClient(url);

const connectDB = client.connect()
  .then(() => {
    console.log("DB 연결 성공");
    return client;
  })
  .catch((err) => {
    console.error("DB 연결 실패", err);
    process.exit(1);
  });

module.exports = connectDB;
