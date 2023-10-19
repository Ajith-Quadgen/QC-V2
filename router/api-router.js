
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
const { error, log } = require('console');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const path = require('path');
const { resume } = require('pdfkit');
const parse = require('csv-parser')
const streamifier = require('streamifier')

const transporter = nodemailer.createTransport(
    smtpTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // true for 465, false for other ports

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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
        let inputData = req.body.params;
        inputData["Added_By"] = req.session.UserName;
        db.query("select Full_Name,Email_ID from users where Employee_ID=?", [req.body.params.Reporting_Manager_ID], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(400).json({ Message: "Internal Server Error" })
            }
            if (result.length > 0) {
                inputData["Reporting_Manager_Name"] = result[0].Full_Name;
                inputData['Reporting_Manager_Mail'] = result[0].Email_ID;
                delete inputData.Reporting_Manager_ID;
            }
            db.query("insert into users set?", [inputData], (error, result) => {
                if (error) {
                    console.log(error)
                    if (error.code == 'ER_DUP_ENTRY') {
                        return res.status(400).json({ Message: "Employee-ID/Email is Already Present in the DataBase." })
                    } else if (error.sqlState == "45000") {
                        return res.status(406).json({ Message: "The Employee ID/Email is not in exact format, Operation Failed ...!" })
                    } else {
                        return res.status(400).json({ Message: "Internal Server Error" })
                    }
                } db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users", function (error, result) {
                    if (error) throw error
                    return res.status(200).json({ Message: 'User Added Successfully...', Data: result });

                })
            })
        })
    } else {
        res.status(400).send("Access Denied")
    }
});

api_Router.post('/updateUserStatus', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
        try {
            const data = [];
            const bufferStream = streamifier.createReadStream(req.file.buffer);
            let EmptyField = false;
            bufferStream
                .pipe(parse())
                .on('data', row => {
                    if (Object.values(row).some(value => value === '' || value === undefined || value === null)) {
                        EmptyField = true;
                    }
                    row["Added_By"] = req.session.UserName;
                    data.push(row);
                })
                .on('end', () => {
                    const tableName = 'users';
                    const insertionPromises = [];
                    if (EmptyField = true) {
                        return res.status(406).json({ Message: 'CSV contains empty fields. Please ensure all fields are  filled with appropriate values.' });
                    }
                    data.forEach(row => {
                        const query = `INSERT IGNORE INTO ${tableName} SET ?`;
                        const insertionPromise = new Promise((resolve, reject) => {
                            db.query(query, [row], (error, result) => {
                                if (error) {
                                    //console.log(error);
                                    reject(error);
                                } else {
                                    resolve(result);
                                }
                            });
                        });
                        insertionPromises.push(insertionPromise);
                    });
                    Promise.all(insertionPromises)
                        .then(() => {
                            console.log('All Users data inserted successfully.');
                            db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users where Role!='Root'", function (error, Data) {
                                if (error) throw error
                                res.status(200).json({ Message: "User Data Imported Successfully", Data: Data })
                            })
                        })
                        .catch(error => {
                            console.error('Error inserting data:', error);
                            if (error.code == "ER_BAD_FIELD_ERROR") {
                                return res.status(406).json({ Message: "Since the uploaded CSV file does not fit the users' template, data import is unsuccessful." })
                            } else if (error.sqlState == "45000") {
                                return res.status(406).json({ Message: "Some Employee ID/Email is not Exact Format, That records are not Imported...!" })
                            } else {
                                return res.status(500).json({ Message: "Internal Server Error." })
                            }

                        });
                });
        } catch (e) {
            console.error(e)
            res.status(400).json({ Message: e.message })
        }
    } else {
        res.status(400).send("Access Denied")
    }
})





