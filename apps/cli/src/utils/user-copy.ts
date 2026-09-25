export const PROJECT_REQUIRED_MESSAGE = 'Not in a Paradoc project. Expected paradoc.json with a .paradoc directory.'

export function formatLayerCount(count: number): string {
  return `${count} ${count === 1 ? 'layer' : 'layers'}`
}
