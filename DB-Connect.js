const mysql = require('mysql');
// Set up MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
<<<<<<< HEAD
    //password: '@Renu001',
    password:'@Quadgen23',
=======
    password: '@Renu001',
    //password:'@Quadgen23',
>>>>>>> 59c15f8 (v3 push)
    database: 'qc-portal',
    multipleStatements: true
  });
  module.exports=db