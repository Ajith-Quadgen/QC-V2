const express = require('express');
const root_router = express.Router()
const db=require('../DB-Connect')

function getTimeStamp(){
    return(new Date().toISOString().slice(0, 10)+" "+new Date().toLocaleTimeString('en-GB',{timeZone: 'Asia/Kolkata'}));
    }
    root_router.get("/LoginVerification",(req,res)=>{
        res.render("../views/root/OTP_Verification")
    })
module.exports=root_router;