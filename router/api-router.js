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
                    console.log("ok4")
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

api_Router.post('/updateCheckListStatus/:id', (req, res) => {
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

api_Router.post("/SubmitQC", (req, res) => {
    if (req.session.UserID) {
        //console.log(req.body.params.inputData)
        let inputData = req.body.params.inputData;
        let newData = inputData.map(v => ({ ...v, Submitted_By: req.session.UserName, Submitted_Date: getTimeStamp() }))
        const values = newData.map(item => [null,
            item.Checklist,
            item.Submitted_Date,
            item.JobID,
            item.state,
            item.city,
            item.type,
            item.Remarks,
            item.Section,
            item.Item,
            item.Description,
            item.Check,
            item.Note,
            item.Percentage,
            item.Submitted_By]);
        db.query("insert into responses VALUES ?", [values], (error, result) => {
            if (error) throw error
            return res.status(200).json({ Message: 'QC Submitted Successfully', Score: newData[0].Percentage });
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
                    const filename = req.params.QC.replace(" ","_") + req.session.UserID + ".xlsx"
                    await workbook.xlsx.writeFile(`public/Generated/${filename}`)
                    const filestream = fs.createReadStream(`public/Generated/${filename}`)
                    filestream.pipe(res)

                    fs.unlink(`public/Generated/${filename}`, (error) => {
                        if (error) {
                            throw error
                        }
                    })

                }else{
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
module.exports = api_Router;