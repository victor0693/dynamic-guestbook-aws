const express = require('express');
const path = require('path');
require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const app = express();
const PORT = process.env.PORT || 3000;
const TABLE_NAME = process.env.TABLE_NAME || 'GuestbookEntries';
const REGION = process.env.AWS_REGION || 'us-east-1';

// DynamoDB client — credentials come from the environment (locally: your AWS CLI
// profile; on Elastic Beanstalk: the instance's IAM role, set up in a later step)
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Home page — THIS is the "dynamic" part: every request reads fresh data
// from the database and renders the page differently based on what's there.
app.get('/', async (req, res) => {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const entries = (data.Items || []).sort((a, b) => b.timestamp - a.timestamp);
    res.render('index', { entries, error: null });
  } catch (err) {
    console.error('Error reading from DynamoDB:', err);
    res.render('index', { entries: [], error: 'Could not load guestbook entries right now.' });
  }
});

// Handle a new guestbook submission
app.post('/sign', async (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) {
    return res.redirect('/');
  }

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.slice(0, 60),
    message: message.slice(0, 300),
    timestamp: Date.now()
  };

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: entry }));
  } catch (err) {
    console.error('Error writing to DynamoDB:', err);
  }

  res.redirect('/');
});

// Simple health check endpoint — Elastic Beanstalk / its load balancer
// pings this to confirm the app is alive and healthy.
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, () => {
  console.log(`Guestbook app listening on port ${PORT}`);
});
