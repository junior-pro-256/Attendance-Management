# Attendance Management System

This version extends the existing Vanilla HTML/CSS/JavaScript + Node.js/Express + MySQL/Sequelize application without replacing the student architecture.

## Roles

- **Administrator** — adds or deletes Programs (e.g. "Software Engineering"), and adds course units inside each program.
- **Student** — enrolls in a Program, which automatically enrolls them in every course unit under it, attends lessons posted by lecturers, views attendance statistics, and can reset a forgotten password.
- **Lecturer** — registers/logs in with a staff number, chooses assigned course units, posts lessons (weekly lecture time slots) for the course units they teach, views enrolled students, and records/monitors attendance which is taken automatically when a student joins during an active lesson.

## Important integration behavior

The existing `users` and `attendance` tables are reused and extended. Existing student attendance rows are retained as legacy rows. New attendance is linked to a `Course` and `Lecture`.

The database now supports:

- `users.role`: `student`, `lecturer` or `admin`
- lecturer `fullName` and `lecturerId`
- `programs` — created and deleted by the administrator
- `courses` — created by the administrator inside a program (`programId`)
- `program_enrollments` — a student's enrollment in a program
- `enrollments` — a student's enrollment in an individual course unit; created automatically for every course under a program when the student enrolls in that program (and for any course unit added to the program afterwards)
- `lectures` ("lessons") — posted by the lecturer who teaches the course unit
- course/lecture-linked attendance
- expiring, single-use password reset tokens

`sequelize.sync({ alter: true })` updates the schema without intentionally dropping existing records. The server also removes the old `unique_daily_checkin` index because the old student system allowed only one check-in per calendar day; the new rule is one attendance record per **Student + Lecture**, with an additional backend check preventing overlapping lecture attendance.

## Project structure

```text
reg sys/
├── backend/
│   ├── config/database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── attendanceController.js
│   │   ├── courseController.js
│   │   ├── programController.js
│   │   ├── lecturerController.js
│   │   └── adminController.js
│   ├── middleware/auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Attendance.js
│   │   ├── Program.js
│   │   ├── ProgramEnrollment.js
│   │   ├── Course.js
│   │   ├── Enrollment.js
│   │   ├── Lecture.js
│   │   └── PasswordResetToken.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── programRoutes.js
│   │   ├── lecturerRoutes.js
│   │   └── adminRoutes.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

## Run

1. Keep your existing MySQL database and `.env` values.
2. If dependencies are not installed:

```bash
cd backend
npm install
```

3. Start:

```bash
npm start
```

4. Open `frontend/index.html` through Live Server or another local HTTP server.

The frontend remains **Vanilla JavaScript**; it has not been converted to React.

## Main API endpoints

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Administrator

```text
GET    /api/admin/programs                          list all programs
POST   /api/admin/programs                           add a program
PUT    /api/admin/programs/:programId                edit a program
DELETE /api/admin/programs/:programId                delete a program (also removes its course units, lectures, enrollments and attendance)
POST   /api/admin/programs/:programId/courses         add a course unit inside a program

GET    /api/admin/courses                            list all course units
PUT    /api/admin/courses/:courseId                   edit a course unit
DELETE /api/admin/courses/:courseId                   delete a course unit (also removes its lectures, enrollments and attendance)
POST   /api/admin/courses/:courseId/assign            assign a lecturer
POST   /api/admin/courses/:courseId/unassign          make a course available again
GET    /api/admin/courses/:courseId/lectures          view a course's posted lessons (read-only)

GET    /api/admin/users
GET/PUT /api/admin/attendance/students
GET/POST /api/admin/attendance/lecturers
```

### Student

```text
GET  /api/programs/available          browse programs open for enrollment
POST /api/programs/enroll/:programId  enroll in a program (auto-enrolls every course unit under it)
GET  /api/programs/my                 programs the student is enrolled in

GET  /api/courses/my
GET  /api/attendance/my-lectures
POST /api/attendance/mark
GET  /api/attendance/my-records
GET  /api/attendance/my-statistics
```

### Lecturer

```text
GET  /api/lecturer/available-courses
POST /api/lecturer/choose-course/:courseId
GET  /api/courses/lecturer
GET  /api/courses/lecturer/:courseId/students

POST   /api/lecturer/courses/:courseId/lectures    post a lesson (weekly time slot) for a course unit taught
GET    /api/lecturer/courses/:courseId/lectures     view lessons posted for a course unit
DELETE /api/lecturer/lectures/:lectureId            remove a posted lesson

GET  /api/attendance/lecturer/dashboard
GET  /api/attendance/lecturer/live
GET  /api/attendance/lecturer/history
GET  /api/attendance/lecturer/reports
```

All admin/lecturer endpoints use JWT authentication plus backend role authorization. A student calling a lecturer or admin endpoint receives `403 Forbidden`.

## Password reset

Reset tokens are stored as SHA-256 hashes, expire after 15 minutes, and become unusable after a successful reset.

For local testing, `.env` can contain:

```text
RESET_TOKEN_DEV_MODE=true
```

This causes the development token to be returned by the forgot-password endpoint and logged by the server. In production, set it to `false` and connect the reset flow to a real email/SMS delivery provider.

## Restricting who can register as a lecturer

A student cannot open a lecturer account just by picking "Lecturer" on the sign-up form. Registration only succeeds for `role: lecturer` if the submitted email exactly matches one in `LECTURER_ALLOWED_EMAILS`:

```text
LECTURER_ALLOWED_EMAILS=firstlecturer@example.com,secondlecturer@example.com
```

- Comma-separated, case-insensitive, whitespace is trimmed.
- Leaving it empty blocks **all** lecturer self-registration until the administrator adds staff emails.
- Restart the server after editing `.env` — the list is only read from the environment, not reloaded live.
- This does not by itself confirm the person registering actually owns that inbox; pair it with real email verification if that matters for your deployment.

## Attendance rules

- Lecturer can record attendance only for their own course.
- Lecturer can record attendance only for enrolled students.
- Student can record their own attendance only.
- Student cannot create or modify lecturer attendance.
- Duplicate `Student + Lecture` attendance is rejected.
- A student cannot attend two overlapping lecture times on the same date.
- `Present` and `Late` count as attended.
- `Absent` does not count as attended.
- Percentage = `(Present + Late) / Total Classes × 100`.

## Validation performed on this extension

All backend JavaScript files were syntax-checked with Node.js. Database integration should be tested against the user's actual MySQL database because the uploaded project does not contain a live database dump.


## Programs, course units and enrollment

- The administrator adds or deletes **Programs** (e.g. "Software Engineering") and adds course units inside each program.
- A student enrolls in a Program; this automatically enrolls the student in every course unit under it. If the administrator later adds a new course unit to a program, students already enrolled in that program are automatically enrolled in the new course unit too.
- Deleting a program deletes its course units, lessons, enrollments and attendance records. Deleting a course unit deletes its lessons, enrollments and attendance records.

## Attendance workflow

- A lecturer chooses the course unit(s) they teach, then **posts a lesson** — a weekly day/start-time/end-time slot — for each course unit.
- During an active posted lesson, enrolled students use **Join Lecture & Register Attendance**.
- The backend accepts student attendance only during the scheduled date/time, only for enrolled students, and only once per lesson (per week).
- A lecturer uses **Monitor Attendance** to see students who have joined the active lesson.
- Students cannot manually choose Present/Absent/Late; attendance is registered as Present automatically when they join — unchanged from before.
