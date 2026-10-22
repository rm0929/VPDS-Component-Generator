import React, { useState } from 'react';
import {
  Utility,
  Button,
  Badge,
  Link,
  Surface,
  Typography,
  Divider,
} from '@visa/nova-react';
import {
  VisaNotificationsTiny,
  VisaErrorTiny,
  VisaWarningTiny,
  VisaSettingsTiny,
} from '@visa/nova-icons-react';

interface Notification {
  id: number;
  type: 'info' | 'warning' | 'error';
  title?: string;
  message: string;
  timestamp?: string;
  actionLabel?: string;
}

const demoNotifications: Notification[] = [
  {
    id: 1,
    type: 'info',
    title: 'Welcome',
    message: 'Thanks for joining our service!',
    timestamp: '2h ago',
  },
  {
    id: 2,
    type: 'warning',
    title: 'Storage low',
    message: 'Your disk usage is 90% full.',
    timestamp: '1d ago',
    actionLabel: 'Upgrade',
  },
  {
    id: 3,
    type: 'error',
    title: 'Sync failed',
    message: 'Could not sync your files.',
    timestamp: 'Just now',
  },
];

const NotificationTrayPreview: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(demoNotifications.length);

  const markAllRead = () => setUnreadCount(0);

  return (
    <Utility vFlex vFlexCol vGap={8} style={{ position: 'relative' }}>
      <Button
        iconButton
        aria-label="Toggle notifications"
        onClick={() => setOpen(!open)}
      >
        <VisaNotificationsTiny  />
        {unreadCount > 0 && (
          <Badge badgeVariant="number" style={{ position: 'absolute', top: 4, right: 4 }}>
            {unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <Surface
          style={{
            position: 'absolute',
            top: '2.5rem',
            right: 0,
            width: '320px',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '1rem',
            boxShadow: 'var(--elevation-medium)',
            zIndex: 100,
          }}
        >
          <Utility vFlex vJustifyContent="between" vAlignItems="center">
            <Typography variant="headline-4">Notifications</Typography>
              <VisaSettingsTiny />
          </Utility>

          <Divider />

          {demoNotifications.map((n) => {
            const Icon =
              n.type === 'error' ? VisaErrorTiny : n.type === 'warning' ? VisaWarningTiny : VisaNotificationsTiny;
            return (
              <Utility
                key={n.id}
                vFlex
                vFlexCol
                vGap={4}
                style={{
                  borderLeft: '4px solid ' +
                    (n.type === 'error'
                      ? 'var(--palette-messaging-graphics-negative)'
                      : n.type === 'warning'
                      ? 'var(--palette-messaging-graphics-warning)'
                      : 'var(--palette-messaging-graphics-info)'),
                  padding: '0.5rem 0.75rem',
                }}
              >
                <Utility vFlex vJustifyContent="between" vAlignItems="center">
                  {/* J. Icon + C. Title */}
                  <Utility vFlex vAlignItems="center" vGap={4}>
                    <Icon />
                    {n.title && <Typography variant="subtitle-1">{n.title}</Typography>}
                  </Utility>
                  {n.timestamp && (
                    <Typography variant="label-small" colorScheme="subtle">
                      {n.timestamp}
                    </Typography>
                  )}
                </Utility>

                <Typography variant="body-2">{n.message}</Typography>

                {n.actionLabel && (
                  <Link href="#" noUnderline>
                    {n.actionLabel}
                  </Link>
                )}
              </Utility>
            );
          })}

          <Divider />

          <Utility vFlex vJustifyContent="between" vAlignItems="center">
            <Link href="#" noUnderline>
              View all
            </Link>
            <Button colorScheme="tertiary" buttonSize="small" onClick={markAllRead}>
              Mark all read
            </Button>
          </Utility>
        </Surface>
      )}
    </Utility>
  );
};

export default NotificationTrayPreview;