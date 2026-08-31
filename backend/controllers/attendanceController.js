const { Op } = require('sequelize');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lecture = require('../models/Lecture');

function pct(attended, total) {
  return total ? Math.round((attended / total) * 10000) / 100 : 0;
}

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Kampala';
function currentDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function currentTimeHM(now) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}
function currentDayOfWeek(now) {
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'long' }).format(now);
}

async function markStudentAttendance(req, res) {
  try {
    const rawLectureId = req.body?.lectureId;
    const lectureId = Number(rawLectureId);
    if (!Number.isInteger(lectureId) || lectureId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid lectureId is required.' });
    }

    const lecture = await Lecture.findByPk(lectureId, { include: [{ model: Course, as: 'course' }] });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found.' });

    const enrolled = await Enrollment.findOne({ where: { studentId: req.user.id, courseId: lecture.courseId } });
    if (!enrolled) return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });

    // The lecture recurs every week on lecture.dayOfWeek. Students may only register
    // attendance while today matches that day and the scheduled lecture is in progress.
    const now = new Date();
    const today = currentDate(now);
    const todayName = currentDayOfWeek(now);
    const currentTime = currentTimeHM(now);
    if (lecture.dayOfWeek !== todayName || currentTime < String(lecture.startTime).slice(0,5) || currentTime >= String(lecture.endTime).slice(0,5)) {
      return res.status(400).json({ success: false, message: `Attendance can only be registered on ${lecture.dayOfWeek}, during the scheduled lecture time (${lecture.startTime} - ${lecture.endTime}).` });
    }

    const existing = await Attendance.findOne({ where: { studentId: req.user.id, lectureId, date: today } });
    if (existing) return res.status(400).json({ success: false, message: 'Attendance has already been recorded for this lecture.' });

    // A student may not attend two overlapping lectures on the same day.
    const sameDay = await Attendance.findAll({
      where: { studentId: req.user.id, date: today, lectureId: { [Op.ne]: null } },
      include: [{ model: Lecture, as: 'lecture' }]
    });
    const overlaps = sameDay.some(a =>
      a.lecture && a.lecture.startTime < lecture.endTime && a.lecture.endTime > lecture.startTime
    );
    if (overlaps) return res.status(400).json({ success: false, message: 'You already have attendance for an overlapping lecture time.' });

    const record = await Attendance.create({
      studentId: req.user.id,
      registrationNumber: req.user.registrationNumber,
      courseId: lecture.courseId,
      lectureId: lecture.id,
      lecturerId: lecture.course.lecturerId,
      date: today,
      status: 'Present',
      checkInTime: new Date()
    });
    res.status(201).json({ success: true, message: 'Attendance marked successfully.', data: record });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ success: false, message: 'Attendance already exists for this lecture.' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Could not mark attendance.' });
  }
}

async function studentRecords(req, res) {
  const records = await Attendance.findAll({
    where: { studentId: req.user.id },
    include: [
      { model: Course, as: 'course', attributes: ['id', 'code', 'name'] },
      { model: Lecture, as: 'lecture', attributes: ['id', 'dayOfWeek', 'startTime', 'endTime'] }
    ],
    order: [['date', 'DESC'], ['checkInTime', 'DESC']]
  });
  res.json({ success: true, data: records });
}

async function availableLectures(req, res) {
  const rows = await Enrollment.findAll({
    where: { studentId: req.user.id },
    include: [{ model: Course, as: 'course', include: [{ model: Lecture, as: 'lectures' }, { model: User, as: 'lecturer', attributes: ['fullName'] }] }]
  });
  const lectures = [];
  rows.forEach(r => (r.course.lectures || []).forEach(l => lectures.push({
    ...l.toJSON(), course: { id: r.course.id, code: r.course.code, name: r.course.name, lecturer: r.course.lecturer?.fullName }
  })));
  lectures.sort((a,b) => (Lecture.DAYS_OF_WEEK.indexOf(a.dayOfWeek)-Lecture.DAYS_OF_WEEK.indexOf(b.dayOfWeek)) || String(a.startTime).localeCompare(String(b.startTime)));
  res.json({ success: true, data: lectures });
}

async function lecturerLiveAttendance(req, res) {
  const now = new Date();
  const today = currentDate(now);
  const todayName = currentDayOfWeek(now);
  const currentTime = currentTimeHM(now);
  const courseWhere = { lecturerId: req.user.id };
  if (req.query.courseId) courseWhere.id = req.query.courseId;
  const courses = await Course.findAll({ where: courseWhere, attributes:['id','code','name'] });
  const courseIds = courses.map(c => c.id);
  if (!courseIds.length) return res.json({ success:true, data:[], active:false, message:'You have no selected course units.' });

  const lectures = await Lecture.findAll({
    where: { courseId: courseIds, dayOfWeek: todayName, startTime: { [Op.lte]: currentTime }, endTime: { [Op.gt]: currentTime } },
    include: [{ model: Course, as:'course', attributes:['id','code','name'] }]
  });
  if (!lectures.length) return res.json({ success:true, data:[], active:false, message:'No lecture for this course is currently in progress.' });

  const lectureIds = lectures.map(l => l.id);
  const rows = await Attendance.findAll({
    where: { lecturerId:req.user.id, lectureId:lectureIds, date: today },
    include: [
      { model: User, as:'student', attributes:['id','fullName','registrationNumber'] },
      { model: Course, as:'course', attributes:['id','code','name'] },
      { model: Lecture, as:'lecture', attributes:['id','dayOfWeek','startTime','endTime'] }
    ],
    order: [['checkInTime','ASC']]
  });
  res.json({ success:true, active:true, data:rows });
}

