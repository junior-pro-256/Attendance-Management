const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const Course = require('../models/Course');
const Program = require('../models/Program');
const ProgramEnrollment = require('../models/ProgramEnrollment');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const LecturerAttendance = require('../models/LecturerAttendance');
const Lecture = require('../models/Lecture');

const publicUser = u => ({ id:u.id, fullName:u.fullName, email:u.email, role:u.role, registrationNumber:u.registrationNumber, lecturerId:u.lecturerId });
const pct = (a,t) => t ? Math.round((a/t)*10000)/100 : 0;

async function dashboard(req,res){
  const [students, lecturers, programs, courses, attendance, lecturerAttendance] = await Promise.all([
    User.count({where:{role:'student'}}), User.count({where:{role:'lecturer'}}), Program.count(), Course.count(),
    Attendance.count(), LecturerAttendance.count()
  ]);
  const attended = await Attendance.count({where:{status:{[Op.in]:['Present','Late']}}});
  res.json({success:true,data:{students,lecturers,programs,courses,studentAttendance:attendance,lecturerAttendance,overallStudentAttendance:pct(attended,attendance)}});
}

// Programs (e.g. "Software Engineering") are created and deleted by the administrator.
// Course units live inside a program — see createCourse below.
async function createProgram(req,res){
  try{
    const {code,name}=req.body;
    if(!code||!name)return res.status(400).json({success:false,message:'Program code and name are required.'});
    const exists=await Program.findOne({where:{code}}); if(exists)return res.status(400).json({success:false,message:'Program code already exists.'});
    const program=await Program.create({code:code.trim(),name:name.trim(),isActive:true});
    res.status(201).json({success:true,message:'Program created. You can now add course units inside it.',data:program});
  }catch(e){res.status(400).json({success:false,message:e.message})}
}
async function programs(req,res){
  const rows=await Program.findAll({include:[{model:Course,as:'courses',include:[{model:User,as:'lecturer',attributes:['id','fullName','lecturerId']}]}],order:[['name','ASC']]});
  res.json({success:true,data:rows});
}
async function updateProgram(req,res){
  const program=await Program.findByPk(req.params.programId); if(!program)return res.status(404).json({success:false,message:'Program not found.'});
  const {name,isActive}=req.body; if(name!==undefined)program.name=name.trim(); if(isActive!==undefined)program.isActive=!!isActive; await program.save();
  res.json({success:true,message:'Program updated.',data:program});
}
async function deleteProgram(req,res){
  try{
    const program=await Program.findByPk(req.params.programId);
    if(!program)return res.status(404).json({success:false,message:'Program not found.'});
    await program.destroy();
    res.json({success:true,message:'Program deleted. Its course units, lectures, enrollments and attendance records were removed as well.'});
  }catch(e){res.status(400).json({success:false,message:e.message})}
}

// Course units are created by the administrator inside a Program. Any student already
// enrolled in that Program is automatically enrolled in the new course unit too, so
// "enrolled in the program" always means "enrolled in every course unit under it".
async function createCourse(req,res){
  try{
    const {code,name}=req.body;
    const programId=req.params.programId||req.body.programId;
    if(!programId)return res.status(400).json({success:false,message:'A program is required. Add the course unit from inside a program.'});
    if(!code||!name)return res.status(400).json({success:false,message:'Course code and name are required.'});
    const program=await Program.findByPk(programId); if(!program)return res.status(404).json({success:false,message:'Program not found.'});
    const exists=await Course.findOne({where:{code}}); if(exists)return res.status(400).json({success:false,message:'Course code already exists.'});
    const course=await Course.create({code:code.trim(),name:name.trim(),programId:program.id,lecturerId:null,isActive:true});
    const enrolledStudents=await ProgramEnrollment.findAll({where:{programId:program.id},attributes:['studentId']});
    for(const ps of enrolledStudents){await Enrollment.findOrCreate({where:{studentId:ps.studentId,courseId:course.id}});}
    res.status(201).json({success:true,message:`Course unit created inside ${program.name}. Lecturers can now choose it.`,data:course});
  }catch(e){res.status(400).json({success:false,message:e.message})}
}

