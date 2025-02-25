'use client';

// delete
import { useState } from 'react';

import { Trans } from '@lingui/macro';
import { Download } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

import { downloadLeaderboardData } from './fetch-leaderboard.actions';

export const DownloadButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsLoading(true);

      const data = await downloadLeaderboardData();

      // Create a blob with the data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = `leaderboard-data-${new Date().toISOString().split('T')[0]}.json`;

      // Trigger the download
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isLoading}
      className="ml-2"
    >
      {isLoading ? (
        <span className="flex items-center gap-x-2">
          <Trans>Downloading...</Trans>
        </span>
      ) : (
        <span className="flex items-center gap-x-2">
          <Download className="h-4 w-4" />
          <Trans>Download</Trans>
        </span>
      )}
    </Button>
  );
};
