import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as firebaseHelper from 'firebase-functions-helper';
import * as express from 'express';
import * as bodyParser from 'body-parser';

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const app = express();
const main = express();
const scoreCollection = 'highscore';

main.use('/api', app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({extended: false}));

// webApi is our firebase functions name
export const webApi = functions.https.onRequest(main);

app.post('/score', (req, res) => {
  firebaseHelper.firestore
    .createNewDocument(db, scoreCollection, req.body);
  res.send('Create a new high score');
});

app.put('/score/:id', (req, res) => {
  firebaseHelper.firestore
    .updateDocument(db, scoreCollection, req.params.id, req.body);
  res.send('Update a high score');
});

app.get('/score/:id', (req, res) => {
  firebaseHelper.firestore
    .getDocument(db, scoreCollection, req.params.id)
    .then(doc => res.status(200).send(doc));
});

app.get('/score', (req, res) => {
  firebaseHelper.firestore
    .backup(db, scoreCollection)
    .then(data => res.status(200).send(data))
});

app.delete('/score/:id', (req, res) => {
  firebaseHelper.firestore
    .deleteDocument(db, scoreCollection, req.params.id);
  res.send('Document deleted');
});

app.get('*', (req, res) => {
  res.status(404);
  res.json({error: 'not found'})
});

app.use((req, res) => {
  res.status(404);
  res.json({error: 'not found'})
});
