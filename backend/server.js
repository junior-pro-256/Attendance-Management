require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { sequelize, testConnection } = require('./config/database');

const User = require('./models/User');
const Program = require('./models/Program');
const ProgramEnrollment = require('./models/ProgramEnrollment');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const Lecture = require('./models/Lecture');
const Attendance = require('./models/Attendance');
const PasswordResetToken = require('./models/PasswordResetToken');
const LecturerAttendance = require('./models/LecturerAttendance');

const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const courseRoutes = require('./routes/courseRoutes');
const programRoutes = require('./routes/programRoutes');
const lecturerRoutes = require('./routes/lecturerRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

User.hasMany(Attendance, { foreignKey:'studentId', as:'attendance', onDelete:'CASCADE' });
Attendance.belongsTo(User, { foreignKey:'studentId', as:'student' });
User.hasMany(Course, { foreignKey:'lecturerId', as:'courses', onDelete:'SET NULL' });
Course.belongsTo(User, { foreignKey:'lecturerId', as:'lecturer' });
Program.hasMany(Course, { foreignKey:'programId', as:'courses', onDelete:'CASCADE' });
Course.belongsTo(Program, { foreignKey:'programId', as:'program' });
Program.hasMany(ProgramEnrollment, { foreignKey:'programId', as:'enrollments', onDelete:'CASCADE' });
ProgramEnrollment.belongsTo(Program, { foreignKey:'programId', as:'program' });
User.hasMany(ProgramEnrollment, { foreignKey:'studentId', as:'programEnrollments', onDelete:'CASCADE' });
ProgramEnrollment.belongsTo(User, { foreignKey:'studentId', as:'student' });
User.hasMany(Enrollment, { foreignKey:'studentId', as:'enrollments', onDelete:'CASCADE' });
Enrollment.belongsTo(User, { foreignKey:'studentId', as:'student' });
Course.hasMany(Enrollment, { foreignKey:'courseId', as:'enrollments', onDelete:'CASCADE' });
Enrollment.belongsTo(Course, { foreignKey:'courseId', as:'course' });
Course.hasMany(Lecture, { foreignKey:'courseId', as:'lectures', onDelete:'CASCADE' });
Lecture.belongsTo(Course, { foreignKey:'courseId', as:'course' });
Lecture.hasMany(Attendance, { foreignKey:'lectureId', as:'attendance', onDelete:'CASCADE' });
Attendance.belongsTo(Lecture, { foreignKey:'lectureId', as:'lecture' });
Course.hasMany(Attendance, { foreignKey:'courseId', as:'attendance', onDelete:'CASCADE' });
Attendance.belongsTo(Course, { foreignKey:'courseId', as:'course' });
User.hasMany(PasswordResetToken, { foreignKey:'userId', as:'resetTokens', onDelete:'CASCADE' });
PasswordResetToken.belongsTo(User, { foreignKey:'userId', as:'user' });
User.hasMany(LecturerAttendance, { foreignKey:'lecturerId', as:'lecturerAttendance', onDelete:'CASCADE' });
LecturerAttendance.belongsTo(User, { foreignKey:'lecturerId', as:'lecturer' });

app.get('/', (req,res)=>res.json({success:true,message:'Attendance Management System API is running.'}));
app.use('/api/auth',authRoutes);
app.use('/api/attendance',attendanceRoutes);
app.use('/api/courses',courseRoutes);
app.use('/api/programs',programRoutes);
app.use('/api/lecturer',lecturerRoutes);
app.use('/api/admin',adminRoutes);
app.use((req,res)=>res.status(404).json({success:false,message:'Route not found.'}));
app.use((err,req,res,next)=>{console.error('Unhandled error:',err);res.status(500).json({success:false,message:'Internal server error.'})});

async function removeLegacyDailyUniqueIndex()
{try{await sequelize.getQueryInterface().removeIndex('attendance','unique_daily_checkin');
  console.log('Removed legacy one-check-in-per-day constraint.')}catch(e){}
  try{await sequelize.getQueryInterface().removeIndex('attendance','unique_student_lecture');
  console.log('Removed legacy one-check-in-per-lecture-forever constraint (lectures now repeat weekly).')}catch(e){}}
async function ensureAdmin(){
  const email=process.env.ADMIN_EMAIL, password=process.env.ADMIN_PASSWORD;
  if(!email||!password){console.log('ADMIN_EMAIL/ADMIN_PASSWORD not set; no admin account was seeded.');return;}
  let admin=await User.findOne({where:{email}});
  if(!admin){admin=await User.create({fullName:process.env.ADMIN_NAME||'System Administrator',
    email,password:await bcrypt.hash(password,10),role:'admin'});console.log(`Admin account created: ${email}`)}
  else if(admin.role!=='admin'){admin.role='admin';admin.password=await bcrypt.hash(password,10);
    await admin.save();console.log(`Existing account promoted to admin: ${email}`)}
}
async function startServer(){
  await testConnection();
  await sequelize.sync();
  await removeLegacyDailyUniqueIndex();
  await ensureAdmin();
  console.log('Database synced with Student, Lecturer and Admin modules.');
  app.listen(PORT,()=>console.log(`Attendance Management System API listening on http://localhost:${PORT}`));
}
startServer();
