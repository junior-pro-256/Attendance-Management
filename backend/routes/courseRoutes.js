const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const c = require('../controllers/courseController');

router.get('/available', auth, requireRole('student'), c.allCourses);
router.post('/enroll-all', auth, requireRole('student'), c.enrollAll);
router.post('/enroll/:courseId', auth, requireRole('student'), c.enrollCourse);
router.get('/my', auth, requireRole('student'), c.studentCourses);

router.get('/lecturer', auth, requireRole('lecturer'), c.lecturerCourses);
// Course creation is administrator-only. Lecturer course selection is exposed in lecturerRoutes.
router.get('/lecturer/:courseId/students', auth, requireRole('lecturer'), c.courseStudents);

module.exports = router;
