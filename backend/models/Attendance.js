const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  registrationNumber: { type: DataTypes.STRING(50), allowNull: true },
  courseId: { type: DataTypes.INTEGER, allowNull: true },
  lectureId: { type: DataTypes.INTEGER, allowNull: true },
  lecturerId: { type: DataTypes.INTEGER, allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  checkInTime: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.ENUM('Present', 'Absent', 'Late'), allowNull: false, defaultValue: 'Present' }
}, {
  tableName: 'attendance',
  indexes: [
    { fields: ['studentId'] },
    { fields: ['courseId'] },
    { fields: ['lectureId'] },
    { fields: ['lecturerId'] },
    { fields: ['date'] },
    // Lectures repeat weekly, so a student can register attendance for the same lecture
    // slot again in a later week — uniqueness is per calendar date, not for all time.
    { unique: true, fields: ['studentId', 'lectureId', 'date'], name: 'unique_student_lecture_per_date' }
  ]
});

module.exports = Attendance;
