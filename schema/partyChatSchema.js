const mongoose = require("mongoose");

const partyChatSchema = mongoose.Schema({
    roomId: { type: String },
    messages: [
        {
            // username: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
            username: { type: String },
            content: { type: String },
            event: { type: String }
        }
    ]
});

module.exports = partyChatSchema;
