import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as firebaseHelper from 'firebase-functions-helper';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as uuid from 'uuid/v4';
import * as cors from 'cors';

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const app = express();
const main = express();
const scoreCollection = 'highscore';

const corsOptions = {
  origin              : 'https://palikeys.firebaseapp.com',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

main.use('/api', app);
main.use(bodyParser.json());

main.use(cors(corsOptions));
app.use(cors(corsOptions));

main.set('x-powered-by', false);
app.set('x-powered-by', false);

export const webApi = functions.https.onRequest(main);

// FIXME: don't use internal db ids, but uuid v4!
// TODO: validate input with AJV
// TODO: ensure no duplicate username!
// TODO: remove firebase-functions-helper package


app.get('/score', (req, res) => {
  function toArray(scores: any) {
    return Object.keys(scores).map(key => scores[key]);
  }

  firebaseHelper.firestore
    .backup(db, scoreCollection)
    .then(data => res.status(200).send(toArray(data.highscore)))
});

app.get('/score/:id', (req, res) => {
  firebaseHelper.firestore
    .getDocument(db, scoreCollection, req.params.id)
    .then(doc => res.status(200).send(doc));
});

app.post('/score', (req, res) => {
  const obj = req.body;
  if (!validateScore(obj, res)) {
    return;
  }
  obj.id = uuid();
  firebaseHelper.firestore
    .createNewDocument(db, scoreCollection, obj);
  res.setHeader('Location', `/api/score/${obj.id}`);
  res.status(204);
});

app.put('/score/:id/increment', async (req, res) => {
  const obj = req.body;
  if (!validateScoreIncrement(obj, res)) {
    return;
  }
  const doc = await firebaseHelper.firestore
    .getDocument(db, scoreCollection, req.params.id);
  doc.score += obj.score;
  firebaseHelper.firestore
    .updateDocument(db, scoreCollection, req.params.id, doc);
  res.sendStatus(204);
});

app.delete('/score/:id', (req, res) => {
  firebaseHelper.firestore
    .deleteDocument(db, scoreCollection, req.params.id);
  res.sendStatus(200);
});

app.get('*', (req, res) => {
  res.status(404);
  res.json({error: 'not found'})
});

app.use((req, res) => {
  res.status(404);
  res.json({error: 'not found'})
});

function validateScore(obj, res): boolean {
  if (Object.keys(obj) !== ['username', 'score'] || typeof obj.score !== 'number' || typeof obj.username !== 'string') {
    res.status(400);
    res.json({
      error   : 'Invalid json object, only attributes score (number) and username (string) are allowed!',
      received: obj
    });
    return false;
  }
  return true;
}

function validateScoreIncrement(obj, res) {
  if (Object.keys(obj) !== ['score'] || typeof obj.score !== 'number' || obj.score < 0) {
    res.status(400);
    res.json({
      error   : 'Invalid json object, only attribute score (positive number) is allowed!',
      received: obj
    });
    return false;
  }
  return true;
}
