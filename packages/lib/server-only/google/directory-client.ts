// ABOUTME: Google Directory API client authenticating via service account with domain-wide delegation.
// ABOUTME: Provides getDirectoryUser and getDirectoryGroups; both catch errors internally and return null on failure.
import { readFileSync } from 'fs';
import { google } from 'googleapis';

import { env } from '@documenso/lib/utils/env';

type DirectoryUserResult = {
  department: string | null;
  title: string | null;
  orgUnitPath: string | null;
};

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
};

function buildAuth() {
  const keyJson = env('GOOGLE_SERVICE_ACCOUNT_KEY');
  const keyFile = env('GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
  const adminEmail = env('GOOGLE_DIRECTORY_ADMIN_EMAIL');

  let credentials: ServiceAccountKey;

  if (keyJson) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    credentials = JSON.parse(keyJson) as ServiceAccountKey;
  } else if (keyFile) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    credentials = JSON.parse(readFileSync(keyFile, 'utf8')) as ServiceAccountKey;
  } else {
    throw new Error('No Google service account key configured');
  }

  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/admin.directory.group.readonly',
    ],
    subject: adminEmail,
  });
}

export async function getDirectoryUser(email: string): Promise<DirectoryUserResult | null> {
  try {
    const auth = buildAuth();
    const adminSdk = google.admin({ version: 'directory_v1', auth });

    const response = await adminSdk.users.get({ userKey: email, projection: 'full' });
    const data = response.data;

    const orgs = data.organizations;
    const org = Array.isArray(orgs) && orgs.length > 0 ? orgs[0] : null;

    return {
      department: typeof org?.department === 'string' ? org.department : null,
      title: typeof org?.title === 'string' ? org.title : null,
      orgUnitPath: typeof data.orgUnitPath === 'string' ? data.orgUnitPath : null,
    };
  } catch (err) {
    console.warn(
      `[directory-sync] Failed to fetch user ${email}: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
    return null;
  }
}

export async function getDirectoryGroups(email: string): Promise<string[] | null> {
  try {
    const auth = buildAuth();
    const adminSdk = google.admin({ version: 'directory_v1', auth });

    const emails: string[] = [];
    let pageToken: string | undefined;

    do {
      const response = await adminSdk.groups.list({
        userKey: email,
        ...(pageToken ? { pageToken } : {}),
      });

      const data = response.data;
      const groups = Array.isArray(data.groups) ? data.groups : [];

      for (const group of groups) {
        if (typeof group.email === 'string') {
          emails.push(group.email);
        }
      }

      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    return emails;
  } catch (err) {
    console.warn(
      `[directory-sync] Failed to fetch groups for ${email}: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
    return null;
  }
}
