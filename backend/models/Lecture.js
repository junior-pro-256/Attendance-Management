const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A Lecture is a recurring weekly time slot for a course unit: it repeats on the
// same day every week (Monday through Sunday) rather than a single calendar date.
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Lecture = sequelize.define('Lecture', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  courseId: { type: DataTypes.INTEGER, allowNull: false },
  dayOfWeek: { type: DataTypes.ENUM(...DAYS_OF_WEEK), allowNull: false },
  startTime: { type: DataTypes.TIME, allowNull: false },
  endTime: { type: DataTypes.TIME, allowNull: false },
  // The current lecturer-issued attendance PIN. It is rotated by the server every
  // 15 seconds while the lecture is active, so clients cannot choose or reuse it.
  attendancePin: { type: DataTypes.STRING(4), allowNull: true },
  attendancePinExpiresAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'lectures',
  indexes: [{ fields: ['courseId', 'dayOfWeek'] }]
});

Lecture.DAYS_OF_WEEK = DAYS_OF_WEEK;

module.exports = Lecture;
