
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
const { resume, file } = require('pdfkit');
const parse = require('csv-parser')
const streamifier = require('streamifier');
const { type } = require('os');
const crypto = require('crypto');
const { forEach } = require('jszip');
const transporter = nodemailer.createTransport(
    smtpTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: 'software.development@quadgenwireless.com ', // Your Gmail email address
            pass: 'mrzpgphmoulavifx '   // Your Gmail password or app-specific password
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
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
                    let modifiedData = result.map((e) => {
                        const obj = Object.assign({}, e);
                        if (obj['Remark'] != null && obj['Remark'] != undefined && obj['Remark'] !== "") {
                            obj['Remark'] = JSON.parse(obj['Remark'])
                        }
                        return obj;
                    })
                    return res.status(200).json({ Message: 'User Added Successfully...', Data: modifiedData });

                })
            })
        })
    } else {
        res.status(400).send("Access Denied")
    }
});

api_Router.post('/updateUserStatus', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
        let Remark = {
            By: req.session.UserName,
            Remark: req.body.params.remark
        }
        db.query("update users set Active=?, Remark=? where Employee_ID=?", [parseInt(req.body.params.status), JSON.stringify(Remark), req.body.params.id], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(400).send(error)
            }
            db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users", function (error, Data) {
                if (error) {
                    console.log(error)
                    return res.status(400).send(error);
                } else {
                    let modifiedData = Data.map((e) => {
                        const obj = Object.assign({}, e);
                        if (obj['Remark'] != null && obj['Remark'] != undefined && obj['Remark'] !== "") {
                            obj['Remark'] = JSON.parse(obj['Remark'])
                        }
                        return obj;
                    })
                    return res.status(200).send(modifiedData);
                }
            });

        })
    } else {
        res.status(400).send("Access Denied")
    }
})




