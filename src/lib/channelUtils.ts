import { Channel } from '@/types/inbox';

export function getChannelColorClass(channel: Channel): string {
  const channelLower = channel.toLowerCase();
  
  switch (channelLower) {
    case 'whatsapp':
      return 'bg-channel-whatsapp-bg border-l-4 border-l-channel-whatsapp';
    case 'gmail':
      return 'bg-channel-gmail-bg border-l-4 border-l-channel-gmail';
    case 'amazon':
      return 'bg-channel-amazon-bg border-l-4 border-l-channel-amazon';
    case 'ebay':
      return 'bg-channel-ebay-bg border-l-4 border-l-channel-ebay';
    case 'tiktok shop':
      return 'bg-channel-tiktok-bg border-l-4 border-l-channel-tiktok';
    default:
      return 'bg-muted border-l-4 border-l-muted-foreground';
  }
}

export function getChannelBadgeClass(channel: Channel): string {
  const channelLower = channel.toLowerCase();
  
  switch (channelLower) {
    case 'whatsapp':
      return 'bg-channel-whatsapp text-white';
    case 'gmail':
      return 'bg-channel-gmail text-foreground';
    case 'amazon':
      return 'bg-channel-amazon text-foreground';
    case 'ebay':
      return 'bg-channel-ebay text-white';
    case 'tiktok shop':
      return 'bg-channel-tiktok text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getChannelIcon(channel: Channel): string {
  const channelLower = channel.toLowerCase();
  
  switch (channelLower) {
    case 'whatsapp':
      return '📱';
    case 'gmail':
      return '✉️';
    case 'amazon':
      return '📦';
    case 'ebay':
      return '🛒';
    case 'tiktok shop':
      return '🎵';
    default:
      return '💬';
  }
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  
  // Convert to London timezone
  const londonTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  
  return londonTime;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  const londonFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  const todayStr = londonFormatter.format(now);
  const dateStr = londonFormatter.format(date);
  
  if (todayStr === dateStr) {
    return 'Today';
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = londonFormatter.format(yesterday);
  
  if (yesterdayStr === dateStr) {
    return 'Yesterday';
  }
  
  return dateStr;
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
