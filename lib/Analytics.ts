import { IAnalyticsPayload } from '@rocket.chat/apps-engine/definition/accessors/IAnalytics';
import { EventName, Events } from '../enum/Analytics';

export interface IAnalyticsEvent {
	category: string;
	action: string;
	eventType: string;
	properties?: Record<string, any>;
}

export const getEventData = (roomId: string, eventName: EventName, properties?: Record<string, any>) => {
	const event = Events[`${eventName}`];
	const payload: IAnalyticsPayload = {
		roomId,
		category: event.category,
		action: event.action,
		eventType: event.eventType,
		properties: { ...(event.properties || {}), ...(properties || {}) },
		timestamp: new Date().toISOString(),
	};
	return payload;
};
