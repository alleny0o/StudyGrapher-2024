const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const dotenv = require('dotenv').config();
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const AWS = require('aws-sdk');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const PDFExtract = require('pdf.js-extract').PDFExtract;
const Anthropic = require('@anthropic-ai/sdk');

const pdfExtract = new PDFExtract();
const options = {};
const apiKey = process.env.API_KEY;
const anthropic = new Anthropic({ apiKey });

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const cognito = new AWS.CognitoIdentityServiceProvider();
const params = {
  UserPoolId: process.env.POOL_ID,
};

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
const upload = multer({ dest: 'uploads/' });

async function notifyAdmin(email, text) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.E_PASS,
    }
  });

  const info = await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: 'Weekly Study Tips',
    text: text,
  });

  console.log("Message sent: %s", info.messageId);
}

function sendEmails() {
  cognito.listUsers(params, (err, data) => {
    if (err) {
      console.error('Error listing users:', err);
    } else {
      console.log(data.Users);
      const confirmedEmails = data.Users
        .filter(user => user.UserStatus === 'CONFIRMED')
        .map(user => {
          const emailAttribute = user.Attributes.find(attr => attr.Name === 'email');
          console.log(emailAttribute);
          return emailAttribute ? emailAttribute.Value : null;
        })
        .filter(email => email !== null);

      confirmedEmails.forEach(email => {
        // TODO: Once the site is deployed... change the local host to the site name.
        const unsubscribeLink = `http://localhost:3000/unsubscribe/${email}`;
        const emailText = `The one and only study tip is to turn stop getting distracted by SOCIAL MEDIA! :)\n\nTo unsubscribe, click here: ${unsubscribeLink}`;
        notifyAdmin(email, emailText);
      });
    }
  });
}

app.use('/healthcheck', (req, res) => {
  res.status(200).send("ok");
});

app.get('/unsubscribe/:email', (req, res) => {
  const email = req.params.email;
  const params = {
    UserPoolId: process.env.POOL_ID,
    Username: email,
  };

  cognito.adminDeleteUser(params, (err, data) => {
    if (err) {
      console.error('Error unsubscribing user:', err);
      res.status(500).send('An error occurred while unsubscribing.');
    } else {
      res.send('You have been unsubscribed from our mailing list.');
    }
  });
});

cron.schedule('0 9 * * 1', sendEmails);

app.get('/', (req, res) => {
  res.render('index.ejs');
});

app.get('/graph', (req, res) => {
  res.render('graph.ejs');
});

app.post('/submit', upload.single('pdf'), (req, res) => {
  const pdfFile = req.file;
  const studyTime = req.body['study-time'];
  let pdf = "";

  pdfExtract.extract(pdfFile.path, options, (err, data) => {
    if (err) return console.log(err);

    for (let i = 0; i < data.pages.length; i++) {
      for (let j = 0; j < data.pages[i].content.length; j++) {
        pdf += data.pages[i].content[j].str;
      }
    }

    anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [
        {
          "role": "user",
          "content": "I have " + studyTime + " minutes to study for an upcoming exam. The exam covers many topics, which are detailed in the attached PDF:\n\n" + pdf + "\n\nPlease generate a comma-separated values (CSV) string that includes each general topic (more than 4 and less than 10 total topics), the percentage it represents on the exam, the recommended study time in minutes for each topic, and a short description of the topic. Allocate the study time proportionally based on the topic's occurrence on the exam. Ensure that the total study time adds up to " + studyTime + " minutes.\n\nUse the following CSV format:\nTopic,Exam Percentage,Study Time (minutes),Description\n\nFor example:\nLinked Lists,40%,80,A data structure consisting of a sequence of nodes, each storing a reference to the next node\nBinary Trees,55%,110,A tree data structure in which each node has at most two children\nGraphs,5%,10,A non-linear data structure consisting of vertices and edges\n\nPlease provide only the CSV string in your response along with the column headers, without any additional explanations or formatting."
        }
      ]
    }).then(response => {
      console.log(response);
      const csvData = response.content[0].text.split('\n').slice(0).join('\n');
      fs.writeFile('public/exam_topics.csv', csvData, (err) => {
        if (err) {
          console.error('Error writing file:', err);
          res.status(500).send('Error generating graph');
        } else {
          console.log('File created: exam_topics.csv');
          res.redirect('/graph');
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