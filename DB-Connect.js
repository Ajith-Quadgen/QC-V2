const mysql = require('mysql');
// Set up MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '@Renu001',
    //password:'@Quadgen23',
    database: 'qc-portal',
    multipleStatements: true
  });

  module.exports=db