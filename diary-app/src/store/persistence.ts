/** Serializes durable writes so a slow older save cannot overwrite a newer one. */
export function createWriteQueue<T>(write: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  return {
    write(value: T) {
      const next = tail.catch(() => {}).then(() => write(value));
      tail = next;
      return next;
    },
    async settled() { await tail.catch(() => {}); },
  };
}
