import type { StateTree, Store } from "pinia";
import https from 'https';
import type {
  ICollection,
  IResource,
  ISchema,
} from "@/composables/steve/types";
import Socket, {
  EVENT_CONNECTED,
  EVENT_CONNECT_ERROR,
  EVENT_DISCONNECTED,
  EVENT_MESSAGE,
} from "@/utils/socket";
import {
  keyForSubscribe,
  normalizeType,
} from "./normalize";
import type { 
  IWatchMsg, 
  IRequestOpt, 
  IWatch, 
  IQueueAction, 
  IType
} from "./server";
import { SCHEMA } from "@/config/schemas";
import decorate from "@/composables/steve/decorate";
import { markRaw, readonly } from "vue";
import { clear, isArray, removeObject } from "@/utils/array";
import { pollTransitioning, watchable } from "@/config/schemas";

export const NO_WATCH = 'NO_WATCH'
export const NO_SCHEMA = 'NO_SCHEMA'

/**
 * 
 * Defines a set of actions for the SteveType.
 * @template T - The type of the resource.
 * @template D - The type of the decorated resource.
 * @returns An object containing various async actions for the SteveType.
 */
export function SteveServerActions<T extends IResource, D extends DecoratedResource>() {
    return {
      /***
       * Server actions
       */

      configure(this: StateTree, baseUrl: string, referenceId = ''): void {
        this.name = this.$id
        this.config.baseUrl = baseUrl
        this.referenceId = referenceId
      },

      // TODO: return type define
      registerType(this: StateTree, type: string): object {
        type = normalizeType(type);
        let cache = this.types[type];
  
        if (!cache) {
          cache = {
            list: [],
            haveAll: false,
            haveSelector: {},
            revision: 0, // The highest known resourceVersion from the server for this type
            generation: 0, // Updated every time something is loaded for this type
            map: new Map(),
          };
          cache = markRaw(cache);
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

          for ( const data of schemas.data ) {
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
  
      resetWS(this: StateTree, disconnect = true): void {
        console.info("Reset", this.name);
  
        for (const k in this.typeStores) {
          this.forgetType(k, disconnect);
        }
  
        if (disconnect) {
          this.schemas = {};
          this.unsubscribe(true);
        }
      },
  
      subscribe(this: StateTree): void {
        if (process.server) {
          return;
        }
  
        let socket = this.socket;
  
        this.wantSocket = true;
  
        this.debugSocket && console.debug(`Subscribe [${this.name}]`);
  
        const url = `${this.config.baseUrl}/subscribe`;
  
        if (socket) {
          socket.setAutoReconnect(true);
          socket.setUrl(url);
        } else {
          socket = new Socket(url);
          this.socket = socket;
  
          socket.on(EVENT_CONNECTED, (e: Message) => {
            this.opened(e);
          });
  
          socket.on(EVENT_DISCONNECTED, (e: Message) => {
            this.closed(e);
          });
  
          socket.on(EVENT_CONNECT_ERROR, (e: Message) => {
            this.error(e.detail);
          });
  
          socket.on(EVENT_MESSAGE, (e: Message) => {
            const event = e.detail;
  
            if (event.data) {
              const msg = <IWatchMsg>JSON.parse(event.data);
  
              if (msg?.name && this[`ws.${msg.name}`]) {
                this[`ws.${msg.name}`](msg);
              } else if (!`${msg?.name}`.includes(".")) {
                // @TODO remove Cluster API is sending bad names...
                msg.name = "resource.change";
              } else {
                console.error("Unknown message type", msg?.name);
              }
            }
          });
        }
  
        socket.connect({ name: this.name });
      },
  
      async unsubscribe(this: StateTree, disconnect = true) {
        const socket = this.socket;
  
        clear(this.pendingFrames);
  
        if (socket && disconnect) {
          this.wantSocket = false;
          clear(this.started);
          await socket.disconnect();
        } else {
          const promises = [];
  
          for (const entry of this.started.slice()) {
            if (entry.type === SCHEMA) {
              continue;
            }
  
            console.info(`Unsubscribe [${this.name}]`, JSON.stringify(entry));
  
            if (this.schemaFor(entry.type)) {
              this.setWatchStopped(entry);
              delete entry.revision;
              promises.push(this.watch({ ...entry, stop: true }));
              delete this.started[entry];
            }
          }
  
          await Promise.all(promises);
        }
      },
  
      async queueChange(
        this: StateTree,
        msg: IWatchMsg,
        load = true,
        event = ""
      ) {
        const { data, revision } = msg;
  
        if (!data) {
          return;
        }
  
        const type = normalizeType(data.type);
  
        if (type === "schema") {
          const normalizedId = normalizeType(data.id);
  
          if (load) {
            const existing = this.schemas[type];
  
            if (existing) {
              existing.update(data);
            } else {
              const neu = await decorate<ISchema, DecoratedSchema>(
                data as ISchema,
                this
              );
  
              this.schemas[normalizedId] = neu;
            }
          } else {
            delete this.schemas[normalizedId];
            this.forgetType(normalizedId);
          }
  
          return;
        }
  
        const ts = this.storeFor(type);
  
        if (!ts) {
          return;
        }
  
        ts.revision = Math.max(ts.revision, Number.parseInt(revision || "", 10));
  
        // console.info(`${ label } Event [${ state.config.namespace }]`, data.type, data.id);
  
        if (load) {
          this.queue.push(<IQueueAction>{
            action: "load",
            type,
            body: data,
            event,
          });
        } else {
          this.queue.push(<IQueueAction>{
            action: "remove",
            type,
            body: data,
          });
        }
      },
  
      async flush(this: StateTree) {
        const queue: IQueueAction[] = this.queue;
  
        if (!queue.length) {
          return;
        }
  
        const started = new Date().getTime();
  
        this.queue = [];
  
        this.debugSocket &&
          console.debug(`Subscribe Flush [${this.name}]`, queue.length, "items");
  
        for (const { action, type, body, id, event } of queue) {
          const ts = this.storeFor(type);
          console.log("action:", action, ts, id, body)
  
          if (action === "load") {
            const obj = await this.load(body);
  
            if (event && obj?.notify) {
              obj.notify(event);
            }
          } else if (action === "remove") {
            await this.remove(ts, body);
          } else if (action === "forgetType") {
            this.forgetType(type);
          }
        }
  
        this.debugSocket &&
          console.debug(
            `Subscribe Flush [${this.name}] finished`,
            new Date().getTime() - started,
            "ms"
          );
      },
  
      forgetType(this: StateTree, type: string, disconnect = true) {
        type = normalizeType(type);
        const ts = this.storeFor(type);
  
        if (ts) {
          this.reset();
        }
  
        if (disconnect) {
          delete this.schemas[type];
          delete this.typeStores[type];
        }
      },
  
      watch(this: StateTree, params: IWatch): void {
        this.debugSocket &&
          console.debug(`Watch Request [${this.name}]`, JSON.stringify(params));
  
        let { type, selector, id, revision, namespace, stop, force } = params;
  
        if (this.limitNamespace) {
          namespace = this.limitNamespace;
        }
  
        type = normalizeType(type || "");
  
        console.log("debug:", params, type);
        // if ( params.type === "schema" ) {
        //   return
        // }
        if (!stop && !force && !this.canWatch(params)) {
          this.debugSocket &&
            console.debug(`Cannot Watch [${this.name}]`, JSON.stringify(params));
  
          return;
        }
  
        if (
          !stop &&
          this.watchStarted({
            type,
            id,
            selector,
            namespace,
          })
        ) {
          this.debugSocket &&
            console.debug(
              `Already Watching [${this.name}]`,
              JSON.stringify(params)
            );
  
          return;
        }
  
        if (typeof revision === "undefined") {
          revision = this.nextResourceVersion(type, id);
        }
  
        const msg: IWatch = { resourceType: type };
  
        if (revision) {
          msg.resourceVersion = `${revision}`;
        }
  
        if (namespace) {
          msg.namespace = namespace;
        }
  
        if (stop) {
          msg.stop = true;
        }
  
        if (id) {
          msg.id = id;
        }
  
        if (selector) {
          msg.selector = selector;
        }
  
        this.send(msg);
      },
  
      enqueuePendingFrame(this: StateTree, obj: any): void {
        this.pendingFrames.push(obj);
      },
  
      setWatchStarted(this: StateTree, obj: IWatch): void {
        const existing = this.existingWatchFor(obj);
  
        if (!existing) {
          addObject(this.started, obj);
        }
  
        delete this.inError[keyForSubscribe(obj)];
      },
  
      setWatchStopped(this: StateTree, obj: IWatch): void {
        const existing = this.existingWatchFor(obj);
  
        if (existing) {
          removeObject(this.started, existing);
        } else {
          console.warn("Tried to remove a watch that doesn't exist", obj);
        }
      },
  
      setInError(this: StateTree, msg: IWatchMsg): void {
        const key = keyForSubscribe(msg);
  
        this.inError[key] = msg.reason;
      },
  
      clearInError(this: StateTree, msg: IWatchMsg): void {
        const key = keyForSubscribe(msg);
  
        delete this.inError[key];
      },
  
      debug(this: StateTree, on: boolean): void {
        this.debugSocket = on !== false;
      },
  
      reconnectWatches(this: StateTree): Promise<any> {
        const promises = [];
  
        for (const entry of this.started.slice()) {
          console.info(`Reconnect [${this.name}]`, JSON.stringify(entry));
  
          if (this.schemaFor(entry.type)) {
            this.setWatchStopped(entry);
            delete entry.revision;
            promises.push(this.watch(entry));
          }
        }
  
        return Promise.all(promises);
      },
  
      async resyncWatch(this: StateTree, params: IWatch): Promise<void> {
        const { resourceType, namespace, id, selector } = params;
  
        console.info(`Resync [${this.name}]`, params);
  
        const ts = this.storeFor(resourceType);
  
        if (!ts) {
          return;
        }
  
        const opt = { force: true, forceWatch: true };
  
        if (id) {
          await this.find(id, opt);
          this.clearInError(params);
  
          return;
        }
  
        let have: IResource[];
        let want: IResource[];
  
        if (selector) {
          have = this.matching(resourceType, selector).slice();
          want = await this.findMatching({
            selector,
            opt,
          });
        } else {
          if (namespace) {
            have = this.inNamespace(namespace);
          } else {
            have = this.list.slice();
          }
  
          want = await this.findAll({
            watchNamespace: namespace,
            ...opt,
          });
        }
  
        const wantMap: Record<string, boolean> = {};
  
        for (const obj of want) {
          wantMap[obj.id] = true;
        }
  
        for (const obj of have) {
          if (!wantMap[obj.id]) {
            this.debugSocket &&
              console.debug(`Remove stale [${this.name}]`, resourceType, obj.id);
  
            this.remove(obj);
          }
        }
      },
  
      async opened(this: StateTree) {
        this.debugSocket && console.debug(`WebSocket Opened [${this.name}]`);
  
        if (!this.queue) {
          this.queue = [];
        }
  
        if (!this.queueTimer) {
          this.flushQueue = async () => {
            if (this.queue.length) {
              await this.flush();
            }
  
            this.queueTimer = setTimeout(this.flushQueue, 1000);
          };
  
          this.flushQueue();
        }
  
        if (this.socket.hasReconnected) {
          await this.reconnectWatches();
        }
  
        // Try resending any frames that were attempted to be sent while the socket was down, once.
        if (!process.server) {
          const frames = this.pendingFrames.slice();
  
          clear(this.pendingFrames);
          for (const obj of frames) {
            this.sendImmediate(obj);
          }
        }
      },
  
      closed(this: StateTree): void {
        this.debugSocket && console.debug(`WebSocket Closed [${this.name}]`);
        clearTimeout(this.queueTimer);
        this.queueTimer = undefined;
      },
  
      error(this: StateTree, event: IWatchMsg): void {
        console.error(`WebSocket Error [${this.name}]`, event);
        clearTimeout(this.queueTimer);
        this.queueTimer = undefined;
      },
  
      send(this: StateTree, obj: any): void {
        if (this.socket) {
          const ok = this.socket.send(obj);
  
          if (ok) {
            return;
          }
        }
  
        this.enqueuePendingFrame(obj);
      },
  
      sendImmediate(this: StateTree, obj: any) {
        if (this.socket) {
          return this.socket.send(obj);
        }
      },
  
      /***
       * WebSocket message handlers
       */
      "ws.ping": function (this: StateTree) {
        if (this.name === "mgmt") {
          console.info(`Ping [${this.name}]`);
        }
      },
  
      "ws.resource.start": function (this: StateTree, msg: IWatchMsg) {
        this.debugSocket &&
          console.debug(`Resource start: [${this.name}]`, JSON.stringify(msg));
        this.setWatchStarted({
          type: msg.resourceType,
          namespace: msg.namespace,
          id: msg.id,
          selector: msg.selector,
        });
      },
  
      "ws.resource.error": function (this: StateTree, msg: IWatchMsg) {
        console.warn(
          `Resource error [${this.name}]`,
          msg.resourceType,
          ":",
          msg.data?.error
        );
  
        const err = msg.data?.error?.toLowerCase();
  
        if (err.includes("watch not allowed")) {
          this.setInError({ type: msg.resourceType, reason: NO_WATCH });
        } else if (err.includes("failed to find schema")) {
          this.setInError({ type: msg.resourceType, reason: NO_SCHEMA });
        } else if (err.includes("too old") || err.includes("status code 410")) {
          this.resyncWatch(msg);
        }
      },
  
      "ws.resource.stop": function (this: StateTree, msg: IWatchMsg) {
        const type = msg.resourceType;
        const obj = {
          type,
          id: msg.id,
          namespace: msg.namespace,
          selector: msg.selector,
        };
  
        console.warn(`Resource stop: [${this.name}]`, msg.resourceType);
  
        if (this.schemaFor(type) && this.watchStarted(obj)) {
          // Try reconnecting once
          this.setWatchStopped(obj);
  
          setTimeout(() => {
            // Delay a bit so that immediate start/error/stop causes
            // only a slow infinite loop instead of a tight one.
            this.watch(obj);
          }, 5000);
        }
      },
  
      "ws.resource.create": function (this: StateTree, msg: IWatchMsg) {
        this.queueChange(msg, true, "create");
      },
  
      "ws.resource.change": function (this: StateTree, msg: IWatchMsg) {
        this.queueChange(msg, true, "change");
      },
  
      "ws.resource.remove": function (this: StateTree, msg: IWatchMsg) {
        this.queueChange(msg, false, "remove");
      },

      /**
       * Steve type resource related actions
       */
      // opt:
      //  filter: Filter by fields, e.g. {field: value, anotherField: anotherValue} (default: none)
      //  limit: Number of records to return per page (default: 1000)
      //  sortBy: Sort by field
      //  sortOrder: asc or desc
      //  url: Use this specific URL instead of looking up the URL for the type/id.  This should only be used for bootstrapping schemas on startup.
      //  @TODO depaginate: If the response is paginated, retrieve all the pages. (default: true)
      async findAll(this: StateTree, type: string, opt: IRequestOpt = {}): Promise<D[]> {
        if ( this.limitNamespace ) {
          const out = await this.findNamespace(this.limitNamespace, opt)
  
          this.haveAll = true
  
          return out
        }

        type = normalizeType(type);
        // console.log("Find All 1:", this, this.types.object, type);
        // if (opt.force !== true && this.types[type]) {
        //   return this.all;
        // }
  
        let load = opt.load === undefined ? "all" : opt.load;
  
        if (opt.load === false || opt.load === "none") {
          load = "none";
        }
  
        console.info(`Find All: ${type}`);
  
        opt = opt || {};
        opt.url = this.urlFor(type, undefined, opt);
  
        let res: ICollection<T>;
  
        try {
          res = (await this.request(opt)) as unknown as ICollection<T>;
        } catch (e) {
          return Promise.reject(e);
        }
  
        console.log("load::::", load, res)
        if (load === "none") {
          return this.eachLimit(res.data, 20, (obj: T): Promise<D> => decorate<T, D>(obj, this));
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

      async load(this: StateTree, data: T & IResource, existing: any): Promise<D | void> {
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
  
        this.generation++;
  
        let cache = this.registerType(type);
  
        let entry: D = cache.map.get(id);
  
        if (entry) {
          // There's already an entry in the store, update it
          entry.update(data);
  
          // console.debug('### Mutation Updated', type, id);
        } else {
          // There's no entry, make a new proxy
          entry = readonly(await decorate<T, D>(data, this)) as D;
          cache.list.push(entry);
          cache.map.set(id, entry);
          // console.debug('### Mutation', type, id);
        }
  
        if (pollTransitioning(this.type) && (entry.metadata?.state?.transitioning || entry.metadata?.state?.error)) {
          entry.pollTransitioning();
        }
  
        return this.byId(type, id);
      },
  
      async loadMulti(this: StateTree, data: T[]) {
        // console.debug('### Mutation loadMulti', data?.length);
        const promises = [];
  
        for (const entry of data) {
          promises.push(this.load(entry));
        }
  
        await Promise.all(promises);
      },
  
      async loadAll(this: StateTree, type: string, data: T[]) {
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


      reset(this: StateTree) {
        clear(this.list);
        this.map = {};
        this.haveAll = false;
        this.haveSelector = {};
        this.haveNamespace = {};
        this.revision = 0;
        this.generation++;
      },
  
      async loadNamespace(this: StateTree, data: D[], namespace: string) {
        await this.loadMulti(data);
        this.haveNamespace[namespace] = true;
      },
  
      async loadSelector(this: StateTree, data: D[], selector: string) {
        await this.loadMulti(data);
        this.haveSelector[selector] = true;
      },
  
      async create(this: StateTree, data?: Partial<T>): Promise<IWritable<D>> {
        const obj = this.defaultFor(this.type);
  
        Object.assign(obj, data);
  
        if (this.limitNamespace) {
          if (!obj.metadata) {
            obj.metadata = {};
          }
  
          obj.metadata.namespace = this.limitNamespace;
        }
  
        const out = await decorate<T, D>(obj, this);
  
        return out;
      },
  
      remove(this: StateTree, ts: IType, obj: T & IResource) {
        // let obj: IStored<IResource>;
        console.log("remove origin obj ---", obj)
        // if (typeof objOrId === "string") {
        obj = this.byId(obj.type, obj.id);
        console.log("find remove obj ---", obj)
        // } else {
        //   obj = objOrId;
        // }
  
        console.log("remove obj ---", ts, obj)
        // let entry = this.types[obj.type];

        if (ts) {
          removeObject(ts.list, obj);
          ts.map.delete(obj.id);
          console.info(`Removed: ${obj.type} ${obj.id}`, ts);
          return true
        }
        // if (ts) {
        //   this.generation++;
        //   removeObject(ts.list, obj);
        //   ts.map.delete(obj.id);
        //   // delete this.map[obj.id];
  
        //   console.info(`Removed: ${obj.type} ${obj.id}`, ts);
        //   return true;
        // }
  
        return false;
      },

      async findNamespace(this: StateTree, namespace: string, opt: IRequestOpt = {}): Promise<ComputedRef<D[]>> {
        opt = opt || {};
  
        if (opt.force !== true && (this.haveAll || this.haveNamespace[namespace])) {
          return this.inNamespace(namespace);
        }
  
        console.info(`Find Namespace: [${this.name}] ${this.type} ${namespace}`);
  
        opt = opt || {};
        opt.url = this.urlFor(this.type, namespace, opt);
  
        const res = (await this.request(opt)) as unknown as ICollection<T>;
  
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
    };
  }
