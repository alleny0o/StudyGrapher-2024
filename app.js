const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const dotenv = require('dotenv').config();
const fs = require('fs');
const app = express();
const PORT = 3000;

// const AWS = require('aws-sdk');
// const cron = require('node-cron');
// const nodemailer = require('nodemailer');

// // Configure the AWS SDK with your credentials
// // (if not already configured through environment variables or credentials file)
// AWS.config.update({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: 'us-east-1'
// });

// // Create an instance of the Cognito Identity Service Provider
// const cognito = new AWS.CognitoIdentityServiceProvider();

// // Set the parameters for listing users
// const params = {
//   UserPoolId: 'us-east-1_pfdCS6xWM',
// };

// // Create a transporter for sending emails
// const transporter = nodemailer.createTransport({
//   // Configure your email service provider settings
//   // For example, using Gmail SMTP:
//   service: 'gmail',
//   auth: {
//     user: 'studygrapher4@gmail.com',
//     pass: `${process.env.E_PASS}`
//   }
// });

// // Function to send emails to confirmed users
// function sendEmails() {
//   // Call the listUsers method
//   cognito.listUsers(params, (err, data) => {
//     if (err) {
//       console.error('Error listing users:', err);
//     } else {
//       // Extract email addresses of confirmed users
//       const confirmedEmails = data.Users
//         .filter(user => user.UserStatus === 'CONFIRMED')
//         .map(user => {
//           const emailAttribute = user.Attributes.find(attr => attr.Name === 'email');
//           return emailAttribute ? emailAttribute.Value : null;
//         })
//         .filter(email => email !== null);

//       // Send email to each confirmed email address
//       confirmedEmails.forEach(email => {
//         const mailOptions = {
//           from: 'studygrapher4@gmail.com',
//           to: email,
//           subject: 'Weekly Update',
//           text: 'This is your weekly update email.'
//         };

//         transporter.sendMail(mailOptions, (error, info) => {
//           if (error) {
//             console.error('Error sending email:', error);
//           } else {
//             console.log('Email sent:', info.response);
//           }
//         });
//       });
//     }
//   });
// }

// // Schedule the email sending task every Monday at 12pm
// cron.schedule('* * * * *', sendEmails);

// PDF Extraction
const PDFExtract = require('pdf.js-extract').PDFExtract;
const pdfExtract = new PDFExtract();
const options = {}; /* see below */

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
const upload = multer({ dest: 'uploads/' });

// TODO: API Manipulation
const Anthropic = require('@anthropic-ai/sdk');
// TODO: We need to hide the key...
const apiKey = process.env.API_KEY;
const anthropic = new Anthropic({ apiKey });

// Route to render the index page
app.get('/', (req, res) => {
  res.render('index.ejs'); // Render the 'index.ejs' file using the EJS template engine
});

app.get('/graph', (req, res) => {
  res.render('graph.ejs');
});

// Handle form submission
app.post('/submit', upload.single('pdf'), (req, res) => {
  const pdfFile = req.file;
  const studyTime = req.body['study-time'];

  let pdf = "";

  //console.log('Study Time:', studyTime);
  pdfExtract.extract(pdfFile.path, options, (err, data) => {
    if (err) return console.log(err);
    //console.log(data);
    for (let i = 0; i < data.pages.length; i++) {
      for (let j = 0; j < data.pages[i].content.length; j++) {
        pdf += data.pages[i].content[j].str;
      }
    }

    anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Specify the model to use
      max_tokens: 1000, // Maximum number of tokens in the generated response
      messages: [
        { "role": "user", "content": "I have " + studyTime + " minutes to study for an upcoming exam. The exam covers many topics, which are detailed in the attached PDF:\n\n" + pdf + "\n\nPlease generate a comma-separated values (CSV) string that includes each general topic (more than 4 and less than 10 total topics), the percentage it represents on the exam, the recommended study time in minutes for each topic, and a short description of the topic. Allocate the study time proportionally based on the topic's occurrence on the exam. Ensure that the total study time adds up to " + studyTime + " minutes.\n\nUse the following CSV format:\nTopic,Exam Percentage,Study Time (minutes),Description\n\nFor example:\nLinked Lists,40%,80,A data structure consisting of a sequence of nodes, each storing a reference to the next node\nBinary Trees,55%,110,A tree data structure in which each node has at most two children\nGraphs,5%,10,A non-linear data structure consisting of vertices and edges\n\nPlease provide only the CSV string in your response along with the column headers, without any additional explanations or formatting." }
      ]
    }).then(response => {
      console.log(response); // Log the response from Anthropic model
      const csvData = response.content[0].text.split('\n').slice(0).join('\n');
      fs.writeFile('public/exam_topics.csv', csvData, (err) => {
        if (err) {
          console.error('Error writing file:', err);
          res.status(500).send('Error generating graph');
        } else {
          console.log('File created: exam_topics.csv');
          res.redirect('/graph'); // Redirect to the graph route after generating the CSV file
        }
      });
    }).catch(error => {
      console.error(error);
      res.status(500).send('Error generating graph');
    });
  });
});

app.listen(PORT, () => {
  console.log(`running on port ${PORT}`);
});