const express=require('express'); const router=express.Router(); const auth=require('../middleware/auth'); const {requireRole}=require('../middleware/auth'); const l=require('../controllers/lecturerController');
router.use(auth,requireRole('lecturer'));
router.get('/available-courses',l.availableCourseUnits);
router.post('/choose-course/:courseId',l.chooseCourse);
router.get('/dashboard',l.dashboard);

// A lecturer posts a lesson (weekly time slot) for a course unit they teach.
router.get('/courses/:courseId/lectures',l.courseLectures);
router.post('/courses/:courseId/lectures',l.postLesson);
router.delete('/lectures/:lectureId',l.deleteLesson);
module.exports=router;
