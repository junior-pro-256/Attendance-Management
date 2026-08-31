const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  registrationNumber: { type: DataTypes.STRING(50), allowNull: true, unique: true,
    validate: { is: { args: /^[A-Za-z0-9]+(\/[A-Za-z0-9]+)+$/, msg: 'Registration number must be slash-separated.' } } },
  lecturerId: { type: DataTypes.STRING(50), allowNull: true, unique: true },
  fullName: { type: DataTypes.STRING(150), allowNull: false, defaultValue: 'Attendance Management System User' },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM('student', 'lecturer', 'admin'), allowNull: false, defaultValue: 'student' }
}, { tableName: 'users', indexes: [
  { unique: true, fields: ['email'] }, { unique: true, fields: ['registrationNumber'] },
  { unique: true, fields: ['lecturerId'] }, { fields: ['role'] }
] });

module.exports = User;
