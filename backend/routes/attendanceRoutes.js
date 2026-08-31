const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const a = require('../controllers/attendanceController');

router.post('/mark', auth, requireRole('student'), a.markStudentAttendance);
router.get('/my-records', auth, requireRole('student'), a.studentRecords);
router.get('/my-lectures', auth, requireRole('student'), a.availableLectures);
router.get('/my-statistics', auth, requireRole('student'), a.studentStatistics);

router.get('/lecturer/live', auth, requireRole('lecturer'), a.lecturerLiveAttendance);
router.get('/lecturer/history', auth, requireRole('lecturer'), a.lecturerAttendance);
router.get('/lecturer/courses/:courseId/students', auth, requireRole('lecturer'), a.lectureStudents);
router.get('/lecturer/reports', auth, requireRole('lecturer'), a.lecturerReports);
router.get('/lecturer/dashboard', auth, requireRole('lecturer'), a.lecturerDashboard);

module.exports = router;
