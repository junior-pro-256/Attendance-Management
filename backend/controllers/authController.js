const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '5 minutes'; // Adjust as needed for your application

// Only email addresses the administrator has explicitly listed in .env may register
// as a lecturer. This stops a student from simply choosing "Lecturer" on the sign-up
// form — their email has to already be on the list, which only the administrator controls.
function getAllowedLecturerEmails() {
  return (process.env.LECTURER_ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    registrationNumber: user.registrationNumber,
    lecturerId: user.lecturerId,
    email: user.email,
    role: user.role
  };
}

function signToken(user) {
  return jwt.sign(publicUser(user), process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

async function register(req, res) {
  try {
    const { role = 'student', registrationNumber, lecturerId, fullName, email, password } = req.body;
    if (!['student', 'lecturer'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });
    if (!fullName || !email || !password) return res.status(400).json({ success: false, message: 'Full name, email and password are required.' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });

    if (role === 'student' && !registrationNumber) {
      return res.status(400).json({ success: false, message: 'Registration number is required for students.' });
    }
    if (role === 'lecturer' && !lecturerId) {
      return res.status(400).json({ success: false, message: 'Lecturer ID/staff number is required.' });
    }
    if (role === 'lecturer') {
      const allowedLecturerEmails = getAllowedLecturerEmails();
      if (!allowedLecturerEmails.includes(email.trim().toLowerCase())) {
        return res.status(403).json({ success: false, message: 'This email is not authorized to register as a lecturer. Contact your administrator to have your email added.' });
      }
    }

    const emailExists = await User.findOne({ where: { email } });
    if (emailExists) return res.status(400).json({ success: false, message: 'Email already registered.' });

    if (registrationNumber && await User.findOne({ where: { registrationNumber } })) {
      return res.status(400).json({ success: false, message: 'Registration number already registered.' });
    }
    if (lecturerId && await User.findOne({ where: { lecturerId } })) {
      return res.status(400).json({ success: false, message: 'Lecturer ID/staff number already registered.' });
    }

    const user = await User.create({
      fullName,
      email,
      password: await bcrypt.hash(password, SALT_ROUNDS),
      role,
      registrationNumber: role === 'student' ? registrationNumber : null,
      lecturerId: role === 'lecturer' ? lecturerId : null
    });

    res.status(201).json({ success: true, message: 'Registration successful. You can now log in.', data: { user: publicUser(user) } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ success: false, message: error.errors?.[0]?.message || 'Registration failed.' });
  }
}

async function login(req, res) {
  try {
    const { email, emailOrUsername, password, role } = req.body;
    const identifier = (emailOrUsername || email || '').trim();
    if (!identifier || !password) return res.status(400).json({ success: false, message: 'Login identifier and password are required.' });

    // Students must log in with their registration number, lecturers and admins with their email.
    // Which field is checked depends on the login tab the person used on the front end.
    let where;
    if (role === 'student') {
      where = { registrationNumber: identifier, role: 'student' };
    } else if (role === 'lecturer') {
      where = { email: identifier, role: 'lecturer' };
    } else if (role === 'admin') {
      where = { email: identifier, role: 'admin' };
    } else {
      // Fallback for callers that don't specify a role (e.g. direct API use).
      where = { [Op.or]: [{ email: identifier }, { registrationNumber: identifier }, { lecturerId: identifier }] };
    }

    const user = await User.findOne({ where });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      const hint = role === 'student' ? 'registration number' : role === 'lecturer' || role === 'admin' ? 'email' : 'email/username';
      return res.status(401).json({ success: false, message: `Invalid ${hint} or password.` });
    }

    res.json({ success: true, message: 'Login successful.', data: { token: signToken(user), user: publicUser(user) } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong during login.' });
  }
}

async function requestPasswordReset(req, res) {
  try {
    const { emailOrUsername } = req.body;
    if (!emailOrUsername) return res.status(400).json({ success: false, message: 'Email or username is required.' });
    const user = await User.findOne({
      where: { [Op.or]: [{ email: emailOrUsername }, { registrationNumber: emailOrUsername }, { lecturerId: emailOrUsername }] }
    });

    // Always return the same public response to avoid account enumeration.
    if (!user) return res.json({ success: true, message: 'If the account exists, a reset token has been generated.' });

    await PasswordResetToken.destroy({ where: { userId: user.id, usedAt: null } });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await PasswordResetToken.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    // For a real deployment, deliver rawToken through a configured email/SMS provider.
    // It is returned only when RESET_TOKEN_DEV_MODE=true, useful for local testing.
    const data = { expiresInMinutes: 15 };
    if (process.env.RESET_TOKEN_DEV_MODE === 'true') data.devToken = rawToken;
    console.log(`[PASSWORD RESET] ${user.email}: ${rawToken}`);
    res.json({ success: true, message: 'If the account exists, a reset token has been generated.', data });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ success: false, message: 'Unable to process password reset request.' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const reset = await PasswordResetToken.findOne({ where: { tokenHash, usedAt: null } });
    if (!reset || new Date(reset.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token is invalid or expired.' });
    }

    const user = await User.findByPk(reset.userId);
    if (!user) return res.status(400).json({ success: false, message: 'Reset token is invalid.' });

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();
    reset.usedAt = new Date();
    await reset.save();
    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
}

module.exports = { register, login, requestPasswordReset, resetPassword };
