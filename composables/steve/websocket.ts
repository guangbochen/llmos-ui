import type { StateTree } from "pinia";
import type { 
  IWatchMsg, 
  IQueueAction,
  IWatch,
} from "./server";
import Socket, {
  EVENT_CONNECTED,
  EVENT_CONNECT_ERROR,
  EVENT_DISCONNECTED,
  EVENT_MESSAGE,
} from "@/utils/socket";
import type {
  ISchema,
} from "@/composables/steve/types";
import { SCHEMA } from "@/config/schemas";
import {
  keyForSubscribe,
  normalizeType,
} from "./normalize";
import decorate from "@/composables/steve/decorate";

export const NO_WATCH = 'NO_WATCH'
export const NO_SCHEMA = 'NO_SCHEMA'

export const actions = {
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

  async queueChange(this: StateTree, msg: IWatchMsg, load = true, event = "") {
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

  debug(this: StateTree, on: boolean): void {
    this.debugSocket = on !== false;
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

}