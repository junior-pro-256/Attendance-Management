const { Op } = require('sequelize');
const Course = require('../models/Course');
const User = require('../models/User');
const Lecture = require('../models/Lecture');

async function availableCourseUnits(req,res){
  const rows=await Course.findAll({where:{isActive:true,lecturerId:null},order:[['name','ASC']]});
  res.json({success:true,data:rows});
}
async function chooseCourse(req,res){
  const course=await Course.findOne({where:{id:req.params.courseId,isActive:true}});
  if(!course)return res.status(404).json({success:false,message:'Course unit not found.'});
  if(course.lecturerId && course.lecturerId!==req.user.id)return res.status(409).json({success:false,message:'This course unit has already been chosen by another lecturer.'});
  course.lecturerId=req.user.id; await course.save();
  res.json({success:true,message:'Course unit selected successfully.',data:course});
}
async function dashboard(req,res){
  const courses=await Course.findAll({where:{lecturerId:req.user.id}}); const ids=courses.map(c=>c.id);
  const Enrollment=require('../models/Enrollment'); const Attendance=require('../models/Attendance');
  const students=ids.length?await Enrollment.count({distinct:true,col:'studentId',where:{courseId:ids}}):0;
  const rows=ids.length?await Attendance.findAll({where:{courseId:ids,lecturerId:req.user.id}}):[];
  const attended=rows.filter(r=>r.status!=='Absent').length;
  res.json({success:true,data:{lecturer:req.user,assignedCourses:courses.length,students,todayAttendance:rows.filter(r=>r.date===new Date().toISOString().slice(0,10)).length,overallAttendancePercentage:rows.length?Math.round(attended/rows.length*10000)/100:0}});
}

// A "lesson" is a weekly lecture time slot the lecturer posts for a course unit they
// teach. Once posted, enrolled students see it under Attend Lecture and attendance is
// taken automatically the moment a student joins during the scheduled time — unchanged
// from how attendance already worked.
async function courseLectures(req,res){
  const course=await Course.findOne({where:{id:req.params.courseId,lecturerId:req.user.id}});
  if(!course)return res.status(403).json({success:false,message:'You are not assigned to this course.'});
  const lectures=await Lecture.findAll({where:{courseId:course.id}});
  lectures.sort((a,b)=>Lecture.DAYS_OF_WEEK.indexOf(a.dayOfWeek)-Lecture.DAYS_OF_WEEK.indexOf(b.dayOfWeek)||String(a.startTime).localeCompare(String(b.startTime)));
  res.json({success:true,data:lectures});
}
async function postLesson(req,res){
  try{
    const course=await Course.findOne({where:{id:req.params.courseId,lecturerId:req.user.id}});
    if(!course)return res.status(403).json({success:false,message:'You are not assigned to this course.'});
    const {dayOfWeek,startTime,endTime}=req.body;
    if(!Lecture.DAYS_OF_WEEK.includes(dayOfWeek))return res.status(400).json({success:false,message:'Select a valid day of the week (Monday to Sunday).'});
    if(!startTime||!endTime||startTime>=endTime)return res.status(400).json({success:false,message:'Valid start time and end time are required.'});
    // The lesson repeats every week on this day, so conflicts are checked per day of week, not per calendar date.
    const conflict=await Lecture.findOne({where:{courseId:course.id,dayOfWeek,[Op.or]:[{startTime:{[Op.lt]:endTime},endTime:{[Op.gt]:startTime}}]}});
    if(conflict)return res.status(400).json({success:false,message:'Another lesson already overlaps this time on that day.'});
    const lecture=await Lecture.create({courseId:course.id,dayOfWeek,startTime,endTime});
    res.status(201).json({success:true,message:'Lesson posted. Enrolled students can now attend, and attendance is taken automatically when they join.',data:lecture});
  }catch(e){console.error(e);res.status(400).json({success:false,message:e.message})}
}
async function deleteLesson(req,res){
  const lecture=await Lecture.findByPk(req.params.lectureId,{include:[{model:Course,as:'course'}]});
  if(!lecture||!lecture.course||lecture.course.lecturerId!==req.user.id)return res.status(403).json({success:false,message:'You are not authorized to remove this lesson.'});
  await lecture.destroy();
  res.json({success:true,message:'Lesson removed.'});
}

module.exports={availableCourseUnits,chooseCourse,dashboard,courseLectures,postLesson,deleteLesson};
