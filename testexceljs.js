const excel_js = require('exceljs')
const fs = require('fs');
const filePath = `public/Repository/QC-Question DB.xlsx`;

const logsheetname = async () => {

    if (fs.existsSync(filePath)) {
        let workbook = new excel_js.Workbook();
       await workbook.xlsx.readFile(filePath);
        workbook.eachSheet(function (wroksheet, sheetID) {
            console.log({ sheetID, wroksheet })
        })
        console.log(workbook.worksheets.length)
        let version = workbook.worksheets.length + 2;
        console.log(version);
        let sheetName = `V${version}_${new Date().toISOString().slice(0, 10)}`;
        console.log(sheetName)
        try {
            let sheet = workbook.addWorksheet(sheetName);
            // sheet.columns = mycolumns;
            // newData.forEach(record => {
            //     sheet.addRow(record)
            // })
        } catch (error) {
            console.log("Check one")
            console.error(error)
        }
        try {
            workbook.xlsx.writeFile(filePath).then(() => {
                console.log("done")
            });
        } catch (error) {
            console.log("Check two")
            console.error(error)
        }
    }

} 
logsheetname();