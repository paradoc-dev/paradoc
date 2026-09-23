/**
 * The parity lab's port, checked without starting the lab.
 *
 * Each run of the parity suite starts its own lab dev server. A fixed port made
 * two runs at once collide, so `startLab` now asks the operating system for a
 * free port unless it is given one. The spawn is stubbed with a process that has
 * already exited, so these tests see the port each start chose and the refusal
 * of a port something else answers on, and never start Vite.
 */

import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createNetServer } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn }));

import { freePort, startLab } from "./parity/lab";

/** The `--port` value a stubbed spawn was called with. */
function spawnedPort(call: unknown[]): number {
  const args = call[1] as string[];
  return Number(args[args.indexOf("--port") + 1]);
}

/** Resolves once `server` listens on `port` of the loopback interface. */
function listen(server: Server | ReturnType<typeof createNetServer>, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

beforeEach(() => {
  spawn.mockReset();
  // A lab that exits at once: `startLab` reports it rather than waiting.
  spawn.mockImplementation(() => ({ exitCode: 1, signalCode: null, pid: undefined }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("freePort", () => {
  it("returns a port another server can then bind", async () => {
    const port = await freePort();
    expect(port).toBeGreaterThan(0);

    const server = createNetServer();
    await listen(server, port);
    server.close();
  });
});

describe("startLab", () => {
  it("starts two labs at once on two different free ports", async () => {
    const [first, second] = await Promise.allSettled([startLab(), startLab()]);
    expect(first.status).toBe("rejected");
    expect(second.status).toBe("rejected");
    expect(String((first as PromiseRejectedResult).reason)).toMatch(/exited before it answered/);

    expect(spawn).toHaveBeenCalledTimes(2);
    const ports = spawn.mock.calls.map(spawnedPort);
    expect(ports[0]).toBeGreaterThan(0);
    expect(ports[1]).toBeGreaterThan(0);
    expect(ports[0]).not.toBe(ports[1]);
  });

  it("starts on the port it is given", async () => {
    const port = await freePort();
    await expect(startLab(port)).rejects.toThrow(/exited before it answered/);
    expect(spawnedPort(spawn.mock.calls[0]!)).toBe(port);
  });

  it("refuses a port another server already answers on, and starts nothing", async () => {
    const server = createHttpServer((_request, response) => response.end("not the lab"));
    const port = await freePort();
    await listen(server, port);
    try {
      await expect(startLab(port)).rejects.toThrow(/already listening/);
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
