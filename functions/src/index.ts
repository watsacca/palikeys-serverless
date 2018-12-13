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

// TODO: generic error handler that returns json 500er
// FIXME: don't use internal db ids, but uuid v4!
// TODO: ensure no duplicate username!
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
  const score = await getByIdNonEmpty(req.params.id, res);
  if (!score) {
    return;
  }
  res.json(score);
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
  const score = await getByIdNonEmpty(req.params.id, res);
  if (!score) {
    return;
  }
  score.score += obj.score;
  firebaseHelper.firestore
    .updateDocument(db, scoreCollection, req.params.id, score);
  res.sendStatus(204);
});

app.delete('/score/:id', (req, res) => {
  firebaseHelper.firestore
    .deleteDocument(db, scoreCollection, req.params.id);
  res.sendStatus(200);
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
  return db.collection(scoreCollection).where('username', '==', username);
}

function getById(id: string) {
  return db.collection(scoreCollection).where('id', '==', id);
}

async function getByIdNonEmpty(id: string, res: express.Response) {
  const snapshot = await getById(id).get();
  if (snapshot.empty) {
    res.status(404);
    res.json({error: `id '${id}' not found`});
    return undefined;
  }
  return snapshot.docs[0].data();
}

async function userExists(username: string): Promise<boolean> {
  return !(await db.collection(scoreCollection).where('username', '==', username).get()).empty;
}

