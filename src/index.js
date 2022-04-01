const {inspect} = require("util");
const core = require("@actions/core");

const PullRequest = require("./pullRequest")

main();

async function main() {

  try {
    const time = Date.now();

    const currentType = core.getInput('type', {required: true})
    if (currentType === 'pull_request') {
      await PullRequest()
    }

    core.info(`< 200 ${Date.now() - time}ms`);
  } catch (error) {
    core.debug(inspect(error));
    core.setFailed(error.message);
  }
}
