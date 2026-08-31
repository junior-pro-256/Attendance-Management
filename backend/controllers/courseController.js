const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const Lecture = require('../models/Lecture');

const Program = require('../models/Program');

async function lecturerCourses(req, res) {
  const courses = await Course.findAll({
    where: { lecturerId: req.user.id },
    include: [{ model: User, as: 'lecturer', attributes: ['id', 'fullName', 'email'] }, { model: Program, as: 'program', attributes: ['id', 'code', 'name'] }],
    order: [['name', 'ASC']]
  });
  res.json({ success: true, data: courses });
}

async function createCourse(req, res) {
  return res.status(403).json({ success: false, message: 'Course units are created by the administrator. Choose a course unit from the available list.' });
}

async function enrollCourse(req, res) {
  try {
    const course = await Course.findOne({ where: { id: req.params.courseId, isActive: true } });
    if (!course) return res.status(404).json({ success: false, message: 'Course unit not found.' });
    const [, created] = await Enrollment.findOrCreate({ where: { studentId: req.user.id, courseId: course.id } });
    res.status(created ? 201 : 200).json({ success: true, message: created ? 'Course unit enrolled successfully.' : 'You are already enrolled in this course unit.' });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
}

async function courseStudents(req, res) {
  const course = await Course.findOne({ where: { id: req.params.courseId, lecturerId: req.user.id } });
  if (!course) return res.status(403).json({ success: false, message: 'You are not assigned to this course.' });

  const rows = await Enrollment.findAll({
    where: { courseId: course.id },
    include: [{ model: User, as: 'student', attributes: ['id', 'fullName', 'registrationNumber', 'email'] }],
    order: [[{ model: User, as: 'student' }, 'fullName', 'ASC']]
  });
  res.json({ success: true, data: rows.map(r => r.student) });
}

async function allCourses(req, res) {
  const courses = await Course.findAll({
    where: { isActive: true },
    include: [{ model: User, as: 'lecturer', attributes: ['id', 'fullName', 'lecturerId'] }, { model: Program, as: 'program', attributes: ['id', 'code', 'name'] }],
    order: [['name', 'ASC']]
  });
  res.json({ success: true, data: courses });
}

async function enrollAll(req, res) {
  const courses = await Course.findAll({ where: { isActive: true }, attributes: ['id'] });
  let added = 0;
  for (const course of courses) {
    const [, created] = await Enrollment.findOrCreate({ where: { studentId: req.user.id, courseId: course.id } });
    if (created) added++;
  }
  res.json({ success: true, message: `${added} course unit(s) enrolled successfully.`, data: { enrolled: added, available: courses.length } });
}

async function studentCourses(req, res) {
  const rows = await Enrollment.findAll({
    where: { studentId: req.user.id },
    include: [
      { model: Course, as: 'course', include: [{ model: User, as: 'lecturer', attributes: ['id', 'fullName', 'lecturerId'] }, { model: Program, as: 'program', attributes: ['id', 'code', 'name'] }] }
    ],
    order: [[{ model: Course, as: 'course' }, 'name', 'ASC']]
  });
  res.json({ success: true, data: rows.map(r => r.course) });
}

module.exports = { lecturerCourses, createCourse, enrollCourse, courseStudents, allCourses, enrollAll, studentCourses };
