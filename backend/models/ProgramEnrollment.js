const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Records that a student has enrolled in a Program. Course-level Enrollment rows
// (see Enrollment.js) are created automatically for every course unit under the
// program at the moment of program enrollment, and again whenever the
// administrator later adds a new course unit to a program the student is already
// enrolled in — so "enrolled in the program" always implies "enrolled in every
// course unit under it".
const ProgramEnrollment = sequelize.define('ProgramEnrollment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  programId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'program_enrollments',
  indexes: [{ unique: true, fields: ['studentId', 'programId'], name: 'unique_student_program' }]
});

module.exports = ProgramEnrollment;
