const express = require('express');
const engineer_router = express.Router()
const db = require('../DB-Connect')

function getTimeStamp() {
    return (new Date().toISOString().slice(0, 10) + " " + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
}

engineer_router.get("/", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Engineer") {
        let log;
        db.query("select *,DATE_FORMAT(`Date`,'%b %D %y / %r') as Date from qc_log where User_ID=?",[req.session.UserID],(error,result)=>{
            if(error){
                res.status(400).json({Message:"Internal server Error"})
            }else{
                log=result
            }
        })
        db.query("select * from checklist", (error, result) => {
            if (error) throw error
            res.render('../views/engineer/home', { Data: result,Log:log })
        })
    } else {
        res.redirect('/')
    }
})

engineer_router.get("/QC/:QC_Name", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Engineer") {
    db.query("Select * from questions where checklist=? and Status='Active' ", [req.params.QC_Name], (error, result) => {
        if(result.length>0){
        const groupedData = result.reduce((acc, { Section, Item, Description, Reference_Document, Reference_Link }) => {
            //console.log(Section)
            acc[Section] = acc[Section] || [];
            acc[Section].push(Item, Description, Reference_Document, Reference_Link);

            return acc;
        }, {});
        //console.log(groupedData)
        const organizedData = {};

        // Organize data by sections
        result.forEach((row) => {
            const { Section } = row;
            if (!organizedData[Section]) {
                organizedData[Section] = [];
            }
            organizedData[Section].push(row);
        });
        res.render('../views/engineer/QCpage', { Data: organizedData, title: result[0].Checklist })
    }else{
        res.send("Checklist is Not Prepared Yer, Contact Manager")
    }
    })
    
}else{
   res.redirect('/')
}
})

module.exports = engineer_router;