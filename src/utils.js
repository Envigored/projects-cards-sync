const findNodeId = (property, query, array) => {
  for (let i = 0; i < array.length; i++) {
    if (array[i][property] === query) {
      return array[i].id
    }
  }
}

const filterLabels = (currentLabels, toRemove, toAdd) => {
  let finalLabelsIds = []
  if (currentLabels && currentLabels.length > 0) {
    for (let i = 0; i < currentLabels.length; i++) {
      if (currentLabels[i]) {
        finalLabelsIds.push(
          currentLabels[i].hasOwnProperty('node') ? currentLabels[i].node.id : currentLabels[i].id
        )
      }
    }

    finalLabelsIds = finalLabelsIds.filter((id) => !toRemove.includes(id))
  }

  // Ids for to use send in the update
  return [...finalLabelsIds, ...toAdd]
}

module.exports = {
  findNodeId, filterLabels
}