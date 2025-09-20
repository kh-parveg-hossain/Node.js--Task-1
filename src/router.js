import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"; 
import nodemailer from "nodemailer";
import randomstring from "randomstring";
import dotenv from "dotenv";
dotenv.config();
import { User } from "./model.js";


const router = express.Router();


// get all users

/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: Check server status
 *     description: Returns a message if server is running
 *     responses:
 *       200:
 *         description: Server is working
 */

router.get("/user", async(req, res) => {
  try{
    const user = await User.find();
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: User already exists
 */



// 1.1 Register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // check if user exists
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create user
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    // generate JWT token
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "User created successfully",
      user: { id: newUser._id, username: newUser.username, email: newUser.email },
      token, // ✅ send token in response
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns user info and JWT token
 *       401:
 *         description: Invalid username or password
 */

// 1.2 Login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, username: user.username, email: user.email },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// --- nodemailer transporter (Gmail example) ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail app password
  },
});

/**
 * @swagger
 * /api/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset email sent successfully
 *       404:
 *         description: User not found
 */

// 1.3 Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // generate random reset string
    const resetString = randomstring.generate(20);

    // create JWT token with reset string
    const resetToken = jwt.sign(
      { email: user.email, reset: resetString },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // store reset token in DB
    user.resetToken = resetToken;
    await user.save();

    // create reset link
    const resetLink = `http://localhost:4000/api/reset-password/${resetToken}`;

    // send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset Request",
      text: `Click the link to reset your password: ${resetLink}`,
    });

    res.status(200).json({ message: "Reset email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
/**
 * @swagger
 * /api/reset-password/{token}:
 *   post:
 *     summary: Reset password using token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */

// 1.4 Reset Password

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ email: decoded.email, resetToken: token });
    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    // hash new password
    user.password = await bcrypt.hash(newPassword, 10);

    // remove reset token
    user.resetToken = undefined;

    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Invalid or expired token" });
  }
});



export default router;
