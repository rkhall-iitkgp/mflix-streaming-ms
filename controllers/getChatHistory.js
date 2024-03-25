// get chat history of a particular room from the partyChatSchema

const { partyChatModel } = require("../models/partyChatModel");

async function getChatHistory(req, res) {
  try {
    const data = req.query;
    const roomId = data.query;
    console.log(roomId);

    if(!roomId) {
      return res.status(400).json({
        message: "Invalid request"
      })
    }

    const chatHistory = await partyChatModel.findOne({ roomId });

    if(!chatHistory) {
      return res.status(404).json({
        message: "Chat history not found"
      })
    }

    return res.status(200).json(chatHistory)
    
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error"
    })
  }
}

module.exports = getChatHistory;
