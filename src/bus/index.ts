import z from "zod";
import { BusEvent } from "./bus-event.js";
import { GlobalBus } from "./global.js";

export namespace Bus {
  type Subscription = (event: any) => void;

  export const InstanceDisposed = BusEvent.define(
    "server.instance.disposed",
    z.object({
      directory: z.string(),
    }),
  );

  // Simplified state management (no Instance dependency for now)
  const subscriptions = new Map<any, Subscription[]>();

  export async function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ) {
    const payload = {
      type: def.type,
      properties,
    };
    const pending = [];
    for (const key of [def.type, "*"]) {
      const match = subscriptions.get(key);
      for (const sub of match ?? []) {
        pending.push(sub(payload));
      }
    }
    GlobalBus.emit("event", {
      payload,
    });
    return Promise.all(pending);
  }

  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"];
      properties: z.infer<Definition["properties"]>;
    }) => void,
  ) {
    return raw(def.type, callback);
  }

  export function once<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"];
      properties: z.infer<Definition["properties"]>;
    }) => "done" | undefined,
  ) {
    const unsub = subscribe(def, (event) => {
      if (callback(event)) unsub();
    });
  }

  export function subscribeAll(callback: (event: any) => void) {
    return raw("*", callback);
  }

  function raw(type: string, callback: (event: any) => void) {
    let match = subscriptions.get(type) ?? [];
    match.push(callback);
    subscriptions.set(type, match);

    return () => {
      const match = subscriptions.get(type);
      if (!match) return;
      const index = match.indexOf(callback);
      if (index === -1) return;
      match.splice(index, 1);
    };
  }
}