api_Router.post('/uploadUsers', Upload.single('UserExcelFile'), (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
        try {
            const data = [];
            const bufferStream = streamifier.createReadStream(req.file.buffer);
            var EmptyField = false;
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
                    if (EmptyField == true) {
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
                    const DefaultPassword='User@123';
                    const portalURL='https://172.17.1.22:5000'
                    const emailData = data.map((user) => ({
                        from: 'software.development@quadgenwireless.com',
                        to: user.Email_ID,
                        subject: "Welcome to OSP QC-Portal",
                        html: `<!DOCTYPE html>
                        <html lang="en">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Document</title>
                        </head>
                        <body>
                            <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 5px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                                <h1 style="color: #333;">Welcome, ${user.Full_Name}!</h1>
                                <p style="color: #666;">You have been successfully added to our portal.</p>
                                <p style="color: #666;">Your login credentials are as follows:</p>
                                <p style="color: #666;"><strong>Username:</strong> ${user.Employee_ID}</p>
                                <p style="color: #666;"><strong>Password:</strong> ${DefaultPassword}</p>
                                <p style="color: #666;">Please change your password once you have successfully logged in. Be sure to keep your login information secure.</p>
                                <p style="color: #666;">You can access our portal by visiting <a href="${portalURL}">${portalURL}</a>.</p>
                                <p style="color: #666;">If you have any questions or need assistance, please don't hesitate to contact our support team at <a href="mailto:software.development@quadgenwireless.com">software.development@quadgenwireless.com</a>.</p>
                        </body>
                        </html>   `,
                    }));
                    const emailPromises = emailData.map((mailOptions) => {
                        return new Promise(async (resolve, reject) => {
                            try {
                                const info = await transporter.sendMail(mailOptions);
                                console.log("Message sent: " + info.response);
                                resolve();
                            } catch (error) {
                                console.error("Error sending email:", error);
                                resolve(); // Resolve the promise even in case of an error to continue processing other emails
                            }
                        });
                    });

                    Promise.all(emailPromises)
                        .then(() => {
                            console.log("All emails sent successfully.");
                            transporter.close();
                        })
                        .catch((error) => {
                            console.error("Error sending emails:", error);
                            transporter.close();
                        });
                    Promise.all([insertionPromises,emailPromises])
                        .then(() => {
                            console.log('All Users data inserted successfully.');
                            db.query("Select *,DATE_FORMAT(`Lastseen`,'%b %D %y %r') as lastSeen from users where Role!='Root'", function (error, Data) {
                                if (error) throw error
                                let modifiedData = Data.map((e) => {
                                    const obj = Object.assign({}, e);
                                    if (obj['Remark'] != null && obj['Remark'] != undefined && obj['Remark'] !== "") {
                                        obj['Remark'] = JSON.parse(obj['Remark'])
                                    }
                                    return obj;
                                })
                                res.status(200).json({ Message: "User Data Imported Successfully", Data: modifiedData })
                            })
                        })
                        .catch(error => {
                            console.error('Error inserting data:', error);
                            if (error.code == "ER_BAD_FIELD_ERROR" || error.code == 'ER_PARSE_ERROR') {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
        try {
            const data = [];
            const bufferStream = streamifier.createReadStream(req.file.buffer);
            var EmptyField = false;
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
                    if (EmptyField == true) {
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
                            db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as ModifiedDate from jobs order by Modified_Date Desc limit 100", function (error, Data) {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
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
                db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as ModifiedDate from jobs order by Modified_Date Desc limit 100", function (error, result) {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
        db.query("Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as ModifiedDate from jobs where Job_Number=?", [req.body.params.id], (error, result) => {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "Root") {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "Root") {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "Root") {
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
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
        const { Checklist, from, to, id, type, sortField, order } = req.body.params;
        let main = "select Checklist,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as New_Submitted_Date from responses where Checklist='" + Checklist + "'";
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
        main += "group by Checklist,Submitted_Date,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By order by ";
        if (sortField && order) {
            main += `${sortField} ${order}`
        } else {
            main += 'Submitted_Date desc';
        }
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
        const { Checklist, from, to, id, type } = req.query;
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
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "PMO" || req.session.UserRole == "Root") {
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
        if (req.query.type == "IQC") {


            db.query("select Checklist,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as Submitted_Date from responses where Job_ID=? group by Checklist,Submitted_Date,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By order by Iteration desc", [req.query.job_id], (error, result1) => {
                if (error) {
                    console.log(error)
                    return res.status(406).json({ Message: "Internal Server Error" })
                } else {
                    if (result1.length > 0) {
                        var temp = {};
                        for (const item of result1) {
                            const type = item.Type;
                            if (!temp[type] || item.Iteration > temp[type].Iteration) {
                                temp[type] = item;
                            }
                        }
                        const result = Object.keys(temp).map(type => temp[type])
                        console.log(result)
                        var hasSelfQc = false;
                        result.forEach(record => {
                            if (record.Type == 'Self QC') hasSelfQc = true
                        })
                        if (hasSelfQc) {
                            return res.status(200).json({ Data: result, Self_QC: true })
                        } else {
                            return res.status(200).json({ Data: result, Self_QC: false })
                        }
                    } else {
                        return res.status(200).json({ Data: null, Self_QC: false })
                    }
                }
            })
        } else {
            db.query("select Checklist,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By,DATE_FORMAT(`Submitted_Date`,'%b %D %y %r') as Submitted_Date from responses where Type=? and Job_ID=? group by Checklist,Submitted_Date,Job_ID,State,City,Type,Iteration,Percentage,Submitted_By order by Iteration desc limit 1", [req.query.type, req.query.job_id], (error, result) => {
                if (error) {
                    console.log(error)
                    return res.status(406).json({ Message: "Internal Server Error" })
                } else {
                    if (result.length > 0) {
                        return res.status(200).json({ Data: result })
                    } else {
                        return res.status(200).json({ Data: null })
                    }
                }
            })
        }
    } else {
        res.status(400).json({ Message: "Access Denied" })
    }
})
api_Router.post('/GeneratePasswordResetOPT', async (req, res) => {
    let n = 0;
    n = crypto.randomInt(100000, 999999)
    db.query("Select * from users where Active=1 and Employee_ID=?", [req.body.params.UserID], async (error, result) => {
        if (error) {
            console.log(error)
            return res.status(406).json({ Message: "Unable to find your Details, Try after sometime...!" })
        } else {
            if (result.length > 0) {
                const mailOptions = {
                    from: 'software.development@quadgenwireless.com ',
                    to: result[0].Email_ID,
                    subject: `OTP For Password Generation is_${n}`,
                    html: `<h3>Hi ${result[0].Full_Name}</h3><br>The One Time Password for Generating new Login Credentials for QC-Portal is<b><h2>${n}</h2></b><br>This is OTP will Expire in 5 Min.<br><br><br>Regards`,
                };
                await transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error on sending email:', error);
                        req.session.PWDResetOTP = null;
                        res.status(406).json({ Message: "Failed to Generate OTP, Try again...!" })
                    } else {
                        req.session.PWDResetOTP = n;
                        req.session.PWDresetEmail = result[0].Email_ID;
                        req.session.PWDResetUserID = req.body.params.UserID;
                        res.status(200).json({ Message: "The OTP is sent to your mail" })
                    }
                });
            } else {
                return res.status(406).json({ Message: "Unable to find your Details, Try after sometime...!" })
            }
        }
    })

})

api_Router.post("/GenerateNewPassword", (req, res) => {
    const UserOTP = req.body.params.OTP;
    if (req.session.PWDResetOTP == UserOTP) {
        const RandomPWD = Math.random().toString(36).substring(2, 12);
        db.query("update users set Password=? where Employee_ID=? and Email_ID=? and active=1", [RandomPWD, req.session.PWDResetUserID, req.session.PWDresetEmail], (error, result) => {
            if (error) {
                console.log(error)
                return res.status(406).json({ Message: "Something Went wrong, Unable to Generate New Password." })
            } else {
                const mailOptions = {
                    from: 'software.development@quadgenwireless.com ',
                    to: req.session.PWDresetEmail,
                    subject: `New Password for QC-Portal-`,
                    html: `<h3>Hi</h3>
                    The New Login Credentials for QC-Portal is:<br>
                    <p><b>UserID:</b> ${req.session.PWDResetUserID}</p>
                    <p><b>Password:</b> ${RandomPWD}<br></p></br>
                    <b>Note:</b> After Login Please Change Your Password.
                    <br><br>--<br>Regards`,
                };
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error on sending email:', error);
                        req.session.PWDResetOTP = null;
                        req.session.PWDResetUserID = null;
                        req.session.PWDresetEmail = null;
                        return res.status(406).json({ Message: "Something Went wrong, Unable to Generate New Password." })
                    } else {
                        req.session.PWDResetOTP = null;
                        req.session.PWDResetUserID = null;
                        req.session.PWDresetEmail = null;
                        return res.status(200).json({ Message: "OTP Verification Successful\nNew Password has been shared to you vai Email." })
                    }
                });
            }
        })

    } else {
        return res.status(406).json({ Message: "Invalid OTP,Try again...!" })
    }
})

api_Router.post('/sortJob', (req, res) => {
    if (req.session.UserID) {
        const { filed, order } = req.body.params;
        let main = "Select *,DATE_FORMAT(`Created_Date`,'%b %D %y %r') as Created_Date,DATE_FORMAT(`Modified_Date`,'%b %D %y %r') as ModifiedDate from jobs order by ";

        if (filed && order) {
            main += `${filed} ${order} limit 100`
        } else {
            main += ' Modified_Date desc limit 100 ';
        }
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
api_Router.post('/updateFAQ', (req, res) => {
    if (req.session.UserID && req.session.UserRole == "Admin" || req.session.UserRole == "Root") {

        fs.truncate("faq.txt", 0, function () {
            fs.writeFile("faq.txt", req.body.params.Data, function (err) {
                if (err) {
                    console.log("Error writing file: " + err);
                    return res.status(400).json({ Message: err })
                } else {
                    fs.readFile('faq.txt', 'utf-8', (error, data) => {
                        return res.status(200).json({ Message: "FAQ Updated Successfully", NewData: data })
                    })
                }
            });
        });
    } else {
        return res.status(400).json({ Message: "Access Denied" })
    }
})
module.exports = api_Router;
