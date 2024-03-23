const mongoose = require("mongoose");
const { partyChatSchema } = require("../schema");
const partyChatModel = mongoose.model("partyChat", partyChatSchema);
module.exports = partyChatModel;
