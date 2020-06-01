'use strict';

const bcrypt = require('bcrypt');

// DAO module for accessing courses and exams
// Data Access Object

const sqlite = require('sqlite3');
const db = new sqlite.Database('exams.sqlite', (err) => {
  if (err) throw err;
});

exports.listCourses = function () {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM course';
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const courses = rows.map((e) => ({ coursecode: e.code, name: e.name, CFU: e.CFU }));
      resolve(courses);
    });
  });
};


exports.readCourseByCode = function (code) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM course WHERE code=?';
    db.get(sql, [code], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (row == undefined) {
        resolve({});
      } else {
        const course = { code: row.code, name: row.name, CFU: row.CFU };
        resolve(course);
      }
    });
  });
};

exports.listExams = function (userID) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT course_code, score, date, name FROM exam, course' +
      ' WHERE course_code=code AND username = ?';

    // execute query and get all results into `rows`
    db.all(sql, [userID], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      // transform 'rows' of query results into an array of objects
      const exams = rows.map((e) => (
        {
          coursecode: e.course_code,
          score: e.score,
          date: e.date,
          coursename: e.name,
        }));

      resolve(exams);
    });
  });
};

exports.createExam = function (exam, userID) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT INTO exam(course_code, date, score, username) VALUES(?, DATE(?), ?, ?)';
    db.run(sql, [exam.coursecode, exam.date, exam.score, userID], function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
  });
};

/**
 * Update an exam given the exam with its course_code
 */
exports.updateExam = function (exam, userID) {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE exam SET date=DATE(?), score=? WHERE course_code = ? AND username = ?';
    db.run(sql, [exam.date, exam.score, exam.coursecode, userID], function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
  });
};


/**
 * Delete an exam given the course_code
 */
exports.deleteExam = function (course_code, userID) {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM exam WHERE course_code = ? AND username = ?';
    db.run(sql, [course_code, userID], (err) => {
      if (err) {
        reject(err);
        return;
      } else
        resolve(null);
    });
  });
}


exports.checkUserPass = function (user, pass) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT username, passwordhash, name FROM user WHERE username = ?';
    // execute query and get all results into `rows`
    db.all(sql, [user], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      if (rows.length === 0) {
        reject(null);
        return;
      }
      const passwordHashDb = rows[0].passwordhash;

      // bcrypt.compare might be computationally heavy, thus it call a callback function when completed
      bcrypt.compare(pass, passwordHashDb, function (err, res) {
        if (err)
          reject(err);
        else {
          if (res) {
            resolve({
              userID: rows[0].username,
              name: rows[0].name,
            });
            return;
          } else {
            reject(null);
            return;
          }
        }
      });
    });
  });
}

exports.loadUserInfo = function (userID) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT username, name FROM user WHERE username = ?';
    // execute query and get all results into `rows`
    db.all(sql, [userID], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      if (rows.length === 0) {
        reject(null);
        return;
      }
      resolve({
        userID: rows[0].username,
        name: rows[0].name,
      });
      return;
    });
  });
}
