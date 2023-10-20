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
        subject: `Your One Time Password is_${n}`,
        html: `<h3>Hi ${req.session.UserName}</h3><br>The One Time Password for Login QC-Portal is<b><h2>${n}</h2></b><br>This is OTP will Expire in 5 Min.<br><br><br>Regards`,
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
        res.send("Root home")
    }else{
        res.redirect('/login')
    }
})
module.exports = root_router;
