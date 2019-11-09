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
  origin              : 'https://palikeys2.firebaseapp.com',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

db.settings({timestampsInSnapshots: true});

main.use('/api', app);
main.use(bodyParser.json());

main.use(cors(corsOptions));
app.use(cors(corsOptions));

main.set('x-powered-by', false);
app.set('x-powered-by', false);

export const webApi = functions.https.onRequest(main);

// TODO: generic error handler that returns json 500er
// TODO: remove firebase-functions-helper package
// TODO: validate input with AJV

app.get('/score', (req, res) => {
  // TODO: let the db sort by score
  function sortByScore(a: { score: number }, b: { score: number }): number {
    return b.score - a.score;
  }

  function toArray(scores: any): any[] {
    return Object.keys(scores).map(key => scores[key]).sort(sortByScore);
  }

  firebaseHelper.firestore
    .backup(db, scoreCollection)
    .then(data => res.status(200).send(toArray(data.highscore)))
});

app.get('/score/username/:username', async (req, res) => {
  const snapshot = await getByUsername(req.params.username).get();
  if (snapshot.empty) {
    res.status(404);
    res.json({error: `username '${req.params.username}' not found`});
    return;
  }
  res.json(snapshot.docs[0].data());
});

app.get('/score/:id', async (req, res) => {
  const doc = await getByIdNonEmpty(req.params.id, res);
  if (!doc) {
    return;
  }
  res.json(doc.data());
});

// TODO: we need to ensure on a db level that id and username are unique
app.post('/score', async (req, res) => {
  const obj = req.body;
  if (!validateScore(obj, res)) {
    return;
  }
  if (userExists(obj.username)) {
    res.status(409);
    res.json({error: `user with name '${obj.username}' already exists`})
  }
  obj.id = uuid();
  await firebaseHelper.firestore
    .createNewDocument(db, scoreCollection, obj);
  res.setHeader('Location', `/api/score/${obj.id}`);
  res.status(204);
});

app.put('/score/:id/increment', async (req, res) => {
  const obj = req.body;
  if (!validateScoreIncrement(obj, res)) {
    return;
  }
  const doc = await getByIdNonEmpty(req.params.id, res);
  if (!doc) {
    return;
  }
  const score = doc.data();
  score.score += obj.score;
  // TODO: update guard against race & retry read, update until update guard matches?
  await firebaseHelper.firestore
    .updateDocument(db, scoreCollection, doc.id, score);
  res.sendStatus(204);
});

app.delete('/score/:id', async (req, res) => {
  const doc = await getByIdNonEmpty(req.params.id, res);
  if (!doc) {
    return;
  }
  await firebaseHelper.firestore
    .deleteDocument(db, scoreCollection, doc.id);
  res.sendStatus(204);
});

app.get('*', (req, res) => {
  res.status(404);
  res.json({error: 'path not found'})
});

app.use((req, res) => {
  res.status(404);
  res.json({error: 'path not found'})
});

function validateScore(obj, res): boolean {
  // noinspection SuspiciousTypeOfGuard
  if (!arrayEqual(Object.keys(obj), ['username', 'score']) || typeof obj.score !== 'number' || typeof obj.username !== 'string') {
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
  // noinspection SuspiciousTypeOfGuard
  if (!arrayEqual(Object.keys(obj), ['score']) || typeof obj.score !== 'number' || obj.score < 0) {
    res.status(400);
    res.json({
      error   : 'Invalid json object, only attribute score (positive number) is allowed!',
      received: obj
    });
    return false;
  }
  return true;
}

function arrayEqual(a: any[], b: any[]): boolean {
  return a.every(e => b.indexOf(e) > -1);
}

function getByUsername(username: string) {
  return db.collection(scoreCollection).where('username', '==', username).limit(1);
}

function getById(id: string) {
  return db.collection(scoreCollection).where('id', '==', id).limit(1);
}

async function getByIdNonEmpty(id: string, res: express.Response) {
  const snapshot = await getById(id).get();
  if (snapshot.empty) {
    res.status(404);
    res.json({error: `id '${id}' not found`});
    return undefined;
  }
  return snapshot.docs[0];
}

async function userExists(username: string): Promise<boolean> {
  return !(await db.collection(scoreCollection).where('username', '==', username).get()).empty;
}

