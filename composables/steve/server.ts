import https from "node:https";
import type { StateTree } from "pinia";
import type { IResource } from "./types";
import type { JsonDict, JsonValue } from "@/utils/object";

export interface IWatch {
  type?: string;
  resourceType?: string;
  namespace?: string;
  id?: string;
  selector?: string;
  revision?: string;
  resourceVersion?: string;
  stop?: boolean;
  force?: boolean;
}

export interface IWatchMsg {
  name?: string;
  namespace?: string;
  id?: string;
  selector?: string;
  resourceType?: string;
  revision?: string;
  error?: boolean;
  reason?: string;
  data?: IResource;
}

export interface IQueueAction {
  action: "load" | "remove" | "forgetType";
  type: string;
  id: string;
  body?: any;
  event?: string;
}

export interface IUrlOpt {
  url?: string;
  filter?: Record<string, string | string[]>;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// opt:
// filter: Filter by fields, e.g. {field: value, anotherField: anotherValue} (default: none)
// limit: Number of records to return per page (default: 1000)
// sortBy: Sort by field
// sortOrder: asc or desc
// url: Use this specific URL instead of looking up the URL for the type/id.  This should only be used for bootstrapping schemas on startup.
export interface IRequestOpt {
  url?: string;
  method?: string;
  httpsAgent?: https.Agent;
  headers?: Record<string, string>;
  body?: JsonValue | string;
  responseType?: "json" | "blob" | "text" | "arrayBuffer";
  redirectUnauthorized?: boolean;

  force?: boolean;
  retry?: number;

  filter?: Record<string, string | string[]>;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";

  depaginate?: boolean;
  load?: "all" | "multi" | "allIfAuthed" | "none" | boolean;
  watch?: boolean;
  watchNamespace?: string;
  forceWatch?: boolean;
}

export interface IType {
  list: IStored[];
  haveAll: boolean;
  haveSelector: Record<string, boolean>;
  haveNamespace: Record<string, boolean>;
  revision: 0; // The highest known resourceVersion from the server for this type
  generation: 0;
  map: Map<string, IStored>;
}

/**
 * Represents the state of the ISteveType.
 * @template D - The type of data stored in the IStored array.
 */
export interface ISteveServerState extends StateTree {
  config: {
    baseUrl: string;
  };
  name: string;
  schemas: Record<string, DecoratedSchema>;
  types: Record<string, IType>;
  queue: IQueueAction[];
  wantSocket: boolean;
  debugSocket: boolean;
  allowStreaming: boolean;
  pendingFrames: JsonDict[];
  started: IWatch[];
  inError: Record<string, string>;
}

export function SteveServerState(config: ISteveServerState["config"]) {
  return (): ISteveServerState => {
    return {
      config,
      name: "",
      schemas: reactive<Record<string, DecoratedSchema>>({}),
      types: {},
      queue: [], // For change event coalescing
      wantSocket: false,
      debugSocket: false,
      allowStreaming: true,
      pendingFrames: [],
      started: [],
      inError: {},
    };
  };
}
