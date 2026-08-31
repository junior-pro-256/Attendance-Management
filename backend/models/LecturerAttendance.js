const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LecturerAttendance = sequelize.define('LecturerAttendance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lecturerId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('Present', 'Absent', 'Late'), allowNull: false, defaultValue: 'Present' },
  notes: { type: DataTypes.STRING(255), allowNull: true }
}, { tableName: 'lecturer_attendance', indexes: [
  { unique: true, fields: ['lecturerId', 'date'], name: 'unique_lecturer_attendance_day' },
  { fields: ['date'] }
] });

module.exports = LecturerAttendance;