api_Router.post('/uploadUsers(old)', Upload.single('UserExcelFile'), (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
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

api_Router.post('/uploadJobs(old)', Upload.single('UserExcelFile'), (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
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
                    db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as Modified_Date from jobs order by Created_Date Desc limit 100", function (error, Data) {
                        if (error) throw error
                        res.status(200).json({ "message": "Job Data Imported Successfully", "Data": Data })
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
        try {
            const data = [];
            const bufferStream = streamifier.createReadStream(req.file.buffer);
            let EmptyField = false;
            bufferStream
                .pipe(parse())
                .on('data', row => {
                    if (Object.values(row).some(value => value === '' || value === undefined || value === null)) {
                        EmptyField = true;
                    }
                    row["Created_By"] = req.session.UserName;
                    data.push(row);
                })
                .on('end', () => {
                    const tableName = 'jobs';
                    const insertionPromises = [];
                    if (EmptyField = true) {
                        return res.status(406).json({ Message: 'CSV contains empty fields. Please ensure all fields are  filled with appropriate values.' });
                    }
                    data.forEach(row => {
                        const query = `INSERT IGNORE INTO ${tableName} SET ?`;
                        const insertionPromise = new Promise((resolve, reject) => {
                            db.query(query, [row], (error, result) => {
                                if (error) {
                                    //console.log(error);
                                    reject(error);
                                } else {
                                    resolve(result);
                                }
                            });
                        });
                        insertionPromises.push(insertionPromise);
                    });
                    Promise.all(insertionPromises)
                        .then(() => {
                            console.log('All job data inserted successfully.');
                            db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as Modified_Date from jobs order by Created_Date Desc limit 100", function (error, Data) {
                                if (error) throw error
                                res.status(200).json({ Message: "Job Data Imported Successfully", Data: Data })
                            })
                        })
                        .catch(error => {
                            console.error('Error inserting data:', error);
                            if (error.code == "ER_BAD_FIELD_ERROR") {
                                return res.status(406).json({ Message: "Since the uploaded CSV file does not fit the Job template, data import is unsuccessful." })
                            } else {
                                return res.status(500).json({ Message: "Internal Server Error." })
                            }

                        });
                });

        } catch (e) {
            console.error(e)
            res.status(400).send(e.message)
        }
    } else {
        res.status(400).send("Access Denied")
    }
})


api_Router.post('/AddJob', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
        let inputData = req.body.params;
        inputData["Created_By"] = req.session.UserName;
        inputData['Created_Date'] = getTimeStamp();
        inputData['Modified_Date'] = getTimeStamp();
        db.query("insert into jobs set ?", [req.body.params], (error, result) => {
            if (error) {
                if (error.code == 'ER_DUP_ENTRY') {
                    return res.status(400).json({ Message: `The Job-ID/CFAS Number "${inputData.Job_Number}" is already exist in the DataBase` })
                } else {
                    console.log(error)
                    return res.status(400).json({ Message: "Internal Server Error" })
                }
            } else {
                db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as Modified_Date from jobs limit 100", function (error, result) {
                    if (error) throw error
                    return res.status(200).json({ Message: `Job "${inputData.Job_Number}" Added Successfully`, Data: result });
                })
            }
        })
    } else {
        res.status(400).send("Access Denied")
    }
});

api_Router.post("/GetJob", (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
        db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as Modified_Date from jobs where Job_Number=?", [req.body.params.id], (error, result) => {
            if (error) {
                console.log(error)
                res.status(400).send("Internal Server Error")
            } else {
                res.status(200).send(result)
            }
        })
    } else {
        res.status(400).send("Access Denied")
    }
})

api_Router.post('/uploadChecklist', Upload.single('QCFile'), (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        try {
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
            const insertionPromises = [];
            data.forEach(row => {
                const insertionPromise = new Promise((resolve, reject) => {
                    db.query('INSERT INTO questions set ?', [row], (error, result) => {
                        if (error) {
                            console.log(error)
                            reject(error)
                        } else {
                            resolve(result);
                        }
                    });
                });
                insertionPromises.push(insertionPromise);
            });
            Promise.all(insertionPromises).then(() => {
                res.status(200).send("QC Imported Successfully.\nPlease Refresh the Page.")

            }).catch(() => {
                return res.status(500).send("Something Went Wrong While Importing the QC... \nTry Again..!");
            })

        } catch (e) {
            console.error(e)
            return res.status(400).send(e.message)
        }
    } else {
        return res.status(400).send("Access Denied")
    }
})

