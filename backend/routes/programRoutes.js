const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const p = require('../controllers/programController');

router.get('/available', auth, requireRole('student'), p.availablePrograms);
router.post('/enroll/:programId', auth, requireRole('student'), p.enrollProgram);
router.get('/my', auth, requireRole('student'), p.myPrograms);

module.exports = router;
