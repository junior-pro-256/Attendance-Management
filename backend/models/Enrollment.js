const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Enrollment = sequelize.define('Enrollment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  courseId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'enrollments',
  indexes: [{ unique: true, fields: ['studentId', 'courseId'], name: 'unique_student_course' }]
});

module.exports = Enrollment;
