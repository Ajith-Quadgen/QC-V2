const express = require('express');
const PMO_router = express.Router()
const db=require('../DB-Connect')

function getTimeStamp(){
    return(new Date().toISOString().slice(0, 10)+" "+new Date().toLocaleTimeString('en-GB',{timeZone: 'Asia/Kolkata'}));
    }
    PMO_router.get("/", (req, res) => {
        if (req.session.UserID && req.session.UserRole == "PMO") {
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
                db.query("select * from notifications where ? >= Start_Date and ? <= End_Date", [new Date(), new Date()], (error, notifications) => {
                    if (error) {
                      console.log(error);
                    } else {
                        res.render('../views/admin/adminHome', { Data: result, Log: log, title: "PMO-Dashboard", User: userData, Role: req.session.UserRole,notifications:notifications?notifications:null })
                    }
                  })
            })
        } else {
            res.redirect('/')
        }
    });
    PMO_router.get("/Users", (req, res) => {
        if (req.session.UserID && req.session.UserRole == "PMO") {
            let checklist;
            db.query("select * from checklist", (error, result) => {
                if (error) {
                    console.log(error)
                    return res.status(500).json({ Message: "Internal Server Error" })
                } else {
                    checklist = result;
                }
            })
            let basicDetails = {};
            db.query("select (select group_concat(distinct Location) from users) as Location,(select group_concat(distinct Designation) from users) as Designation", (error, result) => {
                if (error) {
                    console.log(error)
                } else if (result.length > 0) {
                    let Location = result[0].Location.split(',');
                    let Designation = result[0].Designation.split(',');
                    basicDetails.Location = Location;
                    basicDetails.Designation = Designation;
                }
            })
            db.query('SELECT Employee_ID,Full_Name,Email_ID FROM users where Active=1 and  Designation not in ("Developer","OSP Drafter II","GET-OSP Drafter","OSP Drafter","Fiber Design Engineer") order by Full_Name', (error, result) => {
                if (error) throw error
                basicDetails.NameMail = result
            })
            basicDetails.Roles = ["Admin","PMO", "Engineer"]
            db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users  where Role!='Root'", function (error, result) {
                if (error) throw error
                let modifiedData=result.map((e)=>{
                    const obj=Object.assign({},e);
                    if(obj['Remark']!=null && obj['Remark']!=undefined && obj['Remark']!==""){
                        obj['Remark']=JSON.parse(obj['Remark'])
                    }
                    return obj;
                })
                res.render('../views/admin/Users', { Data: modifiedData, Checklist: checklist, Basic: basicDetails,title:"Users", Role: req.session.UserRole  });
            })
        } else {
            res.redirect('/')
        }
    });
    PMO_router.get("/Jobs", (req, res) => {
        if (req.session.UserID && req.session.UserRole == "PMO") {
            var Customer;
            db.query("SELECT * FROM `qc-portal`.customer", function (error, result) {
                if (error) throw error
                Customer = result
            })
            db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as ModifiedDate from jobs order by Modified_Date Desc limit 50", function (error, result) {
                if (error) throw error
                res.render('../views/admin/Jobs', { Data: result, CustomerList: Customer,title:"Jobs", Role: req.session.UserRole  });
            });
        } else {
            res.redirect('/')
        }
    });
    PMO_router.get("/Customers", (req, res) => {
        if (req.session.UserID && req.session.UserRole == "PMO") {
            db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date from customer", function (error, result) {
                if (error) throw error
                db.query("select Customer_Name from customer", function (error, Customer_result) {
                    if (error) throw error
                    res.render('../views/admin/Customers', { Data: result, Customer_Data: Customer_result,title:"Customers",Role: req.session.UserRole });
                })
            });
        } else {
            res.redirect('/')
        }
    });
    PMO_router.get('/Customers/:Customer_Name', (req, res) => {
        if (req.session.UserID && req.session.UserRole == "PMO") {
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
                        res.render('../views/engineer/Checklist', { Data: checklist, Log: log, title: "PMO-Dashboard", Role: req.session.UserRole })
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
                            res.render('../views/engineer/Checklist', { Data: checklist, Log: log, title: "PMO-Dashboard", Role: req.session.UserRole })
                        }
                    })
                }
        
            })
        } else {
            res.redirect('/')
        }
    })

    PMO_router.get('/ListChecklist/:Customer_Name', (req, res) => {
        if (req.session.UserID && req.session.UserRole == "PMO") {
            db.query("select * from checklist where Customer=?", [req.params.Customer_Name], (error, result) => {
                if (error) throw error
                res.render("../views/admin/ListChecklist", { Data: result,title:`${req.params.Customer_Name}-Checklist`,Role: req.session.UserRole })
            })
        } else {
            res.redirect('/')
        }
    })
    PMO_router.get('/ViewChecklist/:QC_Name', (req, res) => {
        if (req.session.UserID && req.session.UserRole == "PMO") {
            let sections = "";
            db.query("select * from questions where Checklist=? order by Question_ID", [req.params.QC_Name], (error, result) => {
                if (error) throw error
                db.query("select Section from questions where Checklist=? group by Section;", [req.params.QC_Name], (error, result1) => {
                    if (error) throw error
                    sections = result1;
                    res.render("../views/admin/viewChecklist", { Data: result, Checklist: req.params.QC_Name, Sections: sections,title:`${req.params.QC_Name}`, Role: req.session.UserRole })
                })
            })
        } else {
            res.redirect('/')
        }
    })
    PMO_router.get('/viewResponses/:QC_Name', (req, res) => {
        if (req.session.UserID && req.session.UserRole == "PMO") {
            db.query("select Checklist,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as Submitted_Date from responses where Checklist=? group by Checklist,Submitted_Date,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By order by Submitted_Date desc", [req.params.QC_Name], (error, result) => {
                if (error) throw error
                res.render("../views/admin/viewResponses", { Data: result, Checklist: req.params.QC_Name, title: req.params.QC_Name,Role: req.session.UserRole })
            })
        } else {
            res.redirect('/')
        }
    })
module.exports=PMO_router;