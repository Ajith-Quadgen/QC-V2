const express = require('express');
const manager_router = express.Router()
const db=require('../DB-Connect')

function getTimeStamp(){
    return(new Date().toISOString().slice(0, 10)+" "+new Date().toLocaleTimeString('en-GB',{timeZone: 'Asia/Kolkata'}));
    }

module.exports=manager_router;