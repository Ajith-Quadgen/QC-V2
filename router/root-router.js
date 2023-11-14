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



root_router.get("/LoginVerification", async (req, res) => {
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
            req.session.LoginOTP = null
            req.session.UserRole = "Root"
            res.status(200).json({ Message: "OTP Verification Successful" })
        } else {
            req.session.LoginOTPVerification = false
            res.status(400).json({ Message: "Invalid OTP..!" })
        }
    } else {
        res.status(400).json({ Message: "Access Denied" })
    }
})
root_router.get("/home", (req, res) => {
    if (req.session.UserID && req.session.LoginOTPVerification) {
        res.redirect('/root/home')
    } else {
        res.redirect('/login')
    }
})

root_router.get("/", (req, res) => {
    const currentDate=new Date();
    if (req.session.UserID && req.session.UserRole == "Root" && req.session.LoginOTPVerification) {
        var userData, UserCount, ChecklistCount;
        db.query(`SELECT  SUM(CASE WHEN Active = '1' THEN 1 ELSE 0 END) AS active_user,  SUM(CASE WHEN Active = '0' THEN 1 ELSE 0 END) AS inactive_users FROM users`, (error, result) => {
            if (error) {
                console.log(error)
            } else {
                UserCount = result;
            }
        })
        db.query('select * from users where Employee_ID=?', [req.session.UserID], (error, result) => {
            if (error) throw error
            userData = result[0];
        })
        db.query('select Customer,count(*) as No_Of_Checklist from checklist group by Customer', (error, result) => {
            if (error) throw error
            ChecklistCount = result;
            db.query("select *, DATE_FORMAT(`End_Date`,'%b %D %y %r') as N_End_Date,DATE_FORMAT(`Start_Date`,'%b %D %y %r') as N_Start_Date  from notifications order by Created_On Desc",(error,notifications)=>{
                if(error){
                    console.log(error);
                }else{
                    return res.render('../views/root/rootHome', { title: "Master-Dashboard", User: userData, Role: req.session.UserRole, UserCount: UserCount[0], ChecklistCount: ChecklistCount,notifications:notifications?notifications:null })
                }
            })
        })
    } else {
        res.redirect('/')
    }
});
root_router.get('/users', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
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
        basicDetails.Roles = ["Admin", "PMO", "Engineer"]
        db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users where Role!='Root'", function (error, result) {
            if (error) throw error
            let modifiedData = result.map((e) => {
                const obj = Object.assign({}, e);
                if (obj['Remark'] != null && obj['Remark'] != undefined && obj['Remark'] !== "") {
                    obj['Remark'] = JSON.parse(obj['Remark'])
                }
                return obj;
            })
            res.render('../views/root/Users', { Data: modifiedData, Checklist: checklist, Basic: basicDetails, title: "Users", Role: req.session.UserRole });
        })
    } else {
        res.redirect('/')
    }
})
root_router.post('/deleteUser', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        const id = req.body.params.userID;
        db.query("delete from users where Active=? and Employee_ID=?", [0, id], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(400).json({ Message: "Internal Server Error" });
            } else {
                if (result.affectedRows == 1) {
                    return res.status(200).json({ Message: "User Deleted Successfully..." })
                } else if (result.affectedRows == 0) {
                    return res.status(200).json({ Message: "Unable to delete the user\nPlease Make sure the user is Inactive" })
                }
            }
        })
    }
})
root_router.get("/Customers", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date from customer", function (error, result) {
            if (error) throw error
            db.query("select Customer_Name from customer", function (error, Customer_result) {
                if (error) throw error
                res.render('../views/root/Customers', { Data: result, Customer_Data: Customer_result, title: "Customers", Role: req.session.UserRole });
            })
        });
    } else {
        res.redirect('/')
    }
});

root_router.post('/deleteCustomer', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        const id = req.body.params.CustomerID;
        db.query("delete from customer where Customer_ID=?", [id], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(400).json({ Message: "Internal Server Error" });
            } else {
                console.log(result)
                if (result.affectedRows == 1) {
                    return res.status(200).json({ Message: "Customer Deleted Successfully..." })
                } else if (result.affectedRows == 0) {
                    return res.status(200).json({ Message: "Unable to delete this Customer..." })
                }
            }
        })
    }
})
root_router.get('/ListChecklist/:Customer_Name', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        db.query("select * from checklist where Customer=?", [req.params.Customer_Name], (error, result) => {
            if (error) throw error
            res.render("../views/root/ListChecklist", { Data: result, title: `${req.params.Customer_Name}-Checklist`, Role: req.session.UserRole })
        })
    } else {
        res.redirect('/')
    }
})
root_router.get('/ViewChecklist/:QC_Name', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        let sections = "";
        db.query("select * from questions where Checklist=? order by Question_ID", [req.params.QC_Name], (error, result) => {
            if (error) throw error
            db.query("select Section from questions where Checklist=? group by Section;", [req.params.QC_Name], (error, result1) => {
                if (error) throw error
                sections = result1;
                db.query("select SupportingDocLink from checklist where Checklist_Name=?", [req.params.QC_Name], (error, result2) => {
                    var SupportingDoc = result2[0].SupportingDocLink;
                    return res.render("../views/admin/viewChecklist", { Data: result, Checklist: req.params.QC_Name, Sections: sections, title: `${req.params.QC_Name}`, Role: req.session.UserRole, SupportingDoc: SupportingDoc })
                })
            })
        })
    } else {
        res.redirect('/')
    }
})

