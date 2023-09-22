const express = require('express');
const api_Router = express.Router()
const db = require('../DB-Connect')
const mail = require('nodemailer')
const multer = require('multer');
const xlsx = require('xlsx');
const excel_js = require('exceljs')
var dateTime = require('node-datetime');
let dt = dateTime.create();
let CurrentDate = dt.format('Y-m-d H:M:S');
const fs = require('fs');
const { error } = require('console');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');

const transporter = nodemailer.createTransport(
    smtpTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: 'ajith.venkatesh@quadgenwireless.com', // Your Gmail email address
            pass: 'fnucwdtycntobyon'   // Your Gmail password or app-specific password
        }
    })
);
function getTimeStamp() {
    return (new Date().toISOString().slice(0, 10) + " " + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
}

const myStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        var uploadDir = "./public/uploads/Trainer";
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    }, filename: function (req, file, cb) {
        cb(null, req.session.UserID + '_' + file.originalname + '_' + Date.now() + path.extname(file.originalname));
    }
});

const Upload = multer({ storage: multer.memoryStorage() })

api_Router.post('/AddUser', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        let inputData = req.body.params;
        inputData["Added_By"] = req.session.UserID;
        db.query("insert into users set?", [req.body.params], (error, result) => {
            if (error) {
                return res.status(400).send(error.message)
            }

            return res.status(200).send('User Added Successfully');
        })
    } else {
        res.status(400).send("Access Denied")
    }
});

api_Router.post('/updateUserStatus', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("update users set Active=? where `Employee_ID`=?", [parseInt(req.body.params.status), req.body.params.id], (error, result) => {
            if (error) {
                console.log(error)
                res.status(400).send(error)
            }
            db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users", function (error, Data) {
                if (error) {
                    console.log(error)
                    res.status(400).send(error);
                } else {
                    res.status(200).send(Data);
                }
            });

        })
    } else {
        res.status(400).send("Access Denied")
    }
})

api_Router.post('/uploadUsers', Upload.single('UserExcelFile'), (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        try {
            const data = [];
            req.file.buffer
                .toString()
                .split('\n')
                .forEach((line) => {
                    const columns = line.split(',');
                    const cleanedColumns = columns.map((col) => col.replace(/"/g, '').trim());
                    const rowData = [
                        cleanedColumns[0], // column1
                        cleanedColumns[1], // column2
                        cleanedColumns[2],
                        cleanedColumns[3],
                        cleanedColumns[4],
                        cleanedColumns[5],
                        cleanedColumns[6],
                        cleanedColumns[7]
                    ];
                    data.push(rowData);
                });
            data.shift()
            data.pop()
            const values = [data.map((row) => row)];
            const query = "Insert ignore into users (`Employee_ID`,`Full_Name`,`Email_ID`,`Designation`,`Location`,`Role`,`Reporting_Manager_Name`,`Reporting_Manager_Mail`) VALUES ? "
            db.query(query, [data], (error, result) => {
                if (error) {
                    res.status(400).send(error.message)
                } else {
                    db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users", function (error, Data) {
                        if (error) throw error
                        res.status(200).json({ "message": "User Data Imported Successfully", "Data": Data })
                    })
                }
            })
        } catch (e) {
            console.error(e)
            res.status(400).send(e.message)
        }
    } else {
        res.status(400).send("Access Denied")
    }
})

api_Router.post('/uploadJobs', Upload.single('UserExcelFile'), (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        try {
            const data = [];
            req.file.buffer
                .toString()
                .split('\n')
                .forEach((line) => {
                    const columns = line.split(',');
                    const cleanedColumns = columns.map((col) => col.replace(/"/g, '').trim());
                    const rowData = [
                        cleanedColumns[0], // column1
                        cleanedColumns[1], // column2
                        cleanedColumns[2],
                        cleanedColumns[3]
                    ];
                    data.push(rowData);
                });
            data.shift()
            data.pop()
            const values = [data.map((row) => row)];
            const query = "Insert ignore into jobs (`Job_Number`,`Customer`,`State`,`City`) VALUES ? "
            db.query(query, [data], (error, result) => {
                if (error) {
                    res.status(400).send(error.message)
                } else {
                    db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date from jobs", function (error, Data) {
                        if (error) throw error
                        res.status(200).json({ "message": "User Data Imported Successfully", "Data": Data })
                    })
                }
            })
        } catch (e) {
            console.error(e)
            res.status(400).send(e.message)
        }
    } else {
        res.status(400).send("Access Denied")
    }
})

