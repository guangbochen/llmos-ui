import https from "node:https";
import type { StateTree } from "pinia";
import type { IResource } from "@/composables/steve/types";
import type { JsonDict, JsonValue } from "@/utils/object";
import type { ISteveType } from "@/composables/steve/type";

export interface IType {
    list: [];
    haveAll: boolean;
    haveSelector: Record<string, boolean>;
    revision: 0; // The highest known resourceVersion from the server for this type
    generation: 0;
    map: Map<string, any>;
}

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

export const NO_WATCH = "NO_WATCH";
export const NO_SCHEMA = "NO_SCHEMA";


/**
 * Represents the state of the ISteveType.
 * @template D - The type of data stored in the IStored array.
 */
export interface ISteveServerState<D> extends StateTree {
  config: {
    baseUrl: string;
  };
  name: string;
  schemas: Record<string, DecoratedSchema>;
  types: Record<string, IType>;
  // socket?: Socket | null;
  queue: IQueueAction[];
  wantSocket: boolean;
  debugSocket: boolean;
  allowStreaming: boolean;
  pendingFrames: JsonDict[];
  started: IWatch[];
  inError: Record<string, string>;
}

export function SteveServerState<D>(config: ISteveServerState<D>["config"]) {
  return (): ISteveServerState<D> => {
    return {
      config,
      name: "",
      schemas: reactive<Record<string, DecoratedSchema>>({}),
      types: {},
      // socket: null,
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
