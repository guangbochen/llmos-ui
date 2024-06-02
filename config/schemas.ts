// Portion adapted from: https://github.com/rancher/dashboard
import { fromArray } from '@/utils/array'

// Steve types
// base: /v1
export const STEVE = { PREFERENCE: 'userpreference' };

// Common native k8s types (via Steve)
// Base: /k8s/clusters/<id>/v1/
export const API_GROUP = 'apiGroups';
export const API_SERVICE = 'apiregistration.k8s.io.apiservice';
export const CONFIG_MAP = 'configmap';
export const COUNT = 'count';
export const EVENT = 'event';
export const ENDPOINTS = 'endpoints';
export const HPA = 'autoscaling.horizontalpodautoscaler';
export const INGRESS = 'networking.k8s.io.ingress';
export const NAMESPACE = 'namespace';
export const NODE = 'node';
export const NETWORK_ATTACHMENT = 'k8s.cni.cncf.io.networkattachmentdefinition';
export const NETWORK_POLICY = 'networking.k8s.io.networkpolicy';
export const POD = 'pod';
export const PV = 'persistentvolume';
export const PVC = 'persistentvolumeclaim';
export const RESOURCE_QUOTA = 'resourcequota';
export const SCHEMA = 'schema';
export const SERVICE = 'service';
export const SECRET = 'secret';
export const SERVICE_ACCOUNT = 'serviceaccount';
export const STORAGE_CLASS = 'storage.k8s.io.storageclass';
export const OBJECT_META = 'io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta';

export const RBAC = {
  ROLE: 'rbac.authorization.k8s.io.role',
  CLUSTER_ROLE: 'rbac.authorization.k8s.io.clusterrole',
  ROLE_BINDING: 'rbac.authorization.k8s.io.rolebinding',
  CLUSTER_ROLE_BINDING: 'rbac.authorization.k8s.io.clusterrolebinding',
};

export const WORKLOAD = 'workload';

// The types that are aggregated into a "workload"
export const WORKLOAD_TYPES = {
  DEPLOYMENT: 'apps.deployment',
  CRON_JOB: 'batch.cronjob',
  DAEMON_SET: 'apps.daemonset',
  JOB: 'batch.job',
  STATEFUL_SET: 'apps.statefulset',
  REPLICA_SET: 'apps.replicaset',
  REPLICATION_CONTROLLER: 'replicationcontroller'
};

const {
  DAEMON_SET, CRON_JOB, JOB, ...scalableWorkloads
} = WORKLOAD_TYPES;

export const SCALABLE_WORKLOAD_TYPES = scalableWorkloads;

export const METRIC = {
  NODE: 'metrics.k8s.io.nodemetrics',
  POD: 'metrics.k8s.io.podmetrics',
};

// --------------------------------------
// 2. Only if LLMOS-Controller is installed
// --------------------------------------

// Management API (via steve)
// Base: /v1
export const LLMOS = {
  MANAGEMENT: {
    UPGRADE: 'management.llmos.ai.upgrade',
    SETTING: 'management.llmos.ai.setting',
    USER: 'management.llmos.ai.user',
    CLUSTER: 'management.cattle.io.cluster',
  },
  ML: {
    MODELFILE: 'ml.llmos.ai.modelfile',
  }
};

interface TypeConfig {
  plural: string
  singular: string
  eventKind?: string
  watchable?: boolean
  creatable?: boolean
  preloadable?: boolean
  editable?: boolean
  details?: boolean
  detailRoute?: string | ((resource: DecoratedResource) => string)
  pollTransitioning?: boolean
  defaultSort?: string | string[] // Safe to use only on fields that change only when load()-ing new data (subscribe).
  loadAfterSave?: boolean
}

/**
 * Configuration object that maps keys to `TypeConfig` objects.
 */
const config: Record<string, TypeConfig> = {}

const reverse: Record<string, string> = {}

for (const k of Object.keys(config)) {
  reverse[config[k].plural] = k
  reverse[config[k].singular] = k
}

export function toNice(apiType: string, singular = false): string {
  let out: string

  if (singular) {
    out = config[apiType]?.singular
  } else {
    out = config[apiType]?.plural
  }

  if (out) {
    return out
  }

  throw new Error(`Unmapped type: ${apiType}`)
}

export function fromNice(nice: string | string[]): string {
  nice = fromArray(nice)
  const out = reverse[nice]

  if (out) {
    return out
  }

  throw new Error(`Unmapped reverse type: ${nice}`)
}

export function pollTransitioning(type: string) {
  return config[type]?.pollTransitioning === true
}

export function watchable(type: string) {
  return config[type]?.watchable !== false
}

export function creatable(type: string) {
  return config[type]?.creatable !== false
}

export function details(type: string) {
  return config[type]?.details !== false
}

export function editable(type: string) {
  return config[type]?.editable !== false
}

export function preloadable(type: string) {
  return config[type]?.preloadable !== false
}

export function detailRoute(type: string, resource: DecoratedResource) {
  const override = config[type]?.detailRoute

  if (typeof override === 'function') {
    return override(resource)
  } else if (override) {
    return override
  } else {
    throw new Error('No detail route')
  }
}

export function defaultSort(type: string) {
  if (typeof config[type]?.defaultSort === 'undefined') {
    return 'nameSort'
  }

  return config[type]?.defaultSort
}

export function loadAfterSave(type: string) {
  return config[type]?.loadAfterSave !== false
}