api_Router.post('/AddJob', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        let inputData = req.body.params;
        inputData["Created_By"] = req.session.UserID;
        inputData['Created_Date'] = getTimeStamp();
        db.query("insert ignore into jobs set ?", [req.body.params], (error, result) => {
            if (error) throw error
            return res.status(200).send('Job Added Successfully');

        })
    } else {
        res.status(400).send("Access Denied")
    }
});

api_Router.post('/uploadChecklist', Upload.single('QCFile'), (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        try {
            console.log("ok")
            const workbook = xlsx.read(req.file.buffer);
            const sheetName = workbook.SheetNames[0]; // Assuming there's only one sheet
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet);
            const tableName = 'questions';
            const columns = Object.keys(data[0]).join(', ');
            let values = data.map((row) =>
                Object.values(row)
                    .map((value) => `'${value}'`)
                    .join(', ')
                    .split(",")
            );
            data.forEach(row => {
                db.query('INSERT INTO questions set ?', [row], (error, result) => {
                    if (error) {
                        console.log(error)
                    }
                })
            })
            res.status(200).send("QC Imported Successfully.\nPlease Refresh the Page.")

        } catch (e) {
            console.error(e)
            res.status(400).send(e.message)
        }
    } else {
        res.status(400).send("Access Denied")
    }
})

api_Router.post('/updateCheckList/:id', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("update questions set ? where `Question_ID`=?", [req.body.params, req.params.id], (error, result) => {
            if (error) {
                console.error(error)
                return res.status(400).send(error)
            } else {
                console.log(result)
                db.query("Select * from questions where Checklist=?", [req.body.params.Checklist], function (error, Data) {
                    if (error) {
                        console.log(error)
                        return res.status(400).send(error);
                    }
                    res.status(200).send(Data);
                });
            }
        })
    } else {
        res.status(400).send("Access Denied")
    }
})
api_Router.post('/updateCheckListStatus', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("update questions set Status=? where `Question_ID`=?", [req.body.params.status, req.body.params.id], (error, result) => {
            if (error) {
                console.error(error)
                return res.status(400).send(error)
            } else {
                db.query("Select * from questions where Checklist=?", [req.body.params.QC], function (error, Data) {
                    if (error) {
                        console.log(error)
                        return res.status(400).send(error);
                    }
                    res.status(200).send(Data);
                });
            }
        })
    } else {
        res.status(400).send("Access Denied")
    }
})

