const express = require('express'); 
const bodyParser = require('body-parser');
const multer = require('multer');
const dotenv = require('dotenv').config();
const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
const upload = multer({ dest: 'uploads/' });

// TODO: API Manipulation
const Anthropic = require('@anthropic-ai/sdk');
// TODO: We need to hide the key...
const apiKey = process.env.API_KEY; 
const anthropic = new Anthropic({ apiKey }); 

anthropic.messages.create({
  model: "claude-3-opus-20240229", // Specify the model to use
  max_tokens: 1024, // Maximum number of tokens in the generated response
  messages: [
    {"role": "user", "content": "Hello, world"} // Message to be processed by the model
  ]
}).then(response => {
  console.log(response); // Log the response from Anthropic model
}).catch(error => {
  console.error(error); // Log any errors that occur during processing
});

// Route to render the index page
app.get('/', (req, res) => {
  res.render('index.ejs'); // Render the 'index.ejs' file using the EJS template engine
});

// Handle form submission
app.post('/submit', upload.single('pdf'), (req, res) => {
  const pdfFile = req.file;
  const studyTime = req.body['study-time'];

  // Process the form data and uploaded file
  console.log('PDF:', pdfFile);
  console.log('Study Time:', studyTime);
});

// Middleware to handle 404 errors (page not found)
app.use((req, res) => {
  console.log('404 error!'); // Log a message for 404 errors
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});