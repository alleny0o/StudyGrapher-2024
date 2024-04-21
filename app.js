const express = require('express'); 
const bodyParser = require('body-parser');
const multer = require('multer');
const dotenv = require('dotenv').config();
const app = express();
const PORT = 3000;

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

// Handle form submission
app.post('/submit', upload.single('pdf'), (req, res) => {
  const pdfFile = req.file;
  const studyTime = req.body['study-time'];

  let pdf = ""

  //console.log('Study Time:', studyTime);
  pdfExtract.extract(pdfFile.path, options, (err, data) => {
    if (err) return console.log(err);
    //console.log(data);
    for (let i = 0; i < data.pages.length; i++) {
      for(let j = 0; j < data.pages[i].content.length; j++){
        pdf += data.pages[i].content[j].str;
      }
    }

    anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Specify the model to use
      max_tokens: 1000, // Maximum number of tokens in the generated response
      messages: [
        {"role": "user", "content": "I have " + studyTime + " minutes to  study for the following exam, can you give me comma-separated values for each topic and how long I should study it according to the time I have? PDF: " + pdf} // Message to be processed by the model
      ]
    }).then(response => {
      console.log(response); // Log the response from Anthropic model
    }).catch(error => {
      console.error(error); // Log any errors that occur during processing
    });
    
  });

});

// Middleware to handle 404 errors (page not found)
app.use((req, res) => {
  console.log('404 error!'); // Log a message for 404 errors
});

app.listen(PORT, () => {
  console.log(`running on port ${PORT}`);
})