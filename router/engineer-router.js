const express = require('express');
const engineer_router = express.Router()
const db = require('../DB-Connect')

function getTimeStamp() {
    return (new Date().toISOString().slice(0, 10) + " " + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
}

engineer_router.get("/", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Engineer") {
        db.query("select * from checklist", (error, result) => {
            if (error) throw error
            res.render('../views/engineer/home', { Data: result })
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
        res.send("QC Is Not Ready Contact Manager")
    }
    })
    
}else{
   res.redirect('/')
}
})

module.exports = engineer_router;