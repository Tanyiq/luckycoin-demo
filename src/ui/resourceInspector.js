import {
  ResourceStatus,
  resourceManifest
} from "../data/resources.js"

async function browserProbe(path) {
  const response = await fetch(path, {
    method: "HEAD",
    cache: "no-store"
  })
  return response.ok
}

export async function inspectBrowserResources({
  resources = resourceManifest,
  probe = browserProbe
} = {}) {
  return Promise.all(
    resources.map(async (resource) => {
      if (!resource.path) {
        return {
          id: resource.id,
          status: ResourceStatus.MISSING_CONFIG
        }
      }
      try {
        return {
          id: resource.id,
          status: (await probe(resource.path))
            ? ResourceStatus.AVAILABLE
            : ResourceStatus.MISSING_FILE
        }
      } catch {
        return {
          id: resource.id,
          status: ResourceStatus.LOAD_ERROR
        }
      }
    })
  )
}

export function summarizeResources(resources) {
  return resources.reduce(
    (summary, resource) => {
      summary.total += 1
      if (resource.status === ResourceStatus.AVAILABLE) {
        summary.available += 1
      } else if (resource.required) {
        summary.missingRequired += 1
      } else {
        summary.missingOptional += 1
      }
      return summary
    },
    {
      total: 0,
      available: 0,
      missingRequired: 0,
      missingOptional: 0
    }
  )
}
