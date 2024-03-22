const mongoose = require('mongoose');

const userChatSchema = new mongoose.Schema({
  username: String,
  contend: String,
  roomId: String,
  createdAt: { type: Date, default: Date.now },

});

const Message = mongoose.model('UserChat', userChatSchema);
module.exports = { Message };