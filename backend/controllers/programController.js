const Program = require('../models/Program');
const Course = require('../models/Course');
const User = require('../models/User');
const ProgramEnrollment = require('../models/ProgramEnrollment');
const Enrollment = require('../models/Enrollment');

async function availablePrograms(req, res) {
  const programs = await Program.findAll({
    where: { isActive: true },
    include: [{ model: Course, as: 'courses', where: { isActive: true }, required: false, include: [{ model: User, as: 'lecturer', attributes: ['id', 'fullName', 'lecturerId'] }] }],
    order: [['name', 'ASC']]
  });
  res.json({ success: true, data: programs });
}

// Enrolling in a Program automatically enrolls the student in every course unit
// that currently belongs to it. If the administrator adds more course units to
// the program later, adminController.createCourse enrolls already-enrolled
// students into those automatically too.
async function enrollProgram(req, res) {
  try {
    const program = await Program.findOne({ where: { id: req.params.programId, isActive: true } });
    if (!program) return res.status(404).json({ success: false, message: 'Program not found.' });

    const [, created] = await ProgramEnrollment.findOrCreate({ where: { studentId: req.user.id, programId: program.id } });

    const courses = await Course.findAll({ where: { programId: program.id, isActive: true }, attributes: ['id'] });
    let added = 0;
    for (const course of courses) {
      const [, wasCreated] = await Enrollment.findOrCreate({ where: { studentId: req.user.id, courseId: course.id } });
      if (wasCreated) added++;
    }

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? `Enrolled in ${program.name}. ${added} course unit(s) under it were enrolled automatically.` : `You are already enrolled in ${program.name}.`,
      data: { programId: program.id, coursesEnrolled: added }
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
}

async function myPrograms(req, res) {
  const rows = await ProgramEnrollment.findAll({
    where: { studentId: req.user.id },
    include: [{ model: Program, as: 'program', include: [{ model: Course, as: 'courses' }] }],
    order: [[{ model: Program, as: 'program' }, 'name', 'ASC']]
  });
  res.json({ success: true, data: rows.map(r => r.program) });
}

module.exports = { availablePrograms, enrollProgram, myPrograms };
