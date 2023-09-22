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
        db.query("select *,DATE_FORMAT(`Date`,'%b %D %y / %r') as Date from qc_log where User_ID=? order by Log_ID Desc limit 5 ",[req.session.UserID],(error,result)=>{
            if(error){
                res.status(400).json({Message:"Internal server Error"})
            }else{
                log=result
            }
        })
        var userData;
        db.query('select * from users where Employee_ID=?',[req.session.UserID],(error,result)=>{
            if(error) throw error
            userData=result[0];
        })
        db.query("select * from checklist", (error, result) => {
            if (error) throw error
            res.render('../views/admin/adminHome', { Data: result,Log:log,title:"Dashboard",User:userData,Role:req.session.UserRole })
        })
    } else {
        res.redirect('/')
    }
});
admin_router.get("/Users", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users", function (error, result) {
            if (error) throw error
            res.render('../views/admin/Users', { Data: result });
        })
    } else {
        res.redirect('/')
    }
});
admin_router.get("/Jobs", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date from jobs", function (error, result) {
            if (error) throw error
            res.render('../views/admin/Jobs', { Data: result });
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
                res.render('../views/admin/Customers', { Data: result, Customer_Data: Customer_result });
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
    if (req.session.UserID && req.session.UserRole == "Admin") {
        let inputData = req.body.params;
        console.log(req.body);
        inputData["Created_By"] = req.session.UserID;
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
    if (req.session.UserID && req.session.UserRole == "Admin") {
        let inputData = req.body.params;
        console.log(req.body);
        inputData["Created_By"] = req.session.UserID;
        inputData['Created_Date'] = getTimeStamp();
        db.query("insert ignore into checklist set?", [inputData], async (error, result) => {
            if (error) throw error
            const response = await addSection(req.body.sectionData);
            if (response == true) {
                return res.status(200).json({ message: "Checklist Added Successfully" })
            } else {
                return res.status(400).json({ message: response.message })
            }

        })
    } else {
        res.redirect('/')
    }
})
function addSection(Data) {
        Data.SectionList.forEach(section => {
            db.query('insert ignore into sections (Customer,Section_Name) values (?,?)', [Data.Customer, section], (error, result) => {
                if (error) return error
                return true;
            })
        })
}
admin_router.get('/ListChecklist/:Customer_Name', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("select * from checklist where Customer=?", [req.params.Customer_Name], (error, result) => {
            if (error) throw error
            res.render("../views/admin/ListChecklist", { Data: result })
        })
    } else {
        res.redirect('/')
    }
})
admin_router.get('/ViewChecklist/:QC_Name', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("select * from questions where Checklist=? order by Question_ID", [req.params.QC_Name], (error, result) => {
            if (error) throw error
            res.render("../views/admin/viewChecklist", { Data: result, Checklist: req.params.QC_Name })
        })
    } else {
        res.redirect('/')
    }
})

admin_router.get('/viewResponses/:QC_Name', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("select *,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as Submitted_Date from responses where Checklist=? order by responses_ID limit 100", [req.params.QC_Name], (error, result) => {
            if (error) throw error
            res.render("../views/admin/viewResponses", { Data: result, Checklist: req.params.QC_Name,title:req.params.QC_Name})
        })
    } else {
        res.redirect('/')
    }
})
module.exports = admin_router;