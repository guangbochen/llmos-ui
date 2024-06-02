import https from 'https';
import type { StateTree } from "pinia";
import type {
  ICollection,
  IResource,
  ISchema,
} from "@/composables/steve/types";
import {
  keyForSubscribe,
  normalizeType,
} from "./normalize";
import type {
  IWatchMsg,
  IRequestOpt,
  IWatch,
  IType,
} from "./server";
import { SCHEMA } from "@/config/schemas";
import decorate from "@/composables/steve/decorate";
import { clear, isArray, removeObject } from "@/utils/array";
import { pollTransitioning, watchable } from "@/config/schemas";
import { actions as WebSocketActions } from "./websocket";

export function SteveServerActions<D extends DecoratedResource>() {
  return {
    /***
     * Server actions
     */
    configure(this: StateTree, baseUrl: string, referenceId = ''): void {
      this.name = this.$id
      this.config.baseUrl = baseUrl
      this.referenceId = referenceId
    },

    registerType(this: StateTree, type: string): D {
      let cache = this.typeFor(type)

      if (!cache) {
        cache = {
          list: [],
          haveAll: false,
          haveSelector: {},
          haveNamesapce: {},
          revision: 0, // The highest known resourceVersion from the server for this type
          generation: 0, // Updated every time something is loaded for this type
          map: new Map(),
        };
        this.types[type] = cache;
      }

      return cache;
    },

    async request(this: StateTree, opt: IRequestOpt): Promise<JsonValue> {
      if (!opt.url) {
        throw new Error("Must specify a URL to request");
      }

      if (!opt.url.startsWith("/") && !opt.url.startsWith("http")) {
        let baseUrl = this.config.baseUrl.replace(/\/$/, "");
        let url = opt.url;

        while (url.startsWith("../")) {
          baseUrl = baseOf(baseUrl, "/");
          url = url.substring(3);
        }

        opt.url = `${baseUrl}/${url}`;
      }

      if (opt.url.startsWith("http://localhost")) {
        opt.url = opt.url.replace(/^http/, "https");
      }

      opt.depaginate = opt.depaginate !== false;
      opt.url = opt.url.replace(/\/*$/g, "");

      if (process.server) {
        opt.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      }

      const method = (opt.method || "get").toLowerCase();
      const headers = opt.headers || {};
      // const key = JSON.stringify(headers) + method + opt.url

      if (!headers.accept) {
        headers.accept = "application/json";
      }

      if (process.client) {
        const csrf = useCookie("CSRF");

        headers["x-api-csrf"] = csrf.value;
      }

      let status: number;
      let responseHeaders: Headers;

      const res = (await $fetch(opt.url, {
        method: method as any,
        retry: false,
        headers,
        baseURL: "/",
        credentials: "include",
        body: <Record<string, any> | string>opt.body,
        responseType: opt.responseType || "json",
        async onResponse({ response }) {
          status = response.status;
          responseHeaders = response.headers;
        },
        async onResponseError({ response }) {
          status = response.status;
          responseHeaders = response.headers;

          if (status === 401 && opt.redirectUnauthorized !== false) {
            // notLoggedIn(useRouter().currentRoute.value)
            throw new Error("401");
          }
        },
      })) as JsonDict;

      const ret = responseObject(res);

      return ret;

      function responseObject(res: JsonDict) {
        let out = res;

        if (status === 204 || out === null) {
          out = {};
        }

        if (typeof out !== "object") {
          out = { data: out };
        }

        Object.defineProperties(out, {
          _status: { value: status },
          _headers: { value: responseHeaders },
          _url: { value: opt.url },
        });

        return out;
      }
    },

    async loadSchemas(this: StateTree, watch = true, copy?: ISchema[]): Promise<ISchema[]> {
      if (copy) {
        console.info('Copying Schemas…')
        for (const k of copy) {
          this.schemas[k.id] = k
        }

        if (watch !== false) {
          this.watch({ type: SCHEMA })
        }
      } else {
        console.info("Loading Schemas…");
        const schemas = (await this.request({ url: this.urlFor(SCHEMA), })) as ICollection<ISchema>;

        for (const data of schemas.data) {
          try {
            const schema = await decorate<ISchema, DecoratedSchema>(data, this)

            this.schemas[normalizeType(data.id)] = schema
          } catch (e) {
            console.error("Failed to load schema", data.id, e)
          }
        }

        await this.loadAll(SCHEMA, schemas.data);

        if (watch !== false) {
          this.watch({
            type: SCHEMA,
            revision: schemas.revision,
          });
        }
        console.info(`Loaded ${schemas.data.length} Schemas`);
      }

      return this.schemas;
    },

    async findMatching(this: StateTree, selector: string, opt: IRequestOpt = {}): Promise<D[]> {
      opt = opt || {};

      if (opt.force !== true && this.haveSelectorFor(selector)) {
        return this.matching(selector);
      }

      console.info(`Find Matching: [${this.name}] ${this.type}`, selector);

      opt.filter = opt.filter || {};
      opt.filter.labelSelector = selector;

      opt.url = this.urlFor(this.type, undefined, opt);

      const res = (await this.request(opt)) as unknown as ICollection<T>;

      if (opt.load === false) {
        // @TODO support again
        // return res.data.map(d => this.classify(d))
      }

      await this.loadSelector(res.data, selector);

      if (opt.watch !== false && watchable(this.type)) {
        this.watch({ selector, revision: res.revision });
      }

      return this.matching(selector);
    },

    cloneSchemas(this: StateTree): ISchema[] {
      return Object.values(this.schemas);
    },

    forgetType(this: StateTree, type: string, disconnect = true) {
      const t = this.typeFor(type);

      if (t && !disconnect) {
        this.reset(type);
      }

      if (disconnect) {
        delete this.schemas[type];
        delete this.types[type];
      }
    },

    enqueuePendingFrame(this: StateTree, obj: any): void {
      this.pendingFrames.push(obj);
    },

    setInError(this: StateTree, msg: IWatchMsg): void {
      const key = keyForSubscribe(msg);

      this.inError[key] = msg.reason;
    },

    clearInError(this: StateTree, msg: IWatchMsg): void {
      const key = keyForSubscribe(msg);

      delete this.inError[key];
    },

    /**
     * Type actions
     */
    // findAll helps to find all resources by type
    // @TODO depaginate: If the response is paginated, retrieve all the pages. (default: true)
    async findAll(this: StateTree, type: string, opt: IRequestOpt = {}): Promise<D[]> {
      if (this.limitNamespace) {
        const out = await this.findNamespace(this.limitNamespace, opt)

        this.haveAll = true

        return out
      }

      type = normalizeType(type);
      if (opt.force !== true && this.types[type]) {
        return this.types[type].list;
      }

      let load = opt.load === undefined ? "all" : opt.load;

      if (opt.load === false || opt.load === "none") {
        load = "none";
      }

      opt = opt || {};
      opt.url = this.urlFor(type, undefined, opt);

      let res: ICollection<D>;

      try {
        res = (await this.request(opt)) as unknown as ICollection<D>;
      } catch (e) {
        return Promise.reject(e);
      }

      if (load === "none") {
        return this.eachLimit(res.data, 20, (obj: IResource): Promise<IResource> => decorate<IResource, D>(obj, this));
      } else if (typeof res === "object" && !isArray(res)) {
        if (load === "multi") {
          // This has the effect of adding the response to the store,
          // without replacing all the existing content for that type,
          // and without marking that type as having 'all 'loaded.
          //
          // This is used e.g. to load a partial list of settings before login
          // while still knowing we need to load the full list later.
          await this.loadMulti(res.data);
        } else {
          await this.loadAll(type, res.data);
        }

        if (opt.watch !== false && watchable(type)) {
          this.watch({
            type: type,
            revision: res.revision,
            namespace: opt.watchNamespace,
          });
        }

        const all = this.all(type)
        return all
      }

      throw new Error("FindAll didn't find anything");
    },

    // find helps to find a resource by type and id
    async find(this: StateTree, type: string, id: string, opt: IRequestOpt = {}): Promise<D> {
      opt = opt || {};

      if (opt.force !== true) {
        const out = this.byId(type, id);

        if (out) {
          return out;
        }
      }

      opt = opt || {};
      opt.url = this.urlFor(type, id, opt);

      const res = (await this.request(opt)) as unknown as IResource;

      await this.load(res);

      if (opt.watch !== false && watchable(type)) {
        const watchMsg: IWatch = {
          type: type,
          id,
          revision: res?.metadata?.resourceVersion,
          force: opt.forceWatch === true,
        };

        const idx = id.indexOf("/");

        if (idx > 0) {
          watchMsg.namespace = id.substring(0, idx);
          watchMsg.id = id.substring(idx + 1);
        }

        this.watch(watchMsg);
      }
      console.info(`Found: ${type} ${id}`, this.byId(type, id));
      return this.byId(type, res.id || id);
    },

    async load(this: StateTree, data: IResource, existing: any): Promise<D | void> {
      let type = normalizeType(data.type);
      if (!this.typeRegistered(type)) {
        this.registerType(type);
      }

      if (data.baseType && data.baseType !== data.type) {
        type = normalizeType(data.baseType);

        if (!this.typeRegistered(type)) {
          this.registerType(type);
        }
      }

      const id = data?.id || existing?.id;

      if (!id) {
        console.warn("Attempting to load a resource with no id", data, existing); // eslint-disable-line no-console

        return;
      }

      let cache = this.types[type];
      let entry: D = cache.map.get(id);

      cache.generation++;

      if (entry) {
        // There's already an entry in the store, update it
        entry.update(data);
      } else {
        // There's no entry, make a new proxy
        entry = readonly(await decorate<T, D>(data, this)) as D;
        cache.list.push(entry);
        cache.map.set(id, entry);
      }

      if (pollTransitioning(type) && (entry.metadata?.state?.transitioning || entry.metadata?.state?.error)) {
        entry.pollTransitioning();
      }

      return this.byId(type, id);
    },

    async loadMulti(this: StateTree, data: IResource[]) {
      // console.debug('### Mutation loadMulti', data?.length);
      const promises = [];

      for (const entry of data) {
        promises.push(this.load(entry));
      }

      await Promise.all(promises);
    },

    async loadAll(this: StateTree, type: string, data: IResource[]) {
      if (!data || type === SCHEMA) {
        return;
      }

      const proxies = await Promise.all(data.map((x) => decorate(x, this)));
      const cache = this.registerType(type);

      clear(cache.list);
      cache.map.clear();
      cache.generation++;

      addObjects(cache.list, proxies);
      for (let i = 0; i < data.length; i++) {
        cache.map.set(data[i]['id'], proxies[i]);
      }

      cache.haveAll = true;
    },

    reset(this: StateTree, type: string) {
      let cache = this.typeFor(type);
      clear(cache.list);
      cache.map = {};
      cache.haveAll = false;
      cache.haveSelector = {};
      cache.revision = 0;
      cache.generation++;
    },

    async loadNamespace(this: StateTree, data: D[], namespace: string) {
      await this.loadMulti(data);
      this.haveNamespace[namespace] = true;
    },

    async loadSelector(this: StateTree, data: D[], selector: string) {
      await this.loadMulti(data);
      this.haveSelector[selector] = true;
    },

    async create(this: StateTree, data?: Partial<IResource>): Promise<IWritable> {
      const obj = this.defaultFor(this.type);

      Object.assign(obj, data);

      if (this.limitNamespace) {
        if (!obj.metadata) {
          obj.metadata = {};
        }

        obj.metadata.namespace = this.limitNamespace;
      }

      const out = await decorate<IResource, D>(obj, this);

      return out;
    },

    remove(this: StateTree, type: string, objOrId: D | string) {
      let obj: D;
      let cache = this.types[type];
      if (typeof objOrId === 'string') {
        obj = this.byId(type, objOrId)
      } else {
        obj = objOrId
      }

      if (cache && obj) {
        removeObject(cache.list, obj);
        cache.map.delete(obj.id);
        return true
      }
      return false;
    },

    async findNamespace(this: StateTree, namespace: string, type: string, opt: IRequestOpt = {}): Promise<ComputedRef<D[]>> {
      opt = opt || {};

      if (opt.force !== true && (this.haveAll || this.haveNamespace[namespace])) {
        return this.inNamespace(namespace);
      }

      console.info(`Find Namespace: [${this.name}] ${this.type} ${namespace}`);

      opt = opt || {};
      opt.url = this.urlFor(this.type, namespace, opt);

      const res = (await this.request(opt)) as unknown as ICollection<IResource>;

      await this.loadNamespace(res.data, namespace);

      if (opt.watch !== false && watchable(this.type)) {
        const watchMsg: IWatch = {
          type: this.type,
          namespace,
          revision: res.revision,
          force: opt.forceWatch === true,
        };

        this.watch(watchMsg);
      }

      return this.inNamespace(namespace);
    },

    ...WebSocketActions
  };
}