api_Router.post('/getJobData', (req, res) => {
    if (req.session.UserID) {
        db.query("select * from jobs where Job_Number=?", [req.body.params.jobID], (error, result) => {
            if (error) {
                res.status(400).send("Internal Server Error")
            }
            if (result.length > 0) {
                res.status(200).send(result[0])
            } else {
                res.status(400).send("Invalid Job/CFAS ID")
            }
        })
    } else {
        res.status(400).send("Access Denied")
    }
})
api_Router.get("/getPreciousRecord", (req, res) => {
    // if(req.session.UserID){

    // }else{
    //     res.status(400).send("Access Denied")
    // }

    db.query("select * from responses")
})
api_Router.post("/SubmitQC", (req, res) => {
    if (req.session.UserID && req.session.UserMail) {
        //console.log(req.body.params.inputData)
        let inputData = req.body.params.inputData;
        var Iter = 1;
        var time = getTimeStamp();
        db.query("select * from responses where Checklist=? and Job_ID=? and Type=? order by responses_ID desc limit 1", [inputData[0].Checklist, inputData[0].JobID, inputData[0].type], (error, result) => {
            if (error) {
                return res.status(400).json({ Message: "Internal Server Error" })
            } else {
                if (result.length > 0) {
                    Iter = result[0].Iteration
                    Iter++;
                }
                let newData = inputData.map(v => ({ ...v, Iteration: Iter, Submitted_By: req.session.UserName, Submitted_Date: time }))
                const values = newData.map(item => [null,
                    item.Checklist,
                    item.Submitted_Date,
                    item.JobID,
                    item.state,
                    item.city,
                    item.type,
                    item.Iteration,
                    item.Remarks,
                    item.Section,
                    item.Item,
                    item.Description,
                    item.Check,
                    item.Note,
                    item.Percentage,
                    item.Submitted_By]);
                db.query("insert into responses VALUES ?", [values], (error, result) => {
                    if (error) {
                        return res.status(400).json({ Message: "Internal Server Error" })
                    } else {
                        db.query("insert into qc_log (User_ID,Date,Project,QC,Job_ID,State,City,Type,Workprint_No,Iteration,Score) values (?,?,(select Customer from checklist where Checklist_Name=? ),?,?,?,?,?,?,?,?) ", [req.session.UserID, time, inputData[0].Checklist, inputData[0].Checklist, inputData[0].JobID, inputData[0].state, inputData[0].city, inputData[0].type, null, Iter, inputData[0].Percentage], async (error, result) => {
                            if (error) {
                                console.log(error)
                                return res.status(400).json({ Message: "Internal Server Error" })
                            }
                            var mycolumns = [
                                { header: "Checklist", key: "Checklist", width: 20 },
                                { header: "Date", key: "Submitted_Date", width: 20 },
                                { header: "Job-ID/CFAS", key: "JobID", width: 20 },
                                { header: "State", key: "state", width: 20 },
                                { header: "City", key: "city", width: 20 },
                                { header: "Type", key: "type", width: 20 },
                                { header: "Iteration", key: "Iteration", width: 20 },
                                { header: "Remarks", key: "Remarks", width: 20 },
                                { header: "Section", key: "Section", width: 20 },
                                { header: "Item", key: "Item", width: 20 },
                                { header: "Description", key: "Description", width: 40 },
                                { header: "Check", key: "Check", width: 20 },
                                { header: "Reviewer-Note", key: "Note", width: 20 },
                                { header: "Score-(%)", key: "Percentage", width: 20 },
                                { header: "Submitted-By", key: "Submitted_By", width: 20 }
                            ]

                            const filePath = `./public/Repository/${inputData[0].JobID}_${inputData[0].Checklist}_${inputData[0].type}.xlsx`;
                            if (fs.existsSync(filePath)) {
                                let workbook = new excel_js.Workbook();
                                await workbook.xlsx.readFile(filePath)
                                let version = workbook.worksheets.length + 1;
                                let sheetName = `V${version}_${new Date().toISOString().slice(0, 10)}`;
                                console.log(sheetName)
                                try {
                                    let sheet = workbook.addWorksheet(sheetName);
                                    sheet.columns = mycolumns;
                                    newData.forEach(record => {
                                        sheet.addRow(record)
                                    })
                                } catch (error) {
                                    console.log("Check one")
                                    console.error(error)
                                }
                                try {
                                    await workbook.xlsx.writeFile(filePath).then(() => {
                                        console.log("done")
                                    });
                                } catch (error) {
                                    console.log("Check two")
                                    console.error(error)
                                }

                            } else {
                                let workbook = new excel_js.Workbook();
                                let version = 1;
                                let sheetName = `V${version}_${new Date().toISOString().slice(0, 10)}`;
                                let sheet = workbook.addWorksheet(sheetName);
                                console.log(sheetName)
                                try {
                                    sheet.columns = mycolumns;
                                    newData.forEach(record => {
                                        sheet.addRow(record)
                                    })
                                } catch (error) {
                                    console.log("Check one")
                                    console.error(error)
                                }
                                try {
                                    await workbook.xlsx.writeFile(filePath).then(() => {
                                        console.log("done")
                                    });
                                } catch (error) {
                                    console.log("Check two")
                                    console.error(error)
                                }
                            }
                            const mailOptions = {
                                from: 'ajith.venkatesh@quadgenwireless.com',
                                to: req.session.UserMail,
                                subject: `QC Submission Confirmation Mail_${inputData[0].JobID}_${inputData[0].Checklist}_${inputData[0].type}`,
                                text: `You have Successfully Submitted the ${inputData[0].Checklist} with Score of ${inputData[0].Percentage}\nThis is System Generated Mail, No need to reply.`,
                                attachments: [
                                    {
                                        path: filePath
                                    }
                                ]
                            };

                            transporter.sendMail(mailOptions, (error, info) => {
                                if (error) {
                                    console.error('Error sending email:', error);
                                } else {
                                    console.log('Email sent:', info.response);
                                }
                            });

                            return res.status(200).json({ Message: 'QC Submitted Successfully', Score: newData[0].Percentage });

                        })
                    }
                })
            }
        })
    } else {
        res.status(400).send("Access Denied")
    }
})

