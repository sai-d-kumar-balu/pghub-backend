const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, phone: user.phone },
    env.jwtSecret,
    { expiresIn: "7d" }
  );
}

async function register(req, res) {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ message: "name, phone and password are required" });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ message: "Phone already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      phone,
      email,
      passwordHash,
      role: role || "USER",
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
        hasAvatar: Boolean(user.avatar?.fileId),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed", error: error.message });
  }
}

async function login(req, res) {
  try {
    const { phone, password } = req.body;
    
    // Use direct MongoDB client to avoid Mongoose buffering in serverless
    const { getDirectConnection } = require("../config/db");
    const { db } = await getDirectConnection();
    
    const user = await db.collection("users").findOne({ phone });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
        hasAvatar: Boolean(user.avatar?.fileId),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
}

module.exports = { register, login };
