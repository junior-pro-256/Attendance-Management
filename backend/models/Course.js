const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Course = sequelize.define('Course', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(30), allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  // Every course unit is created by the administrator inside a Program (e.g. a course
  // unit under "Software Engineering"). allowNull stays true only so existing rows from
  // before this field existed do not break sync; adminController.createCourse always
  // requires a programId for newly-created course units.
  programId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'programs', key: 'id' },
    onDelete: 'cascade', // deleting a program deletes its course units too
    onUpdate: 'cascade'
  },
  //  course unit is created by the administrator and can then be selected by one lecturer.
  //  allowNull is true because a newly-created course unit has no lecturer until one
  //  chooses it (or the admin assigns one) — see adminController.createCourse.
  lecturerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'restrict', // prevent deletion of lecturer if assigned to a course
    onUpdate: 'cascade' // update lecturerId if the lecturer's id changes
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'courses', indexes: [
  { unique: false, fields: ['code'] }, { fields: ['lecturerId'] }, { fields: ['programId'] }
] });

module.exports = Course;
