// Portions Copyright (c) 2014-2021 Rancher Labs, Inc. https://github.com/rancher/dashboard
import type { StateTree } from "pinia";
import urlOptions from "@/composables/steve/urloptions";
import { SIMPLE_TYPES, typeRef } from "@/models/schema";
import type { ISteveServerState, IWatch, IUrlOpt, IType } from "./server";
import type { IMetadata, IResource } from "@/composables/steve/types";
import {
  keyForSubscribe,
  normalizeType,
  watchesAreEquivalent,
} from "./normalize";
import { SCHEMA } from "@/config/schemas";

export function SteveServerGetters(): StateTree {
  return {
    /**
     * Server getters
     */

    // find type by name
    typeFor: (state: ISteveServerState) => (type: string): IType | undefined => {
      type = normalizeType(type);
      return state.types[type];
    },

    // check if type is registerd
    typeRegistered: (state: ISteveServerState) => (type: string) => {
      type = normalizeType(type);

      return !!state.types[type];
    },

    // find schema by type name
    schemaFor: (state: ISteveServerState) => (type: string): DecoratedSchema | undefined => {
      type = normalizeType(type);
      return state.schemas[type]
    },

    // check if a watch is in error
    canWatch: (state: ISteveServerState) => (obj: IWatch): boolean => {
      return !state.inError[keyForSubscribe(obj)];
    },

    // check if a watch is started
    watchStarted: (state: ISteveServerState) => (obj: IWatch): boolean => {
      return !!state.started.find((entry) =>
        watchesAreEquivalent(obj, entry)
      );
    },

    // check if a watch is existing
    existingWatchFor: (state: ISteveServerState) => (obj: IWatch): IWatch | undefined => {
      return state.started.find((entry) => watchesAreEquivalent(obj, entry));
    },

    /**
     * Type getters
     */

    // get type list by type name
    all(state: ISteveServerState): (type: string) => IStored[] {
      return (type: string) => {

        type = normalizeType(type);

        if (!state.types[type].haveAll) {
          console.error(`Asking for all ${type} before they have been loaded`);
        }

        if (!this.typeRegistered(type)) {
          // Yes this is mutating state in a getter... it's not the end of the world..
          // throw new Error(`All of ${ type } is not loaded`);
          console.warn(`All of ${type} is not loaded yet`); // eslint-disable-line no-console
          this.registerType(state, type);
        }
        return state.types[type].list;
      };
    },

    // get type obj by type name and id
    byId: (state: ISteveServerState) => (type: string, id: string) => {
      type = normalizeType(type);
      const entry = state.types[type];

      if (entry) {
        return entry.map.get(id);
      }
    },

    inNamespace: (state: ISteveServerState) => (namespace: string, type: string) => {
      const entry = state.typeFor(type)
      if (entry) {
        return computed(() => {
          return entry.list.filter((obj: IResource) => {
            return obj.metadata.namespace === namespace
          })
        })
      }
      return false
    },

    haveSelectorFor: (state: ISteveServerState) => (type: string, selector: string): boolean => {
      type = normalizeType(type);
      const entry = state.typeFor(type);

      return entry.haveSelector[selector] || false;
    },


    defaultFor: (state: ISteveServerState) => (type: string, depth = 0): JsonDict => {
      type = normalizeType(type);
      const schema = state.schemaFor(type);

      if (!schema) {
        return {};
      }

      const out: JsonDict = {};

      if (depth === 0) {
        out.type = type;
      }

      for (const key in schema.resourceFields) {
        const field = schema.resourceFields[key];

        if (!field) {
          // Not much to do here...
          continue;
        }

        if (depth === 0 && key === "metadata") {
          out[key] = defaultMetadata(schema) as JsonDict;
          continue;
        }

        if (depth === 0 && key === "status") {
          continue;
        }

        const type = field.type;
        const mapOf = typeRef("map", type);
        const arrayOf = typeRef("array", type);
        const referenceTo = typeRef("reference", type);

        if (mapOf || type === "map" || type === "json") {
          out[key] = state.defaultFor(type, depth + 1) || {};
        } else if (arrayOf || type === "array") {
          out[key] = [];
        } else if (referenceTo) {
          out[key] = undefined;
        } else if (SIMPLE_TYPES.includes(type)) {
          if (typeof field.default === "undefined") {
            out[key] = undefined;
          } else {
            out[key] = field.default;
          }
        } else {
          out[key] = state.defaultFor(type, depth + 1);
        }
      }

      return out;
    },

    canList: (state: ISteveServerState) => (type: string): Boolean => {
      type = normalizeType(type);
      const schema = state.schemaFor(type);

      return schema && schema.hasLink('collection');
    },

    urlFor(state: ISteveServerState) {
      return (type: string, id?: string, opt: IUrlOpt = {}): string => {
        opt = opt || {};
        type = normalizeType(type);
        let url = opt.url;

        if (!url) {
          if (type === SCHEMA) {
            url = SCHEMA;
          } else {
            const schema = this.schemaFor(type);

            if (!schema) {
              throw new Error(`Unknown schema for type: ${type}`);
            }

            url = schema.links?.collection;

            if (!url) {
              throw new Error(
                `You don't have permission to list this type: ${type}`
              );
            }
            if (id) {
              url += `/${id}`;
            }
          }
        }

        if (!url.startsWith("/") && !url.startsWith("http")) {
          const baseUrl = state.config.baseUrl.replace(/\/$/, "");

          url = `${baseUrl}/${url}`;
        }

        url = urlOptions(url, opt);

        return url;
      };
    },


    typeEntry: (state: ISteveServerState) => (type: string) => {
      type = normalizeType(type);

      return state.types[type];
    },

    haveAll: (state: ISteveServerState) => (type: string) => {
      type = normalizeType(type);
      const entry = state.types[type];

      if (entry) {
        return entry.haveAll || false;
      }

      return false;
    },

    haveSelector: (state: ISteveServerState) => (type: string, selector: string) => {
      type = normalizeType(type);
      const entry = state.types[type];

      if (entry) {
        return entry.haveSelector[selector] || false;
      }

      return false;
    },

    nextResourceVersion: (state: ISteveServerState) => (type: string, id: string): number | null => {
      type = normalizeType(type);
      let revision = 0;

      if (id) {
        const existing = state.byId(type, id);

        if (existing) {
          revision = Number.parseInt(existing.metadata?.resourceVersion || "", 10);
        } else {
          console.warn("nextResourceVersion() called for non-existent resource", type, id);
        }
      }

      if (!revision) {
        const cache = state.types[type];

        if (!cache) {
          return null;
        }

        revision = cache.revision;

        // TODO: type define
        for (const obj of cache.list) {
          if (obj && obj.metadata) {
            const neu = Number.parseInt(obj.metadata.resourceVersion || "", 10);
            revision = Math.max(revision, neu);
          }
        }
      }

      if (revision > 0) {
        return revision;
      }

      return null;
    },

    currentGeneration: (state: ISteveServerState) => (type: string): number | null => {
      type = normalizeType(type);

      const cache = state.types[type];

      if (!cache) {
        return null;
      }

      return cache.generation;
    },
  };
}

function defaultMetadata(schema: DecoratedSchema) {
  const ctx = useContext();

  const out: IMetadata = {
    annotations: {},
    labels: {},
    name: "",
  };

  if (schema.attributes?.namespaced) {
    out.namespace = ctx.namespace;
  }

  return out;
}