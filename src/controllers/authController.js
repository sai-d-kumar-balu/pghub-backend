const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(phone);
}

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, phone: user.phone },
    env.jwtSecret,
    { expiresIn: "7d" }
  );
}

async function register(req, res) {
  try {
    const {
      name,
      phone,
      email,
      password,
      role,
      gender,
      profession,
      address,
      emergencyContactName,
      emergencyContactPhone,
    } = req.body;

    const normalizedPhone = normalizePhone(phone);
    const normalizedEmergencyPhone = normalizePhone(emergencyContactPhone);
    const safeRole = role === "OWNER" ? "OWNER" : "USER";

    if (!name || !normalizedPhone || !password) {
      return res.status(400).json({ message: "name, phone and password are required." });
    }
    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ message: "Phone must be 10 digits." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }
    if (email && !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
      return res.status(400).json({ message: "Invalid email format." });
    }
    if (normalizedEmergencyPhone && !isValidPhone(normalizedEmergencyPhone)) {
      return res.status(400).json({ message: "Emergency contact phone must be 10 digits." });
    }

    const existing = await User.findOne({ phone: normalizedPhone });
    if (existing) {
      return res.status(409).json({ message: "Phone already exists." });
    }

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(409).json({ message: "Email already exists." });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      phone: normalizedPhone,
      email: normalizedEmail || undefined,
      passwordHash,
      role: safeRole,
      gender: ["MALE", "FEMALE", "OTHER"].includes(String(gender || "").toUpperCase())
        ? String(gender).toUpperCase()
        : "OTHER",
      profession: String(profession || "").trim() || undefined,
      address: String(address || "").trim() || undefined,
      emergencyContactName: String(emergencyContactName || "").trim() || undefined,
      emergencyContactPhone: normalizedEmergencyPhone || undefined,
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
    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone) || !password) {
      return res.status(400).json({ message: "Phone and password are required." });
    }
    const user = await User.findOne({ phone: normalizedPhone });
    
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
