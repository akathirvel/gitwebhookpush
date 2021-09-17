/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
const {PubSub} = require('@google-cloud/pubsub');


const pubsub = new PubSub();

const replaceAll = (string, search, replace) => {
  return string.split(search).join(replace);
}

exports.handler = async (req, res) => {

  if (!process.env.PUB_SUB_TOPIC) {
    const err = "The env var PUB_SUB_TOPIC is not set"
    console.error(err);
    res.status(500).send(err);
    return Promise.reject(err);
  }

  const payload = req.body;

  const topic = pubsub.topic(process.env.PUB_SUB_TOPIC)
  const commits = payload.push.changes[0].commits
  const lastCommitHash = (commits && commits.length) ? commits[0].hash.substring(0,7) : undefined

  const branch = payload.push.changes[0].new.name

  const branch_short = branch.split('/')[branch.split('/').length - 1].substring(0,10)

  const messageObject = {
    repo: payload.repository.name,
    branch,
    branch_short,
    ssh_clone_url: 'git@github.com:' + payload.repository.full_name,
    tag1: payload.repository.name,
    tag2: replaceAll(branch,'/','-'),
    tag3: lastCommitHash
  };

  let activeBranches = process.env.ACTIVE_BRANCHES
  if (activeBranches && typeof activeBranches === "string" && activeBranches.length > 0) {
    activeBranches = activeBranches.split('___')
    console.log('ACTIVE_BRANCHES list: ', activeBranches)
    if (!activeBranches.includes(branch)) {
      const err = `${branch} it is not present in the ACTIVE_BRANCHES env var (${activeBranches}), skip`
      console.error(err);
      res.status(400).send(err);
      return Promise.reject(err);
    } else {
      console.log(`branch ${branch} is present in ${activeBranches}`)
    }
  }

  console.info(`Triggering build for ${JSON.stringify(messageObject)}, using topic: ${process.env.PUB_SUB_TOPIC}`)
  const messageBuffer = Buffer.from(JSON.stringify(messageObject), 'utf8');
  try {
    await topic.publish(messageBuffer);
    console.info('Topic published successfully')
    res.status(200).send('Message published.' + JSON.stringify(payload));
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
    return Promise.reject(err);
  }
};
