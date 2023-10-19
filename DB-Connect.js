const mysql = require('mysql');
// Set up MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    // password: '@Renu001',
    // database: 'qc-portal',

    password:'@Quadgen23',
    database: 'qc-testing-db',
    
    multipleStatements: true
  });
  module.exports=db