root_router.post('/dropTheCheckpoints', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        const checklistName = req.body.params.ChecklistName;
        db.query("delete from questions where Checklist=?", [checklistName], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(400).json({ Message: "Internal Server Error" });
            } else {
                console.log(result)
                if (result.affectedRows > 0) {
                    return res.status(200).json({ Message: `Every checkpoint on the ${checklistName} has been successfully deleted.` })
                } else if (result.affectedRows == 0) {
                    return res.status(200).json({ Message: "Unable to delete the Checkpoints..." })
                }
            }
        })
    }
})

root_router.post('/dropTheChecklist', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        const checklistName = req.body.params.ChecklistName;
        db.query("delete from checklist where Checklist_Name=?", [checklistName], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(400).json({ Message: "Internal Server Error" });
            } else {
                console.log("Checklist");
                if (result.affectedRows == 1) {
                    db.query("delete from questions where Checklist=?", [checklistName], (error, result1) => {
                        if (error) {
                            console.log(error)
                            return res.status(400).json({ Message: "Internal Server Error" });
                        } else {
                            return res.status(200).json({ Message: `The ${checklistName} Checklist has been successfully deleted.` })
                        }
                    })
                } else if (result.affectedRows == 0) {
                    return res.status(200).json({ Message: "Unable to delete the Checkpoints..." })
                }
            }
        })
    }
})


root_router.get('/viewResponses/:QC_Name/', (req, res) => {
    const { field, order } = req.query;
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    console.log(req.query)
    console.log(req.params)
    let sql = "select Checklist,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as New_Submitted_Date from responses where Checklist='" + req.params.QC_Name + "' group by Checklist,Submitted_Date,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By";
    if (field && order) {
        sql += ` ORDER BY ${field} ${sortOrder}`;
    } else {
        sql += ` ORDER BY Submitted_Date desc`;
    }
    if (req.session.UserID && req.session.UserRole == "Root") {
        db.query(sql, (error, result) => {
            if (error) {
                console.log(error)
            } else {
                res.render("../views/admin/viewResponses", { Data: result, Checklist: req.params.QC_Name, title: req.params.QC_Name, Role: req.session.UserRole })
            }
        })
    } else {
        res.redirect('/')
    }
})

root_router.get("/QC/:QC_Name", (req, res) => {
    let SupportingDoc = '';
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

                db.query("select SupportingDocLink from checklist where Checklist_Name=?", [req.params.QC_Name], (error, result1) => {
                    SupportingDoc = result1[0].SupportingDocLink;
                    return res.render('../views/engineer/QCPage', { Data: organizedData, title: result[0].Checklist, Role: req.session.UserRole, IncludeBackButton: false, SupportingDoc: SupportingDoc });
                })
            } else {
                res.send("Checklist is Not Prepared Yet, Contact Manager")
            }
        })

    } else {
        res.redirect('/')
    }
})

root_router.get("/Jobs", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        var Customer;
        db.query("SELECT * FROM customer", function (error, result) {
            if (error) throw error
            Customer = result
        })
        db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as ModifiedDate from jobs order by Modified_Date desc limit 100", function (error, result) {
            if (error) throw error
            res.render('../views/root/Jobs', { Data: result, CustomerList: Customer, title: "Jobs", Role: req.session.UserRole });
        });
    } else {
        res.redirect('/')
    }
});
root_router.post('/deleteJob', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Root") {
        const id = req.body.params.JobID;
        db.query("delete from jobs where Job_Number=?", [id], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(400).json({ Message: "Internal Server Error" });
            } else {
                console.log(result)
                if (result.affectedRows == 1) {
                    return res.status(200).json({ Message: `Job ${id} Deleted Successfully...` })
                } else if (result.affectedRows == 0) {
                    return res.status(200).json({ Message: "Unable to delete this job..." })
                }
            }
        })
    }
})
module.exports = root_router;