async function courses(req,res){
  const rows=await Course.findAll({include:[{model:User,as:'lecturer',attributes:['id','fullName','lecturerId']},{model:Program,as:'program',attributes:['id','code','name']}],order:[['name','ASC']]});
  res.json({success:true,data:rows});
}
async function updateCourse(req,res){
  const course=await Course.findByPk(req.params.courseId); if(!course)return res.status(404).json({success:false,message:'Course not found.'});
  const {name,isActive}=req.body; if(name!==undefined)course.name=name.trim(); if(isActive!==undefined)course.isActive=!!isActive; await course.save();
  res.json({success:true,message:'Course updated.',data:course});
}
async function assignCourse(req,res){
  const course=await Course.findByPk(req.params.courseId); const lecturer=await User.findOne({where:{id:req.body.lecturerId,role:'lecturer'}});
  if(!course||!lecturer)return res.status(404).json({success:false,message:'Course or lecturer not found.'});
  course.lecturerId=lecturer.id; await course.save(); res.json({success:true,message:'Course assigned to lecturer.',data:course});
}
async function unassignCourse(req,res){
  const course=await Course.findByPk(req.params.courseId); if(!course)return res.status(404).json({success:false,message:'Course not found.'});
  course.lecturerId=null; await course.save(); res.json({success:true,message:'Course is now available for a lecturer to choose.',data:course});
}
async function deleteCourse(req,res){
  try{
    const course=await Course.findByPk(req.params.courseId);
    if(!course)return res.status(404).json({success:false,message:'Course not found.'});
    await course.destroy();
    res.json({success:true,message:'Course unit deleted. Its lectures, enrollments and attendance records were removed as well.'});
  }catch(e){res.status(400).json({success:false,message:e.message})}
}
async function users(req,res){
  const role=req.query.role; const where=role&&['student','lecturer','admin'].includes(role)?{role}:{};
  const rows=await User.findAll({where,attributes:['id','fullName','email','role','registrationNumber','lecturerId'],order:[['fullName','ASC']]});
  res.json({success:true,data:rows});
}
async function studentAttendance(req,res){
  const where={}; if(req.query.courseId)where.courseId=req.query.courseId; if(req.query.studentId)where.studentId=req.query.studentId; if(req.query.date)where.date=req.query.date; if(req.query.status)where.status=req.query.status;
  const rows=await Attendance.findAll({where,include:[{model:User,as:'student',attributes:['id','fullName','registrationNumber']},{model:Course,as:'course',attributes:['id','code','name']},{model:Lecture,as:'lecture',attributes:['id','startTime','endTime']}],order:[['date','DESC'],['id','DESC']]});
  res.json({success:true,data:rows});
}
async function updateStudentAttendance(req,res){
  const row=await Attendance.findByPk(req.params.id); if(!row)return res.status(404).json({success:false,message:'Attendance record not found.'});
  if(!['Present','Absent','Late'].includes(req.body.status))return res.status(400).json({success:false,message:'Invalid attendance status.'});
  row.status=req.body.status; await row.save(); res.json({success:true,message:'Student attendance updated.',data:row});
}
async function lecturerAttendance(req,res){
  const where={}; if(req.query.lecturerId)where.lecturerId=req.query.lecturerId; if(req.query.date)where.date=req.query.date; if(req.query.status)where.status=req.query.status;
  const rows=await LecturerAttendance.findAll({where,include:[{model:User,as:'lecturer',attributes:['id','fullName','lecturerId']}],order:[['date','DESC'],['id','DESC']]});
  res.json({success:true,data:rows});
}
async function updateLecturerAttendance(req,res){
  const lecturer=await User.findOne({where:{id:req.body.lecturerId,role:'lecturer'}}); if(!lecturer)return res.status(404).json({success:false,message:'Lecturer not found.'});
  if(!req.body.date||!['Present','Absent','Late'].includes(req.body.status))return res.status(400).json({success:false,message:'Lecturer, date and valid status are required.'});
  const [row]=await LecturerAttendance.findOrCreate({where:{lecturerId:lecturer.id,date:req.body.date},defaults:{status:req.body.status,notes:req.body.notes||null}});
  if(row.status!==req.body.status||req.body.notes!==undefined){row.status=req.body.status;row.notes=req.body.notes||null;await row.save();}
  res.json({success:true,message:'Lecturer attendance saved.',data:row});
}

// Lecture ("lesson") scheduling is now done by the lecturer who teaches the course
// (see lecturerController.postLesson). Admin keeps read-only visibility for oversight.
async function courseLectures(req,res){
  const course=await Course.findByPk(req.params.courseId);
  if(!course)return res.status(404).json({success:false,message:'Course unit not found.'});
  const lectures=await Lecture.findAll({where:{courseId:course.id}});
  lectures.sort((a,b)=>Lecture.DAYS_OF_WEEK.indexOf(a.dayOfWeek)-Lecture.DAYS_OF_WEEK.indexOf(b.dayOfWeek)||String(a.startTime).localeCompare(String(b.startTime)));
  res.json({success:true,data:lectures});
}

module.exports={dashboard,createProgram,programs,updateProgram,deleteProgram,createCourse,courseLectures,courses,updateCourse,deleteCourse,assignCourse,unassignCourse,users,studentAttendance,updateStudentAttendance,lecturerAttendance,updateLecturerAttendance};
 