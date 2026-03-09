/**
 * Internal event bus types.
 * Services communicate internally via typed events.
 */

import type { Receiver } from './receiver';
import type { ReceiverWindow } from './window';
import type { Channel } from './channel';
import type { Session } from './session';

export type EventType =
  | 'receiver.registered'
  | 'receiver.deregistered'
  | 'receiver.health_changed'
  | 'window.created'
  | 'window.stopped'
  | 'channel.created'
  | 'channel.stopped'
  | 'channel.listener_added'
  | 'channel.listener_removed'
  | 'session.created'
  | 'session.closed'
  | 'iq.block_dropped'
  | 'iq.stream_stalled';

export interface BaseEvent {
  type: EventType;
  timestamp: string; // ISO 8601
  correlationId: string;
}

export interface ReceiverRegisteredEvent extends BaseEvent {
  type: 'receiver.registered';
  receiver: Receiver;
}

export interface ReceiverDeregisteredEvent extends BaseEvent {
  type: 'receiver.deregistered';
  receiverId: string;
  reason: string;
}

export interface ReceiverHealthChangedEvent extends BaseEvent {
  type: 'receiver.health_changed';
  receiverId: string;
  previousStatus: string;
  currentStatus: string;
}

export interface WindowCreatedEvent extends BaseEvent {
  type: 'window.created';
  window: ReceiverWindow;
}

export interface WindowStoppedEvent extends BaseEvent {
  type: 'window.stopped';
  windowId: string;
  reason: string;
}

export interface ChannelCreatedEvent extends BaseEvent {
  type: 'channel.created';
  channel: Channel;
  reused: boolean;
}

export interface ChannelStoppedEvent extends BaseEvent {
  type: 'channel.stopped';
  channelId: string;
  reason: string;
}

export interface SessionCreatedEvent extends BaseEvent {
  type: 'session.created';
  session: Session;
}

export interface SessionClosedEvent extends BaseEvent {
  type: 'session.closed';
  sessionId: string;
  reason: string;
}

export interface IQBlockDroppedEvent extends BaseEvent {
  type: 'iq.block_dropped';
  receiverId: string;
  windowId: string;
  sequenceNumber: number;
}

export type PlatformEvent =
  | ReceiverRegisteredEvent
  | ReceiverDeregisteredEvent
  | ReceiverHealthChangedEvent
  | WindowCreatedEvent
  | WindowStoppedEvent
  | ChannelCreatedEvent
  | ChannelStoppedEvent
  | SessionCreatedEvent
  | SessionClosedEvent
  | IQBlockDroppedEvent;