async function lecturerAttendance(req, res) {
  const where = { lecturerId: req.user.id };
  if (req.query.courseId) where.courseId = req.query.courseId;
  if (req.query.date) where.date = req.query.date;
  if (req.query.status) where.status = req.query.status;

  const records = await Attendance.findAll({
    where,
    include: [
      { model: User, as: 'student', attributes: ['id', 'fullName', 'registrationNumber'] },
      { model: Course, as: 'course', attributes: ['id', 'code', 'name'] },
      { model: Lecture, as: 'lecture', attributes: ['id', 'startTime', 'endTime'] }
    ],
    order: [['date', 'DESC'], ['id', 'DESC']]
  });
  const data = req.query.studentId ? records.filter(r => String(r.studentId) === String(req.query.studentId)) : records;
  res.json({ success: true, data });
}

async function lectureStudents(req, res) {
  const course = await Course.findOne({ where: { id: req.params.courseId, lecturerId: req.user.id } });
  if (!course) return res.status(403).json({ success: false, message: 'You are not assigned to this course.' });
  const students = await Enrollment.findAll({
    where: { courseId: course.id },
    include: [{ model: User, as: 'student', attributes: ['id', 'fullName', 'registrationNumber'] }],
    order: [[{ model: User, as: 'student' }, 'fullName', 'ASC']]
  });
  res.json({ success: true, data: students.map(x => x.student) });
}

async function lecturerReports(req, res) {
  const courseWhere = { lecturerId: req.user.id };
  if (req.query.courseId) courseWhere.id = req.query.courseId;
  const courses = await Course.findAll({ where: courseWhere });
  const courseIds = courses.map(c => c.id);
  const records = courseIds.length ? await Attendance.findAll({ where: { lecturerId: req.user.id, courseId: courseIds } }) : [];

  const reports = courses.map(c => {
    const rows = records.filter(r => r.courseId === c.id);
    const attended = rows.filter(r => r.status !== 'Absent').length;
    return { courseId: c.id, courseCode: c.code, courseName: c.name, totalRecords: rows.length, attended, absent: rows.filter(r => r.status === 'Absent').length, late: rows.filter(r => r.status === 'Late').length, attendancePercentage: pct(attended, rows.length) };
  });
  res.json({ success: true, data: reports });
}

async function studentStatistics(req, res) {
  const rows = await Attendance.findAll({ where: { studentId: req.user.id }, include: [{ model: Course, as: 'course', attributes: ['id', 'code', 'name'] }] });
  const groups = {};
  for (const r of rows) {
    const key = r.courseId || 'legacy';
    groups[key] ||= { course: r.course ? r.course.toJSON() : { name: 'Legacy Attendance' }, present: 0, absent: 0, late: 0 };
    groups[key][r.status.toLowerCase()]++;
  }
  const data = Object.values(groups).map(g => ({ ...g, totalClasses: g.present + g.absent + g.late, attendancePercentage: pct(g.present + g.late, g.present + g.absent + g.late) }));
  const total = rows.length;
  const attended = rows.filter(r => r.status !== 'Absent').length;
  res.json({ success: true, data: { overall: { present: rows.filter(r=>r.status==='Present').length, absent: rows.filter(r=>r.status==='Absent').length, late: rows.filter(r=>r.status==='Late').length, totalClasses: total, attendancePercentage: pct(attended, total) }, courses: data } });
}

async function lecturerDashboard(req, res) {
  const courses = await Course.findAll({ where: { lecturerId: req.user.id } });
  const courseIds = courses.map(c => c.id);
  const students = courseIds.length ? await Enrollment.count({ distinct: true, col: 'studentId', where: { courseId: courseIds } }) : 0;
  const today = new Date().toISOString().slice(0,10);
  const todayRows = courseIds.length ? await Attendance.count({ where: { lecturerId: req.user.id, date: today } }) : 0;
  const allRows = courseIds.length ? await Attendance.findAll({ where: { lecturerId: req.user.id, courseId: courseIds } }) : [];
  const attended = allRows.filter(r => r.status !== 'Absent').length;
  res.json({ success: true, data: { lecturer: req.user, assignedCourses: courses.length, students, todayAttendance: todayRows, overallAttendancePercentage: pct(attended, allRows.length) } });
}

module.exports = { markStudentAttendance, studentRecords, availableLectures, lecturerLiveAttendance, lecturerAttendance, lectureStudents, lecturerReports, studentStatistics, lecturerDashboard };
