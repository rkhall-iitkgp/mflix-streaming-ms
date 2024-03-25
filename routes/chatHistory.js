const express = require("express");
const { getChatHistory } = require("../controllers");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("hello");
});

router.get("/getChatHistory", getChatHistory);
module.exports = router;
