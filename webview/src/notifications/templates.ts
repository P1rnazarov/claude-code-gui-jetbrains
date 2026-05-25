import { APP_NAME } from '@/config/app';
import {
  NotificationKind,
  type NotificationContext,
  type NotificationTemplate,
} from './types';

export const NOTIFICATION_TEMPLATES: Record<NotificationKind, NotificationTemplate> = {
  [NotificationKind.SESSION_COMPLETE]: {
    title: (ctx: NotificationContext) => ctx.sessionTitle ?? APP_NAME,
    body: 'Response complete',
    icon: '/favicon.svg',
  },
};
