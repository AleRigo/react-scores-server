const express = require('express');
const morgan = require('morgan'); // logging middleware
const jwt = require('express-jwt');
const jsonwebtoken = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const { check, validationResult } = require('express-validator'); // validation library
const dao = require('./dao.js');

const jwtSecretContent = require('./secret.js');
const jwtSecret = jwtSecretContent.jwtSecret;

const app = express();
const port = 3001;

// Set-up logging
app.use(morgan('tiny'));

// Process body content
app.use(express.json());


// DB error
const dbErrorObj = { errors: [{ 'param': 'Server', 'msg': 'Database error' }] };
// Authorization error
const authErrorObj = { errors: [{ 'param': 'Server', 'msg': 'Authorization error' }] };

const expireTime = 300; //seconds

// Authentication endpoint
app.post('/api/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  dao.checkUserPass(username, password)
    .then((userObj) => {
      const token = jsonwebtoken.sign({ userID: userObj.userID }, jwtSecret, {expiresIn: expireTime});
      res.cookie('token', token, { httpOnly: true, sameSite: true, maxAge: 1000*expireTime });
      res.json(userObj);
    }).catch(
      // Delay response when wrong user/pass is sent to avoid fast guessing attempts
      () => new Promise((resolve) => {
        setTimeout(resolve, 1000)
      }).then(
           () => res.status(401).end()
      )
    );
});



app.use(cookieParser());

const csrfProtection = csrf({
  cookie: { httpOnly: true, sameSite: true }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token').end();
});

// With the following line, for the rest of the code, all routes would require the CSRF token
//app.use(csrfProtection);
// To use it only for specific routes, add  csrfProtection  in the list of middlewares in the route
// CORS is needed only for routes that have side effects (e.g., POST, PUT, DELETE)

// For the rest of the code, all APIs require authentication
app.use(
  jwt({
    secret: jwtSecret,
    getToken: req => req.cookies.token
  })
);

// Provide an endpoint for the App to retrieve the CSRF token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});


// To return a better object in case of errors
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json(authErrorObj);
  }
});

// REST API endpoints

// Resources: Course, Exam

// GET /courses
// Request body: empty
// Response body: Array of objects, each describing a Course
// Errors: none
app.get('/api/courses', (req, res) => {
  dao.listCourses()
    .then((courses) => res.json(courses))
    .catch((err) => res.status(503).json(dbErrorObj));
});


// GET /courses/<course_code>
// Parameter: course code
// Response body: object describing a Course
// Error: if the course does not exist, returns {}
app.get('/api/courses/:code', (req, res) => {
  dao.readCourseByCode(req.params.code)
    .then((course) => res.json(course))
    .catch((err) => res.status(503).json(dbErrorObj));
});



// GET /exams
app.get('/api/exams', (req, res) => {
  // Extract userID from JWT payload
  // check if req.user is present, in case the API is used without authentication
  const userID = req.user && req.user.userID;
  dao.listExams(userID)
    //Use to artificially delay the response (e.g., to test 'Loading' status etc.)
    //.then((exams) => new Promise((resolve) => {setTimeout(resolve, 1000, exams)}) )
    .then((exams) => res.json(exams))
    .catch((err) => res.status(503).json(dbErrorObj));
});


// GET /exams/<exam_id>

// POST /exams
// Request body: object describing an Exam { coursecode, score, date }
// Response body: empty (ALTERNATIVE: new 'id' for the inserted course)
//    (ALTERNATIVE: return a full copy of the Exam)
app.post('/api/exams', csrfProtection, [
  check('score').isInt({ min: 18, max: 30 }),
  check('coursecode').isLength({ min: 7, max: 7 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  // Extract userID from JWT payload
  const userID = req.user && req.user.userID;
  dao.createExam({
    coursecode: req.body.coursecode,
    score: req.body.score,
    date: req.body.date
  }, userID).then((result) => res.end())
    .catch((err) => res.status(503).json(dbErrorObj));
});


//PUT /exams/<course_code>
app.put('/api/exams/:code', csrfProtection, [
  check('score').isInt({ min: 18, max: 30 }),
  check('coursecode').isLength({ min: 7, max: 7 }),
  check('code').isLength({ min: 7, max: 7 }),
], (req, res) => {
  /*if (req.user) {
    console.log("LOG: Request with JWT payload: "+JSON.stringify(req.user));
  }*/
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
  } else if (!req.params.code) {
    res.status(400).end();
  } else {
    const exam = req.body;
    // Extract userID from JWT payload
    const userID = req.user && req.user.userID;
    dao.updateExam(exam, userID)
      .then((result) => res.status(200).end())
      .catch((err) => res.status(503).json(dbErrorObj));
  }
});


// DELETE /exams/<course_code>
app.delete('/api/exams/:code', csrfProtection, (req, res) => {
  // Extract userID from JWT payload
  const userID = req.user && req.user.userID;
  dao.deleteExam(req.params.code, userID)
    .then((result) => res.end())
    .catch((err) => res.status(503).json(dbErrorObj));
});



// Activate web server
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