api_Router.get('/DownloadQCResponses/:QC', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        let workbook = new excel_js.Workbook();
        let sheet = workbook.addWorksheet("Master-DB");
        try {
            db.query("Select * from responses where Checklist=? order by Submitted_Date", [req.params.QC], async (error, result) => {
                if (error) {
                    console.log(error)
                    res.status(400).send("Unable To fetch the Report");
                }
                if (result.length > 0) {
                    var mycolumns = [
                        { header: "Checklist", key: "Checklist", width: 20 },
                        { header: "Date", key: "Submitted_Date", width: 20 },
                        { header: "Job-ID/CFAS", key: "Job_ID", width: 20 },
                        { header: "State", key: "State", width: 20 },
                        { header: "City", key: "City", width: 20 },
                        { header: "Type", key: "Type", width: 20 },
                        { header: "Remarks", key: "Remarks", width: 20 },
                        { header: "Section", key: "Section", width: 20 },
                        { header: "Item", key: "Item", width: 20 },
                        { header: "Description", key: "Description", width: 40 },
                        { header: "Check", key: "Check", width: 20 },
                        { header: "Reviewer-Note", key: "Note", width: 20 },
                        { header: "Score-(%)", key: "Percentage", width: 20 },
                        { header: "Submitted-By", key: "Submitted_By", width: 20 }
                    ]
                    sheet.columns = mycolumns
                    result.forEach(row => {
                        sheet.addRow(row)
                    });
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', 'attachment; filename=QC_sResponse_Report.xlsx');
                    const filename = req.params.QC.replace(" ", "_") + req.session.UserID + ".xlsx"
                    let filestream
                    await workbook.xlsx.writeFile(filename).then(async () => {
                        filestream = await fs.createReadStream(filename)
                    }).catch((error) => {
                        console.log(error)
                    })
                    filestream = await fs.createReadStream(filename)
                    filestream.pipe(res)

                    fs.unlink(filename, (error) => {
                        if (error) {
                            throw error
                        }
                    })

                } else {
                    res.send("Data Not Found")
                }
            })
        } catch (error) {
            console.log(error)
            res.status(400).send(error.message)
        }
    } else {
        res.status(400).send("Access Denied")
    }
})
api_Router.post('/filterResponses', (req, res) => {
    if (req.session.UserID) {
        var data = req.body.params;
        let main;
        let query1 = `select *,DATE_FORMAT(Submitted_Date,'%b %D %y %r') as Submitted_Date from responses where Job_ID='${data.id}' or Type='${data.type}' or Submitted_Date between '${data.from}' and '${data.to}' order by responses_ID desc`
        let query2 = `select *,DATE_FORMAT(Submitted_Date,'%b %D %y %r') as Submitted_Date from responses where Job_ID='${data.id}' or Type='${data.type}' order by responses_ID desc`
        let query3 = `select *,DATE_FORMAT(Submitted_Date,'%b %D %y %r') as Submitted_Date from responses where Job_ID='${data.id}' and Type='${data.type}' order by responses_ID desc`

        if (data.from && data.to) {
            main = query1
        } else if(data.id && data.type) { main = query3 }else{main=query2}
        db.query(main, (error, result) => {
            if (error) {
                console.error(error)
                res.status(400).send("Unable to Apply Filer")
            } else {
                res.status(200).send(result)
            }
        })
    } else {
        res.status(400).send("Access Denied")
    }
})
module.exports = api_Router;