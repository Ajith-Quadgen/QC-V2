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
const cors=require('cors')
const https=require('https')
const nodemailer=require('nodemailer')


process.env.tz='Asia/Calcutta';
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
  store:new session.MemoryStore()
}));

const privateKey=fs.readFileSync('key.pem');
const certificate=fs.readFileSync('cert.pem')
const credentials={key:privateKey,cert:certificate,requestCertificate:false,rejectUnauthorized:false};
const httpsServer=https.createServer(credentials,app);
httpsServer.listen(port,()=>{
  console.log('server is Running under Https with port:'+port)
})

const adminRouter=require('./router/admin-router')
const PMORouter=require('./router/PMO-router')
const EngineerRouter=require('./router/engineer-router')
const ManagerRouter=require('./router/manager-router')
const AdminRouter=require('./router/api-router');
const api_Router = require('./router/api-router');
app.use('/admin',adminRouter)
app.use('/PMO',PMORouter)
app.use('/engineer',EngineerRouter)
app.use('/manager',ManagerRouter)
app.use('/api',api_Router)
db.connect((error) => {
    if (error) {
      console.error('Failed to connect to QC-Portal database:', error);
    } else {
      console.log('Connected to QC-Portal database!');
    }
  });

  
const port = 5000;
const host = "172.17.1.22"
const server = app.listen(port, function () {
  console.log("QC-Portal is hosted at http://localhost:%s", port);
});


app.get('/',(req,res)=>{
    res.render('../views/login')
})
app.get('/login', (req, res) => {
  if (req.session.UserID) {
    switch (req.session.UserRole) {
      case "Engineer":
        res.redirect('/engineer');
        break;
      case "PMO":
        res.redirect('/PMO');
        break;
      case "Admin":
        res.redirect('/admin');
        break;
        case "Manager":
          res.redirect('/manager');
          break;
      default:
        res.render('login');
        break;
    }
  } else {
    res.render('login');
  }
});
let dt = dateTime.create();
let CurrentDate = dt.format('Y-m-d H:M:S');

app.post('/AuthenticateLogin', (req, res) => {
    var UserInfo = req.body;
    db.query("select * from users where `Employee_ID`=? and `Password`=? and Active='1'", [UserInfo.email, UserInfo.password], function (error, result) {
      if (error) throw error;
      if (result.length > 0) {
        db.query("update users set `Lastseen`=? where `Employee_ID`=?", [CurrentDate, result[0]['Employee ID']], function (error, result) {
          if (error) throw error;
        });
        req.session.UserID = result[0]['Employee_ID'];
        req.session.UserRole = result[0]['Role'];
        req.session.UserName=result[0]['Full_Name'];
        req.session.UserMail=result[0]['Email_ID'];
        if (result[0]['Role'] == "Engineer") {
          res.redirect('/engineer');
        } else if (result[0]['Role'] == "PMO") {
          res.redirect('/PMO');
        } else if (result[0]['Role'] == "Manager") {
          res.redirect('/Manager');
        }else if (result[0]['Role'] == "Admin") {
            res.redirect('/Admin');
          } else {
          return res.send("Internal Server Error");
        }
      } else {
        return res.redirect('/login');
      }
    })
  });
 app.get('/forgetPassword',async(req,res,next)=>{
res.render('resetPassword');
 }); 
 app.get('/ChangePassword',(req,res)=>{
if(req.session.UserID){
  res.render('../views/ChangePassword',{userName:req.session.UserName})

}else{
    res.redirect('/')

}
   }); 
   
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});
app.get("*",(req,res)=>{
    res.render('Not Found')
})
