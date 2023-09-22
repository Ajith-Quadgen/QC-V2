// const nodemailer=require('nodemailer')
// const myEmail="ajith.venkatesh@quadgenwireless.com";
// function sendMail({to,subject,html,from}){
// const transporter=nodemailer.createTransport({
//     host:'smtp.ethereal.email',
//     port:587,
//     auth:{
//         user:myEmail,
//         pass:"fnucwdtycntobyon)"
//     }
// })
//  transporter.sendMail(({from,to,subject,html}));
//  console.log("email sent");
// }

// sendMail({to:"ajithvenkatesh129@gmail.com",from:myEmail,subject:"Reset OTP Mail",html:"<h1>IM testing</h1>"})


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

const mailOptions = {
  from: 'ajith.venkatesh@quadgenwireless.com',
  to: 'ajithvenkatesh129@gmail.com',
  subject: 'Subject of the email',
  text: 'This is the body of the email.',
  noReply:true
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Error sending email:', error);
  } else {
    console.log('Email sent:', info.response);
  }
});
