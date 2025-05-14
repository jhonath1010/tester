/**
 * Author: Jhonatan Lopez Olguin
 * Project: User Authentication Module
 * Description: Handles user registration and login with secure password hashing using bcrypt.
 * Technologies: Node.js, Mongoose, MongoDB, bcrypt.js, dotenv
 * Repository: https://github.com/jhonath1010/web322-app
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Define the user schema for MongoDB
const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    unique: true,
    required: true
  },
  password: String,
  email: String,
  loginHistory: [
    {
      dateTime: Date,
      userAgent: String
    }
  ]
});

let User;

/**
 * Initializes MongoDB connection and sets up the User model.
 * @throws {Error} If connection to MongoDB fails.
 */
async function initialize() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'web322db'
    });
    User = mongoose.model('users', userSchema);
  } catch (err) {
    throw new Error('MongoDB connection error: ' + err.message);
  }
}

/**
 * Registers a new user by hashing their password and saving to the database.
 * @param {Object} userData - Object containing userName, password, password2, and email.
 * @throws {Error} If passwords don't match or user creation fails.
 */
async function registerUser(userData) {
  if (userData.password !== userData.password2) {
    throw new Error('Passwords do not match');
  }

  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser = new User({
      userName: userData.userName,
      password: hashedPassword,
      email: userData.email,
      loginHistory: []
    });

    await newUser.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new Error('User Name already taken');
    } else {
      throw new Error('Error creating the user: ' + err.message);
    }
  }
}

/**
 * Authenticates a user and updates their login history.
 * @param {Object} userData - Object containing userName, password, and userAgent.
 * @returns {Object} The authenticated user object.
 * @throws {Error} If user is not found or password is incorrect.
 */
async function checkUser(userData) {
  const users = await User.find({ userName: userData.userName });

  if (users.length === 0) {
    throw new Error(`Unable to find user: ${userData.userName}`);
  }

  const isMatch = await bcrypt.compare(userData.password, users[0].password);

  if (!isMatch) {
    throw new Error(`Incorrect Password for user: ${userData.userName}`);
  }

  // Add login timestamp and user agent to login history
  users[0].loginHistory.push({
    dateTime: new Date().toString(),
    userAgent: userData.userAgent
  });

  try {
    await User.updateOne(
      { userName: users[0].userName },
      { $set: { loginHistory: users[0].loginHistory } }
    );
    return users[0];
  } catch (err) {
    throw new Error('Error updating login history: ' + err.message);
  }
}

module.exports = {
  initialize,
  registerUser,
  checkUser
};
