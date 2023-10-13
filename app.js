const express = require('express');
const session = require('express-session');
const db = require('./DB-Connect');
const app = express();
const path = require("path");
const bodyParser = require('body-parser');
const fs = require('fs');
var dateTime = require('node-datetime');
const { Server } = require('socket.io');
const multer = require('multer');
const PDFGenerator = require('pdfkit');
const cors = require('cors')
const https = require('https')
const nodemailer = require('nodemailer')


process.env.tz = 'Asia/Calcutta';
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())
app.engine('html', require('ejs').renderFile);
app.set("view engine", "ejs");
app.use(express.static(`${__dirname}`));

app.use(cors())
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: 'XCR3rsasa%RDHHH',
  cookie: { maxAge: 86400000 },
  store: new session.MemoryStore()
}));




const adminRouter = require('./router/admin-router')
const PMORouter = require('./router/PMO-router')
const EngineerRouter = require('./router/engineer-router')
const RootRouter = require('./router/root-router')
const AdminRouter = require('./router/api-router');
const api_Router = require('./router/api-router');
app.use('/admin', adminRouter)
app.use('/PMO', PMORouter)
app.use('/engineer', EngineerRouter)
app.use('/root', RootRouter)
app.use('/api', api_Router)
db.connect((error) => {
  if (error) {
    console.error('Failed to connect to QC-Portal database:', error);
  } else {
    console.log('Connected to QC-Portal database!');
  }
});

const port = 5500;
const host = "172.17.1.22"
const privateKey = fs.readFileSync('key.pem');
const certificate = fs.readFileSync('cert.pem')
const credentials = { key: privateKey, cert: certificate, requestCertificate: false, rejectUnauthorized: false };
const httpsServer = https.createServer(credentials, app);
httpsServer.listen(port, () => {
  console.log('server is Running under Https with port:' + port)
})


// const server = app.listen(port, function () {
//   console.log("QC-Portal is hosted at http://localhost:%s", port);
// });

function getTimeStamp() {
  return (new Date().toISOString().slice(0, 10) + " " + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
}
app.get('/', (req, res) => {
  if (req.query.Message) {
    res.render('login', { Message: req.query.Message, type: "Info" });

  } else {
    res.render('login', { Message: false, type: "Info" });

  }
})
app.get('/login', (req, res) => {
  if (req.session.UserID) {
    switch (req.session.UserRole) {
      case "Engineer":
        res.redirect('/engineer');
        break;
      case "Admin":
        res.redirect('/admin');
        break;
      case "PMO":
        res.redirect('/PMO');
        break;
      case "Root":
        res.redirect('/root');
        break;
      default:
        res.redirect('/logout')
        break;
    }
  } else {
    res.render('login', { Message: "Login Required", type: "Info" });
  }
});

app.post('/AuthenticateLogin', (req, res) => {
  var UserInfo = req.body;
  db.query("select * from users where `Employee_ID`=? and `Password`=? and Active='1'", [UserInfo.email, UserInfo.password], function (error, result) {
    if (error) throw error;
    if (result.length > 0) {
      db.query("update users set `Lastseen`=? where `Employee_ID`=?", [getTimeStamp(), result[0]['Employee_ID']], function (error, result) {
        if (error) throw error;
      });
      req.session.UserID = result[0]['Employee_ID'];
      req.session.UserRole = result[0]['Role'];
      req.session.UserName = result[0]['Full_Name'];
      req.session.UserMail = result[0]['Email_ID'];
      req.session.RMail = result[0]['Reporting_Manager_Mail'];
      if(result[0]['Role']=="Root"){
        delete req.session.UserRole;
      }
      if (result[0]['Role'] == "Engineer") {
        res.redirect('/engineer');
      } else if (result[0]['Role'] == "Admin") {
        res.redirect('/Admin');
      } else if (result[0]['Role'] == "PMO") {
        res.redirect('/PMO');
      }else if (result[0]['Role'] == "Root") {
        res.redirect('/root/LoginVerification');
      } else {
        return res.send("Internal Server Error");
      }
    } else {
      res.redirect('/?Message=Invalid UserName or Password');
    }
  })
});
app.get('/forgetPassword', async (req, res, next) => {
  res.render('resetPassword');
});
app.get('/ChangePassword', (req, res) => {
  if (req.session.UserID) {
    res.render('../views/ChangePassword', { userName: req.session.UserName, Role: req.session.UserRole })

  } else {
    res.redirect('/')

  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});
app.get('*', (req, res) => {
  var link = req.protocol + '://' + req.hostname + req.originalUrl;
  res.redirect('/')
})
