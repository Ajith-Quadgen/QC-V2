const express = require('express');
const engineer_router = express.Router()
const db = require('../DB-Connect')

function getTimeStamp() {
    return (new Date().toISOString().slice(0, 10) + " " + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
}

engineer_router.get("/", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Engineer") {
        let log;
        db.query("select *,DATE_FORMAT(`Date`,'%b %D %y / %r') as Date from qc_log where User_ID=? order by Log_ID Desc limit 5 ", [req.session.UserID], (error, result) => {
            if (error) {
                res.status(400).json({ Message: "Internal server Error" })
            } else {
                log = result
            }
        })
        let userData;
        db.query('select * from users where Employee_ID=?', [req.session.UserID], (error, result) => {
            if (error) throw error
            userData = result[0];
            if (userData.Access != null) {
                const check = userData.Access.split(',')
                db.query("select * from customer where Customer_Name in (?)", [check], (error, result) => {
                    if (error) throw error
                    res.render('../views/engineer/home', { Data: result, Log: log, title: "Dashboard", User: userData, Role: req.session.UserRole })
                })
            } else {
                db.query("select * from customer limit 0", (error, result) => {
                    if (error) throw error
                    res.render('../views/engineer/home', { Data: result, Log: log, title: "Dashboard", User: userData, Role: req.session.UserRole })
                })
            }
        })


    } else {
        res.redirect('/')
    }
})

engineer_router.get('/Customers/:Customer_Name', (req, res) => {
    if (req.session.UserID) {
        let log;
        db.query("select *,DATE_FORMAT(`Date`,'%b %D %y / %r') as Date from qc_log where User_ID=? order by Log_ID Desc limit 5 ", [req.session.UserID], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(400).json({ Message: "Internal server Error" })
            } else {
                log = result
            }
        })
        var userData;
        db.query('select * from users where Employee_ID=?', [req.session.UserID], (error, result) => {
            if (error) throw error
            let sql_query;
            if(result[0].Role!='Admin'){
            userData = result[0];
            const check = userData.Access.split(',')
            let checklist;
             sql_query='Select * from checklist where Customer=? and Checklist_Name in (?)';
             db.query(sql_query, [req.params.Customer_Name,check], (error, result) => {
                if (error) {
                    console.log(error)
                    return res.status(400).send("Internal Server Error");
                } else {
                    checklist = result;
                    res.render('../views/engineer/Checklist', { Data: checklist, Log: log, title: "Dashboard", Role: req.session.UserRole })
                }
            })
            }else{
                 sql_query='Select * from checklist where Customer=?';
                 db.query(sql_query, [req.params.Customer_Name], (error, result) => {
                    if (error) {
                        console.log(error)
                        return res.status(400).send("Internal Server Error");
                    } else {
                        checklist = result;
                        res.render('../views/engineer/Checklist', { Data: checklist, Log: log, title: "Dashboard", Role: req.session.UserRole })
                    }
                })
            }
    
        })
    } else {
        res.redirect('/')
    }
})

engineer_router.get("/QC/:QC_Name", (req, res) => {
    if (req.session.UserID) {
        db.query("Select * from questions where checklist=? and Status='Active' ", [req.params.QC_Name], (error, result) => {
            if (result.length > 0) {
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
                res.render('../views/engineer/QCPage', { Data: organizedData, title: result[0].Checklist, Role: req.session.UserRole, IncludeBackButton: false })
            } else {
                res.send("Checklist is Not Prepared Yet, Contact Manager")
            }
        })

    } else {
        res.redirect('/')
    }
})
engineer_router.get('*',(req,res)=>{
    res.redirect('/')
})
module.exports = engineer_router;