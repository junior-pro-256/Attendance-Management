const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A Program (e.g. "Software Engineering") is created by the administrator.
// Course units are created inside a Program by the administrator, and a
// student who enrolls in a Program is automatically enrolled in every
// course unit that belongs to it (see programController.enrollProgram).
const Program = sequelize.define('Program', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(30), allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'programs',
  indexes: [{ unique: true, fields: ['code'] }]
});

module.exports = Program;
