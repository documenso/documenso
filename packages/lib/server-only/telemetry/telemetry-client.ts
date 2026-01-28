/* eslint-disable require-atomic-updates */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PostHog } from 'posthog-node';

import { version } from '../../../../package.json';
import { prefixedId } from '../../universal/id';
import { getSiteSetting } from '../site-settings/get-site-setting';
import { SITE_SETTINGS_TELEMETRY_ID } from '../site-settings/schemas/telemetry';
import { upsertSiteSetting } from '../site-settings/upsert-site-setting';

const TELEMETRY_KEY = process.env.NEXT_PRIVATE_TELEMETRY_KEY;
const TELEMETRY_HOST = process.env.NEXT_PRIVATE_TELEMETRY_HOST;
const TELEMETRY_DISABLED = !!process.env.DOCUMENSO_DISABLE_TELEMETRY;

const NODE_ID_FILENAME = '.documenso-node-id';
const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Version is hardcoded to avoid rollup JSON import issues
const APP_VERSION = version;

export class TelemetryClient {
  private static instance: TelemetryClient | null = null;

  private client: PostHog | null = null;

  private heartbeatInterval: NodeJS.Timeout | null = null;

  private installationId: string | null = null;
  private nodeId: string | null = null;

  private constructor() {}

  /**
   * Start the telemetry client.
   *
   * This will initialize the PostHog client, load or create the installation ID and node ID,
   * capture a startup event, and start a heartbeat interval.
   *
   * If telemetry is disabled via `DOCUMENSO_DISABLE_TELEMETRY=true` or credentials are not
   * provided, this will be a no-op.
   */
  public static async start(): Promise<void> {
    if (TELEMETRY_DISABLED) {
      console.log(
        '[Telemetry] Telemetry is disabled. To enable, remove the DOCUMENSO_DISABLE_TELEMETRY environment variable.',
      );
      return;
    }

    if (!TELEMETRY_KEY || !TELEMETRY_HOST) {
      console.log('[Telemetry] Telemetry credentials not configured. Telemetry will not be sent.');
      return;
    }

    if (TelemetryClient.instance) {
      return;
    }

    const instance = new TelemetryClient();

    TelemetryClient.instance = instance;

    await instance.initialize();
  }

  /**
   * Stop the telemetry client.
   *
   * This will clear the heartbeat interval and shutdown the PostHog client.
   */
  public static async stop(): Promise<void> {
    const instance = TelemetryClient.instance;

    if (!instance) {
      return;
    }

    if (instance.heartbeatInterval) {
      clearInterval(instance.heartbeatInterval);
    }

    if (instance.client) {
      await instance.client.shutdown();
    }

    TelemetryClient.instance = null;
  }

  private async initialize(): Promise<void> {
    this.client = new PostHog(TELEMETRY_KEY!, {
      host: TELEMETRY_HOST,
      disableGeoip: false,
    });

    // Load or create IDs
    this.installationId = await this.getOrCreateInstallationId();
    this.nodeId = await this.getOrCreateNodeId();

    console.log(
      '[Telemetry] Telemetry is enabled. Documenso collects anonymous usage data to help improve the product.',
    );
    console.log(
      '[Telemetry] We collect: app version, installation ID, and node ID. No personal data, document contents, or user information is collected.',
    );
    console.log(
      '[Telemetry] To disable telemetry, set DOCUMENSO_DISABLE_TELEMETRY=true in your environment variables.',
    );
    console.log(
      '[Telemetry] Learn more: https://documenso.com/docs/developers/self-hosting/telemetry',
    );

    // Capture startup event
    this.captureEvent('telemetry_selfhoster_startup');

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.captureEvent('telemetry_selfhoster_heartbeat');
    }, HEARTBEAT_INTERVAL_MS);
  }

  private captureEvent(event: string): void {
    if (!this.client || !this.installationId) {
      return;
    }

    this.client.capture({
      distinctId: this.installationId,
      event,
      properties: {
        appVersion: APP_VERSION,
        installationId: this.installationId,
        nodeId: this.nodeId,
      },
    });
  }

  private async getOrCreateInstallationId(): Promise<string> {
    try {
      // Try to get from site settings
      const existing = await getSiteSetting({ id: SITE_SETTINGS_TELEMETRY_ID }).catch(() => null);

      if (existing) {
        if (existing.data.installationId) {
          return existing.data.installationId;
        }
      }

      // Create new installation ID
      const installationId = prefixedId('installation');

      await upsertSiteSetting({
        id: SITE_SETTINGS_TELEMETRY_ID,
        data: { installationId },
        enabled: true,
      });

      return installationId;
    } catch {
      // If database is not available, generate a temporary ID
      return prefixedId('installation');
    }
  }

  private async getOrCreateNodeId(): Promise<string | null> {
    const nodeIdPath = path.join(os.tmpdir(), NODE_ID_FILENAME);

    try {
      const existingId = await fs.readFile(nodeIdPath, 'utf-8');

      if (existingId.trim()) {
        return existingId.trim();
      }
    } catch {
      // File doesn't exist or can't be read, continue to create
    }

    // Generate new node ID
    const nodeId = prefixedId('node');

    try {
      await fs.writeFile(nodeIdPath, nodeId, 'utf-8');
    } catch {
      // Read-only filesystem, use memory for nodeId
    }

    return nodeId;
  }
}
