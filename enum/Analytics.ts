import { IAnalyticsEvent } from '../lib/Analytics';

export enum EventName {
	ESCALATION_FAILED_DUE_TO_NO_LIVEAGENT_AVAILABLE = 'escalation_failed_due_to_no_liveagent_available',
	ESCALATION_FAILED_DUE_TO_SALESFORCE_ERROR = 'escalation_failed_due_to_salesforce_error',
	ESCALATION_FAILED_DUE_TO_NETWORK_OR_APP_ERROR = 'escalation_failed_due_to_network_or_app_error',
	ESCALATION_SUCCESSFUL = 'escalation_successful',
	AGENT_TRANSFER_SUCCESSFUL = 'agent_transfer_successful',
	CHAT_CLOSED_BY_AGENT = 'chat_closed_by_agent',
	CHAT_CLOSED_BY_TIMEOUT = 'chat_closed_by_timeout',
}

export enum EventCatagory {
	CHAT_SESSION = 'Chat Session',
	ESCALATION = 'Escalation',
	AGENT_TRANSFER = 'Agent Transfer',
}

export enum EventType {
	SESSION = 'session',
	CUSTOMER_ACTION = 'customerAction',
}

export const Events: Record<string, IAnalyticsEvent> = {
	[EventName.ESCALATION_FAILED_DUE_TO_NO_LIVEAGENT_AVAILABLE]: {
		category: EventCatagory.ESCALATION,
		eventType: EventType.SESSION,
		action: 'failed',
		properties: {
			failure_reason: 'no agents available',
		},
	},
	[EventName.ESCALATION_FAILED_DUE_TO_SALESFORCE_ERROR]: {
		category: EventCatagory.ESCALATION,
		eventType: EventType.SESSION,
		action: 'failed',
		properties: {
			failure_reason: 'salesforce error',
		},
	},
	[EventName.ESCALATION_FAILED_DUE_TO_NETWORK_OR_APP_ERROR]: {
		category: EventCatagory.ESCALATION,
		eventType: EventType.SESSION,
		action: 'failed',
		properties: {
			failure_reason: 'network/app error in SF app',
		},
	},
	[EventName.ESCALATION_SUCCESSFUL]: {
		category: EventCatagory.ESCALATION,
		eventType: EventType.SESSION,
		action: 'successful',
		properties: {
			queue_time: '',
		},
	},
	[EventName.AGENT_TRANSFER_SUCCESSFUL]: {
		category: EventCatagory.AGENT_TRANSFER,
		eventType: EventType.SESSION,
		action: 'successful',
		properties: {},
	},
	[EventName.CHAT_CLOSED_BY_AGENT]: {
		category: EventCatagory.CHAT_SESSION,
		eventType: EventType.SESSION,
		action: 'closed',
		properties: {
			close_method: 'agent',
		},
	},
	[EventName.CHAT_CLOSED_BY_TIMEOUT]: {
		category: EventCatagory.CHAT_SESSION,
		eventType: EventType.SESSION,
		action: 'closed',
		properties: {
			close_method: 'timeout',
		},
	},
};
