// get chat history of a particular room from the partyChatSchema

const { partyChatModel } = require("../../models");

async function getChatHistory(req, res) {
  try {
    const { data } = req.body;

    const roomId = data.roomId

    const agg = {
        // get messages corresponding to roomId
        
    }
    
  } catch (error) {
    
  }
}

module.exports = AutoComplete;