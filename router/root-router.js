const express = require('express');
const root_router = express.Router()
const db = require('../DB-Connect')
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
function getTimeStamp() {
    return (new Date().toISOString().slice(0, 10) + " " + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
}
const transporter = nodemailer.createTransport(
    smtpTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // true for 465, false for other ports\
        auth: {
            user: 'software.development@quadgenwireless.com ', // Your Gmail email address
            pass: 'mrzpgphmoulavifx '   // Your Gmail password or app-specific password
        }
    })
);



root_router.get("/LoginVerification", async(req, res) => {
    let n = 0;
    n = crypto.randomInt(100000, 999999)
    const mailOptions = {
        from: 'software.development@quadgenwireless.com ',
        to: req.session.UserMail,
        subject: `Root Admin Login-OTP is_${n}`,
        html: `<h3>Hi ${req.session.UserName}</h3><br>The One Time Password for Root User Login QC-Portal is<b><h2>${n}</h2></b><br>This is OTP will Expire in 5 Min.<br><br><br>Regards`,
    };
   await transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error on sending email:', error);
            req.session.LoginOTP = null;
            throw error
        } else {
            req.session.LoginOTP = n;
            res.render("../views/root/OTP_Verification")
        }
    });
})

root_router.post("/VerifyOTP", (req, res) => {
    if (req.session.LoginOTP && req.session.UserID) {
        const UserOTP = req.body.params.OTP;
        if (req.session.LoginOTP == UserOTP) {
            req.session.LoginOTPVerification = true;
            req.session.LoginOTP=null
            req.session.UserRole="Root"
            res.status(200).json({Message:"OTP Verification Successful"})
        } else {
            req.session.LoginOTPVerification=false
           res.status(400).json({Message:"Invalid OTP..!"})
        }
    }else{
        res.status(400).json({Message:"Access Denied"})
    }
})
root_router.get("/home",(req,res)=>{
    if(req.session.UserID && req.session.LoginOTPVerification){
       res.redirect('/root/home')
    }else{
        res.redirect('/login')
    }
})

root_router.get("/", (req, res) => {
    console.log(req.session)
    if (req.session.UserID && req.session.UserRole == "Root" && req.session.LoginOTPVerification) {
        let log;
        db.query("select *,DATE_FORMAT(`Date`,'%b %D %y / %r') as Date from qc_log where User_ID=? order by Log_ID Desc limit 5 ", [req.session.UserID], (error, result) => {
            if (error) {
                res.status(400).json({ Message: "Internal server Error" })
            } else {
                log = result
            }
        })
        var userData;
        db.query('select * from users where Employee_ID=?', [req.session.UserID], (error, result) => {
            if (error) throw error
            userData = result[0];
        })
        db.query("select * from customer", (error, result) => {
            if (error) throw error
            return res.render('../views/root/rootHome', { Data: result, Log: log, title: "Master-Dashboard", User: userData, Role: req.session.UserRole })
        })
    } else {
        res.redirect('/')
    }
});
module.exports = root_router;
