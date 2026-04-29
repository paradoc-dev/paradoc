export const isValidRepoSlug = (fullRepoSlug: string) => {
  // Must have the form '@orgName/repoName'
  // orgName: starts with '@', then a-z, A-Z, 0-9, optional hyphens (not consecutive, not leading/trailing)
  // repoName: a-z, A-Z, 0-9, optional hyphens (not consecutive, not leading/trailing)
  const regex = /^@([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)\/([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)$/
  return regex.test(fullRepoSlug)
}

export const parseRepoSlug = (fullRepoSlug: string): { orgName: string; repoName: string } => {
  // Must have the form '@orgName/repoName'
  const isValid = isValidRepoSlug(fullRepoSlug)
  if (!isValid) {
    throw new Error('Invalid repository slug')
  }
  const match = fullRepoSlug.match(
    /^@([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)\/([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)$/
  )
  if (!match) {
    throw new Error('Invalid repository slug')
  }
  const orgName = match[1] // org name without leading '@'
  const repoName = match[2]
  if (!orgName || !repoName) {
    throw new Error('Invalid repository slug')
  }
  return { orgName, repoName }
}

/**
 * Validate that a URL matches the remote repository URL format
 * Format: http://{domain}/orgname/reponame or https://{domain}/orgname/reponame
 */
export const isValidRemoteUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    // Must be http or https
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return false
    }

    // Path should be /orgname/reponame (exactly 2 segments, both non-empty)
    const pathSegments = urlObj.pathname.split('/').filter((segment) => segment.length > 0)
    if (pathSegments.length !== 2) {
      return false
    }

    // Each segment should match slug format: a-z, A-Z, 0-9, optional hyphens
    const slugPattern = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/
    const orgSegment = pathSegments[0]
    const repoSegment = pathSegments[1]
    if (!orgSegment || !repoSegment) {
      return false
    }
    return slugPattern.test(orgSegment) && slugPattern.test(repoSegment)
  } catch {
    return false
  }
}

/**
 * Parse a remote repository URL to extract org and repo slugs
 * Format: http://{domain}/orgname/reponame or https://{domain}/orgname/reponame
 * @returns Object with orgName and repoName
 */
export const parseRemoteUrl = (url: string): { orgName: string; repoName: string } => {
  if (!isValidRemoteUrl(url)) {
    throw new Error(
      'Invalid remote repository URL format. Expected: http://{domain}/orgname/reponame'
    )
  }

  const urlObj = new URL(url)
  const pathSegments = urlObj.pathname.split('/').filter((segment) => segment.length > 0)

  const orgName = pathSegments[0]
  const repoName = pathSegments[1]

  if (!orgName || !repoName) {
    throw new Error(
      'Invalid remote repository URL format. Expected: http://{domain}/orgname/reponame'
    )
  }

  return {
    orgName,
    repoName,
  }
}
