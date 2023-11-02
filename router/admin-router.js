const express = require('express');
const admin_router = express.Router()
const db = require('../DB-Connect')
const multer = require('multer');
const fs = require('fs');
const path = require("path");
var dateTime = require('node-datetime');
const { error } = require('console');
const { title } = require('process');

const myStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        var uploadDir = "./public/uploads/Customer-Logo";
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    }, filename: function (req, file, cb) {
        cb(null, Date.now() + '_' + "Customer" + path.extname(file.originalname));
    }
});
const CustomerLogoUpload = multer({ storage: myStorage, limits: { fileSize: 500000 } });

const CustomerIconStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        var uploadDir = "./public/uploads/Checklist-Icon";
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    }, filename: function (req, file, cb) {
        cb(null, Date.now() + '_' + "ChecklistIcon" + path.extname(file.originalname));
    }
});
const ChecklistIconUpload = multer({ storage: CustomerIconStorage, limits: { fileSize: 500000 } });

function getTimeStamp() {
    return (new Date().toISOString().slice(0, 10) + " " + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
}
admin_router.get("/", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
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
            res.render('../views/admin/adminHome', { Data: result, Log: log, title: "Admin-Dashboard", User: userData, Role: req.session.UserRole })
        })
    } else {
        res.redirect('/')
    }
});

admin_router.get("/Users", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
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
        db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users where Role!='Root' ", function (error, result) {
            if (error) throw error
            let modifiedData=result.map((e)=>{
                const obj=Object.assign({},e);
                if(obj['Remark']!=null && obj['Remark']!=undefined && obj['Remark']!==""){
                    obj['Remark']=JSON.parse(obj['Remark'])
                }
                return obj;
            })
            res.render('../views/admin/Users', { Data: modifiedData, Checklist: checklist, Basic: basicDetails,title:"Users",Role: req.session.UserRole });
        })
    } else {
        res.redirect('/')
    }
});
admin_router.get("/Jobs", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        var Customer;
        db.query("SELECT * FROM `qc-portal`.customer", function (error, result) {
            if (error) throw error
            Customer = result
        })
        db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as ModifiedDate from jobs order by Modified_Date Desc limit 50", function (error, result) {
            if (error) throw error
            res.render('../views/admin/Jobs', { Data: result, CustomerList: Customer,title:"Jobs",Role: req.session.UserRole });
        });
    } else {
        res.redirect('/')
    }
});
admin_router.get("/Customers", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
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
admin_router.post('/UploadCustomerLogo', CustomerLogoUpload.single("Customer_Logo"), (req, res) => {
    return res.status(200).send(res.req.file.filename);
});
admin_router.post('/AddCustomer', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "Root") {
        let inputData = req.body.params;
        inputData["Created_By"] = req.session.UserName;
        inputData['Created_Date'] = getTimeStamp();
        db.query("insert ignore into customer set?", [inputData], (error, result) => {
            if (error) throw error
            db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date from customer", function (error, result) {
                if (error) throw error
                return res.status(200).json({ message: "Customer Added Successfully", Data: result })
            });
        })
    } else {
        res.redirect('/')
    }
})
admin_router.post('/UploadChecklistIcon', ChecklistIconUpload.single("Checklist_Icon"), (req, res) => {
    return res.status(200).send(res.req.file.filename);
});
admin_router.post('/AddChecklist', async (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "Root") {
        let inputData = req.body.params;
        inputData["Created_By"] = req.session.UserName;
        inputData['Created_Date'] = getTimeStamp();
        db.query("insert into checklist set?", [inputData], async (error, result) => {
            if (error) {
                console.log(error)
                if (error.code == 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: "This Checklist is already exists." })
                } else {
                    return res.status(400).json({ message: "Unable to add Checklist" })
                }
            } else {
                req.body.sectionData.SectionList.forEach(section => {
                    db.query('insert into sections (Checklist,Section_Name) values (?,?)', [req.body.params.Checklist_Name, section], (error, result) => {
                        if (error) {
                            console.log(error)
                            if (error.code == 'ER_DUP_ENTRY') {
                                return res.status(400).json({ message: "This Section is already exists." })
                            } else {
                                return res.status(400).json({ message: "Unable to add sections" })
                            }
                        }
                    })
                })
                return res.status(200).json({ message: "Checklist Added Successfully" })
            }
        })
    } else {
        res.redirect('/')
    }
})
admin_router.get('/ListChecklist/:Customer_Name', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("select * from checklist where Customer=?", [req.params.Customer_Name], (error, result) => {
            if (error) throw error
            res.render("../views/admin/ListChecklist", { Data: result,title:`${req.params.Customer_Name}-Checklist`,Role: req.session.UserRole })
        })
    } else {
        res.redirect('/')
    }
})
admin_router.get('/ViewChecklist/:QC_Name', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
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

admin_router.get('/viewResponses/:QC_Name', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("select Checklist,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as New_Submitted_Date from responses where Checklist=? group by Checklist,Submitted_Date,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By order by Submitted_Date desc", [req.params.QC_Name], (error, result) => {
            if (error) throw error
            res.render("../views/admin/viewResponses", { Data: result, Checklist: req.params.QC_Name, title: req.params.QC_Name,Role: req.session.UserRole })
        })
    } else {
        res.redirect('/')
    }
})
admin_router.post('/AddNewCheckPoint', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "Root") {
        let inputData = req.body.params;
        db.query("insert into questions set?", [inputData], async (error, result) => {
            if (error) {
                console.log(error)
                res.status(400).json({Message:"Internal Server Error"})
            }else{
                db.query("select * from questions where Checklist=? order by Question_ID desc", [inputData.Checklist], (error, result) => {
                    if (error) throw error
                    res.status(200).json({Message:"New Check Point is added to the checklist",Data:result})
                })
            }
        })
    } else {
        res.status(400).json({ Message: "Access Denied... Login Again" })
    }
})
module.exports = admin_router;