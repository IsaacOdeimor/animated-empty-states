import { inbox } from './Inbox';
import { notifications } from './Notifications';
import { payments } from './Payments';
import { projects } from './Projects';
import type { SceneDef } from './types';

export const SCENES: SceneDef[] = [projects, notifications, payments, inbox];
export type { SceneDef };
