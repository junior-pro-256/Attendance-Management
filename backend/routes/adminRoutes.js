const express=require('express'); const router=express.Router(); const auth=require('../middleware/auth'); const {requireRole}=require('../middleware/auth'); const a=require('../controllers/adminController');
router.use(auth,requireRole('admin'));
router.get('/dashboard',a.dashboard);
router.get('/users',a.users);

// Programs (e.g. Software Engineering) — admin adds/deletes programs and adds course units inside them.
router.get('/programs',a.programs);
router.post('/programs',a.createProgram);
router.put('/programs/:programId',a.updateProgram);
router.delete('/programs/:programId',a.deleteProgram);
router.post('/programs/:programId/courses',a.createCourse);

router.get('/courses',a.courses);
router.put('/courses/:courseId',a.updateCourse);
router.delete('/courses/:courseId',a.deleteCourse);
router.post('/courses/:courseId/assign',a.assignCourse);
router.post('/courses/:courseId/unassign',a.unassignCourse);
router.get('/courses/:courseId/lectures',a.courseLectures);

router.get('/attendance/students',a.studentAttendance);
router.put('/attendance/students/:id',a.updateStudentAttendance);
router.get('/attendance/lecturers',a.lecturerAttendance);
router.post('/attendance/lecturers',a.updateLecturerAttendance);
module.exports=router;