api_Router.post('/updateCheckList/:id', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin") {
        db.query("update questions set ? where `Question_ID`=?", [req.body.params, req.params.id], (error, result) => {
            if (error) {
                console.error(error)
                return res.status(400).send(error)
            } else {
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
        db.query("SELECT * FROM jobs where Job_Number=? and Customer in (select Customer from checklist where Checklist_Name=?)", [req.body.params.jobID, req.body.params.Checklist], (error, result) => {
            if (error) {
                console.log(error)
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
                    item.SlNo,
                    item.Item,
                    item.Description,
                    item.Check,
                    item.Note,
                    item.Percentage,
                    item.Submitted_By]);
                db.query("insert into responses VALUES ?", [values], (error, result) => {
                    if (error) {
                        console.error(error)
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
                                { header: "Section", key: "Section", width: 20 },
                                { header: "Sl.No", key: "SlNo", width: 20 },
                                { header: "Item", key: "Item", width: 20 },
                                { header: "Description", key: "Description", width: 40 },
                                { header: "Check", key: "Check", width: 20 },
                                { header: "Reviewer-Note", key: "Note", width: 20 },
                                { header: "Score-(%)", key: "Percentage", width: 20 },
                                { header: "Submitted-By", key: "Submitted_By", width: 20 },
                                { header: "Remarks", key: "Remarks", width: 20 }
                            ]

                            const filePath = `./public/Repository/${inputData[0].JobID}_${inputData[0].Checklist}_${inputData[0].type}.xlsx`;
                            if (fs.existsSync(filePath)) {
                                let workbook = new excel_js.Workbook();
                                await workbook.xlsx.readFile(filePath)
                                let version = workbook.worksheets.length + 1;
                                let sheetName = `V${version}_${new Date().toISOString().slice(0, 10)}`;
                                try {
                                    let sheet = workbook.addWorksheet(sheetName);
                                    sheet.columns = mycolumns;
                                    newData.forEach(record => {
                                        sheet.addRow(record)
                                    })
                                } catch (error) {
                                    console.error(error)
                                    return res.status(400).json({ Message: "Internal Server Error" });
                                }
                                try {
                                    await workbook.xlsx.writeFile(filePath).then(() => {
                                    });
                                } catch (error) {
                                    console.error(error)
                                    return res.status(400).json({ Message: "Internal Server Error" });
                                }

                            } else {
                                let workbook = new excel_js.Workbook();
                                let version = 1;
                                let sheetName = `V${version}_${new Date().toISOString().slice(0, 10)}`;
                                let sheet = workbook.addWorksheet(sheetName);
                                try {
                                    sheet.columns = mycolumns;
                                    newData.forEach(record => {
                                        sheet.addRow(record)
                                    })
                                } catch (error) {
                                    console.error(error)
                                    return res.status(400).json({ Message: "Internal Server Error" });
                                }
                                try {
                                    await workbook.xlsx.writeFile(filePath).then(() => {
                                    });
                                } catch (error) {
                                    console.error(error)
                                    return res.status(400).json({ Message: "Internal Server Error" });
                                }
                            }
                            const mailOptions = {
                                from: 'software.development@quadgenwireless.com ',
                                to: req.session.UserMail,
                                cc: req.session.RMail,
                                subject: `QC Submission Confirmation Mail_${inputData[0].JobID}_${inputData[0].Checklist}_${inputData[0].type}`,
                                html: `<h3>Hi ${req.session.UserName}</h3><br>You have Successfully Submitted the <b>${inputData[0].Checklist}</b> with Score of <b>${inputData[0].Percentage}%.</b><br>This is System Generated Mail, no need to reply.<br><br><br>Regards`,
                                attachments: [
                                    {
                                        path: filePath
                                    }
                                ]
                            };
                            db.query("UPDATE users SET No_of_Submission=No_of_Submission+1 where Employee_ID=?", [req.session.UserID], (error, result) => {
                                if (error) {
                                    console.log(error)
                                    return res.status(400).json({ Message: "Something Went Wrong... Unable to Complete the Submission", Score: "0" })
                                } else {
                                    db.query("UPDATE jobs SET Number_Of_Responses=Number_Of_Responses+1,Modified_Date=?  where Job_Number=?", [getTimeStamp(), inputData[0].JobID], (error, result) => {
                                        if (error) {
                                            console.log(error)
                                            return res.status(400).json({ Message: "Something Went Wrong... Unable to Complete the Submission", Score: "0" })
                                        } else {
                                            transporter.sendMail(mailOptions, (error, info) => {
                                                if (error) {
                                                    console.error('Error on sending email:', error);
                                                    return res.status(400).json({ Message: "QQ Submitted Successfully....Unable to send the Confirmation E-Mail\nPlease Contact the Manager" })
                                                }
                                            });
                                            return res.status(200).json({ Message: 'QC Submitted Successfully', Score: newData[0].Percentage });
                                        }
                                    })
                                }
                            });
                        })
                    }
                })
            }
        })
    } else {
        return res.status(400).json({ Message: "Unfortunately Your Session Got Closed,Please Try Again...!" });
    }
})
api_Router.get('/DownloadQCResponses/:QC', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
        let workbook = new excel_js.Workbook();
        let sheet = workbook.addWorksheet("Master-DB");
        try {
            db.query("Select *,DATE_FORMAT(`Submitted_Date`,'%d-%m-%Y') as SubmittedDate from responses where Checklist=? order by Submitted_Date", [req.params.QC], async (error, result) => {
                if (error) {
                    console.log(error)
                    res.status(400).send("Unable To fetch the Report");
                }
                if (result.length > 0) {
                    var mycolumns = [
                        { header: "Checklist", key: "Checklist", width: 20 },
                        { header: "Date", key: "SubmittedDate", width: 20 },
                        { header: "Job-ID/CFAS", key: "Job_ID", width: 20 },
                        { header: "State", key: "State", width: 20 },
                        { header: "City", key: "City", width: 20 },
                        { header: "Type", key: "Type", width: 20 },
                        { header: "Iteration", key: "Iteration", width: 20 },
                        { header: "Section", key: "Section", width: 20 },
                        { header: "Sl.No", key: "SlNo", width: 20 },
                        { header: "Item", key: "Item", width: 20 },
                        { header: "Description", key: "Description", width: 40 },
                        { header: "Check", key: "Check", width: 20 },
                        { header: "Reviewer-Note", key: "Note", width: 20 },
                        { header: "Score-(%)", key: "Percentage", width: 20 },
                        { header: "Submitted-By", key: "Submitted_By", width: 20 },
                        { header: "Remarks", key: "Remarks", width: 20 },
                    ]
                    sheet.columns = mycolumns
                    result.forEach(row => {
                        sheet.addRow(row)
                    });
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', 'attachment; filename=Master_QC_Response_Report.xlsx');
                    const filename = path.join(__dirname, "../public/Generated/" + req.params.QC.replace(" ", "_") + req.session.UserID + ".xlsx")
                    let filestream
                    await workbook.xlsx.writeFile(filename).then(async () => {
                        filestream = await fs.createReadStream(filename)
                    }).catch((error) => {
                        console.log(error)
                    })
                    filestream = await fs.createReadStream(filename)
                    filestream.pipe(res)
                    setTimeout(() => {
                        fs.unlink(filename, (error) => {
                            if (error) {
                                throw error
                            }
                        })
                    }, 2000)
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
        const { Checklist, from, to, id, type } = req.body.params;
        let main = "select Checklist,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as Submitted_Date from responses where Checklist='" + Checklist + "'";
        if (from) {
            main += `AND date_format(Submitted_Date,'%Y-%m-%d')>='${from}'`
        }
        if (to) {
            main += `AND date_format(Submitted_Date,'%Y-%m-%d')<='${to}'`
        }
        if (id) {
            main += `AND Job_ID='${id}'`
        }
        if (type) {
            main += `AND Type='${type}'`
        }
        main += "group by Checklist,Submitted_Date,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By order by Submitted_Date desc ";
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

api_Router.get('/downloadFilteredContent', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
        const { Checklist, from, to, id, type } = req.query;
        console.log(req.query)
        let workbook = new excel_js.Workbook();
        let sheet = workbook.addWorksheet("Responses");

        let main = "Select *,DATE_FORMAT(`Submitted_Date`,'%d-%m-%Y') as SubmittedDate from responses where Checklist='" + Checklist + "'";
        if (from) {
            main += `AND date_format(Submitted_Date,'%Y-%m-%d')>='${from}'`
        }
        if (to) {
            main += `AND date_format(Submitted_Date,'%Y-%m-%d')<='${to}'`
        }
        if (id) {
            main += `AND Job_ID='${id}'`
        }
        if (type) {
            main += `AND Type='${type}'`
        }

        db.query(main, async function (error, result) {
            if (error) {
                console.log(error)
                return res.status(400)
            }
            var mycolumns = [
                { header: "Checklist", key: "Checklist", width: 20 },
                { header: "Date", key: "SubmittedDate", width: 20 },
                { header: "Job-ID/CFAS", key: "Job_ID", width: 20 },
                { header: "State", key: "State", width: 20 },
                { header: "City", key: "City", width: 20 },
                { header: "Type", key: "Type", width: 20 },
                { header: "Iteration", key: "Iteration", width: 20 },
                { header: "Section", key: "Section", width: 20 },
                { header: "Sl.No", key: "SlNo", width: 20 },
                { header: "Item", key: "Item", width: 20 },
                { header: "Description", key: "Description", width: 40 },
                { header: "Check", key: "Check", width: 20 },
                { header: "Reviewer-Note", key: "Note", width: 20 },
                { header: "Score-(%)", key: "Percentage", width: 20 },
                { header: "Submitted-By", key: "Submitted_By", width: 20 },
                { header: "Remarks", key: "Remarks", width: 20 },
            ]
            sheet.columns = mycolumns
            result.forEach(row => {
                sheet.addRow(row)
            });
            try {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=QC-Filtered-Data.xlsx');
                await workbook.xlsx.write(res);

            } catch (error) {
                console.log(error)
                res.status(400).send(error.message)
            }
        })
    }
})

api_Router.post('/UpdatePassword', (req, res) => {
    if (req.session.UserID) {
        db.query("update users set Password=? where Employee_ID=?", [req.body.params.newPassword, req.session.UserID], (error, result) => {
            if (error) {
                console.log(error)
                res.status(400).send("Unable To Update Password")
            } else {
                res.status(200).send("Updated Successfully")
            }
        })

    } else {
        res.status(400).send("Access Denied")
    }
})
api_Router.get('/getUserDetails', (req, res) => {
    if (req.session.UserID) {
        let checklist;
        db.query("select * from checklist", (error, result) => {
            if (error) {
                console.log(error)
                return res.status(500).json({ Message: "Internal Server Error" })
            } else {
                checklist = result;
            }
        })
        db.query("Select * from users where Employee_ID=?", [req.query.UserID], (error, result) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ Message: "Internal Server Error" })
            } else {
                return res.status(200).json({ UserData: result[0], Checklist: checklist })
            }
        })
    } else {
        res.status(500).json({ Message: "Access Denied" })
    }
})
api_Router.post('/UpdateUser', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO") {
        let inputData = req.body.params;
        inputData["Added_By"] = req.session.UserName;
        db.query("update users set ? where Employee_ID=?", [inputData, req.body.params.Employee_ID], (error, result) => {
            if (error) {
                return res.status(400).send(error.message)
            }
            db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users", function (error, result) {
                if (error) throw error
                return res.status(200).json({ Message: 'User Details Updated Successfully...', Data: result });
            })
        })
    } else {
        res.status(400).send("Access Denied")
    }
});


