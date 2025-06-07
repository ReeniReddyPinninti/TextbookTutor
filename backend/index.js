const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/rag-users");

const User = mongoose.model("User", new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
}));

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await User.create({ username, email, password: hashed });
    res.sendStatus(201);
  } catch (err) {
    res.status(400).send("User already exists");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).send("Invalid");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).send("Invalid");

  const token = jwt.sign({ id: user._id }, "secretkey");
  res.json({ token, username: user.username });
});

app.listen(5001, () => console.log("Auth server running on port 5001"));
