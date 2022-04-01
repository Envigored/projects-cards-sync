const {inspect} = require("util");
const core = require("@actions/core");
//https://github.com/actions/toolkit
const {Octokit} = require("@octokit/action");
const {findNodeId, filterLabels} = require("./utils")


async function pullRequest() {
  try {
    let message = ''
    let labelsToAddIds = []
    let labelsToRemoveIds = []

    const movedTo = core.getInput('move_to', {required: true})
    const labelsToAdd = JSON.parse(core.getInput('labels_to_add', {required: true}))
    const labelsToRemove = JSON.parse(core.getInput('labels_to_remove', {required: true}))
    const newPullRequest = 'true' === core.getInput('new_item', {required: true})
    const projectStatusName = core.getInput('project_status_column', {required: true})
    const prNodeID = core.getInput('current_id', {required: true})
    const projectID = parseInt(core.getInput('project_id', {required: true}))

    const octokit = new Octokit();

    // graphql call
    const {
      node: {
        id: prId,
        labels: {
          edges: prCurrentLabels
        },
        closingIssuesReferences: {
          edges: issues
        },
        baseRepository: {
          labels: {
            nodes: labels
          }
        }
      }
    } = await octokit.graphql(query, {projectID, prNodeID})

    //
    if (prId !== prNodeID) {
      message = 'the query returned the wrong id'
      core.setFailed(message);
      core.setOutput('Error', message)
      return
    }

    // evitar cambiar cosas si el PR no esta ligado con un issue
    if (newPullRequest && issues.length < 1) {
      message = 'No related issues to this Pull Request'
      core.setFailed(message);
      core.setOutput('Error', message)
      return;
    }

    // Set up the labels ids to save.
    if (labelsToAdd && labelsToAdd.length > 0) {
      labelsToAddIds = labelsToAdd.map((item) => {
        return findNodeId('name', item, labels)
      })
    }

    if (labelsToRemove && labelsToRemove.length > 0) {
      labelsToRemoveIds = labelsToRemove.map((item) => {
        return findNodeId('name', item, labels)
      })
    }
    // Ids for to use send in the update
    const prLabelsId = filterLabels(prCurrentLabels, labelsToRemoveIds, labelsToAddIds)

    // Send the PR mutation.
    octokit.graphql(prMutation, {prLabelsId, prNodeID})
      .then(() => core.setOutput("Updated PR", 'Success'))
      .catch((error) => core.debug(inspect(error)))

    // Walk our issues
    issues.map((item) => {
      const {
        id: issueID,
        title,
        labels: {
          nodes: labels
        },
        projectNext: {
          id: projectId,
          fields: {
            edges: projectFieldValues
          },
        },
        projectNextItems: {
          edges: projectCards
        }
      } = item.node

      const issueLabelsIds = filterLabels(labels, labelsToRemoveIds, labelsToAddIds)
      let hasCard = false

      if (projectCards && projectCards.length > 0) {
        hasCard = true
        const projectCardId = projectCards[0].node.id

        const {
          node: {
            id: projectStatusColumnId,
            settings
          }
        } = projectFieldValues.find(
          (item) => item && item.node.name.toLowerCase() === projectStatusName.toLowerCase()
        )

        const projectSettings = JSON.parse(settings)
        const {id: projectStatusId} = projectSettings.options.find(
          (item) => item.name.toLowerCase() === movedTo.toLowerCase()
        )

        const data = {
          issueID,
          issueLabelsIds,
          projectId,
          projectCardId,
          projectStatusColumnId,
          projectStatusId
        }

        octokit.graphql(issueMutationWithCard, data)
          .then(() => core.setOutput("Updated Issue", `Update ${title}`))
          .catch((error) => core.debug(inspect(error)))
      }

      if (!hasCard) {
        octokit.graphql(issueMutation, {issueID, issueLabelsIds})
          .then(() => core.setOutput("Updated Issue", `Update ${title}`))
          .catch((error) => core.debug(inspect(error)))
      }
    })
  } catch (error) {
    core.debug(inspect(error));
    core.setFailed(error.message);
  }
}

const prMutation = `mutation update($prLabelsId: [ID!], $prNodeID: ID!) {
  updatePullRequest(input: {pullRequestId: $prNodeID, labelIds: $prLabelsId}) {
    clientMutationId
  }
}`

const issueMutationWithCard = `mutation update($issueID: ID!, $issueLabelsIds: [ID!], $projectCardId: ID!, $projectId: ID!, $projectStatusId: String!, $projectStatusColumnId: ID!) {
  updateProjectNextItemField(
    input: {itemId: $projectCardId, value: $projectStatusId, projectId: $projectId, fieldId: $projectStatusColumnId}
  ) {
    clientMutationId
  }
  updateIssue(input: {id: $issueID, labelIds: $issueLabelsIds}) {
    clientMutationId
  }
}`

const issueMutation = `mutation update($issueID: ID, $issueLabelsIds: [ID!]) {
  updateIssue(input: {id: $issueID, labelIds: $issueLabelsIds}) {
    clientMutationId
  }
}`

const labelsFragment = `
labels(first: 10) {
  nodes {
    name
    id
  }
}`

const query = `query getPRInfo($prNodeID: ID!, $projectID: Int!) {
  node(id: $prNodeID) {
    ... on PullRequest {
      id
      labels(first: 10) {
        edges {
          node {
            id
          }
        }
      }
      closingIssuesReferences(first: 10) {
        edges {
          node {
            id
            title
            labels(first: 10) {
              nodes {
                name
                id
                repository {
                  id
                }
              }
            }
            projectNext(number: $projectID) {
              id
              fields(first: 10) {
                edges {
                  node {
                    name
                    id
                    settings
                  }
                }
              }
            }
            projectNextItems(first: 10) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
      baseRepository {
        ${labelsFragment}
      }
    }
  }
}`

module.exports = pullRequest;