api_Router.get('/GetUser', (req, res) => {
    if (req.session.UserID) {
        db.query("select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users where Employee_ID like '%" + req.query.key + "%' or Full_Name like '%" + req.query.key + "%'", (error, result) => {
            if (error) {
                console.log(error)
                res.status(400).send("Internal Server Error")
            } else if (result.length > 0) {
                res.status(200).send(result)
            } else {
                res.status(400).send("Data Not Found")
            }
        })
    } else {
        res.status(400).send("Access Denied")
    }
})
api_Router.get('/downloadJob', async (req, res) => {
    if (req.session.UserID) {
        let workbook = new excel_js.Workbook();
        let sheet = workbook.addWorksheet("Job Data");
        db.query("SELECT * FROM jobs", async (error, result) => {
            var mycolumns = [
                { header: "Job-ID/CFAS Number", key: "Job_Number", width: 20 },
                { header: "Customer", key: "Customer", width: 20 },
                { header: "State", key: "State", width: 20 },
                { header: "City", key: "City", width: 20 },
                { header: "Workprint Number", key: "Workprint_Number", width: 20 },
                { header: "Number Of Responses", key: "Number_Of_Responses", width: 20 },
                { header: "Created Date", key: "Created_Date", width: 20 },
                { header: "Created By", key: "Created_By", width: 20 },
                { header: "Modified Date", key: "Modified_Date", width: 20 }
            ]
            sheet.columns = mycolumns
            result.forEach(row => {
                sheet.addRow(row)
            })

            try {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=Jobs-Data.xlsx');
                await workbook.xlsx.write(res);

            } catch (error) {
                console.log(error)
                res.status(400).send(error.message)
            }
        });
    } else {
        res.status(400).send("Access Denied")
    }
})
api_Router.get('/getPreciousRecord', (req, res) => {
    if (req.session.UserID) {
        db.query("select Checklist,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as Submitted_Date from responses where Type=? and Job_ID=? group by Checklist,Submitted_Date,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By order by Submitted_Date desc limit 2",[req.query.type,req.query.job_id],(error,result)=>{
            if(error){
                console.log(error)
                return res.status(406).json({Message:"Internal Server Error"})
            }else{
                if(result.length>0){
                    return res.status(200).json({Data:result})
                }else{
                    return res.status(200).json({Data:null})
                }
            }
        })
    } else {
        res.status(400).json({ Message: "Access Denied" })
    }
})
module.exports = api_Router;
