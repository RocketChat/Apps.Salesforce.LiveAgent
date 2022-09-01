import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IOnetimeSchedule } from '@rocket.chat/apps-engine/definition/scheduler';
import { AppSettingId } from '../enum/AppSettingId';
import { getRoomAssoc, retrievePersistentData, updatePersistentData } from '../helperFunctions/PersistenceHelpers';
import { getAppSettingValue } from '../lib/Settings';

async function updateSneakPeekField(
	salesforceBotUsername: string,
	messageId: string,
	sneakPeekEnabled: boolean | null,
	read: IRead,
	modify: IModify,
) {
	const user = await read.getUserReader().getByUsername(salesforceBotUsername);
	const msgExtender = await modify.getExtender().extendMessage(messageId, user);
	msgExtender.addCustomField('sneakPeekEnabled', sneakPeekEnabled);
	return modify.getExtender().finish(msgExtender);
}

async function modifyWidgetTimer(
	salesforceBotUsername: string,
	message: IMessage,
	chasitorIdleTimeout: any,
	idleTimeoutAction: string,
	read: IRead,
	modify: IModify,
) {
	const timeoutWarningMessage: string = await getAppSettingValue(read, AppSettingId.CUSTOMER_TIMEOUT_WARNING_MESSAGE);
	const warningTime = chasitorIdleTimeout.warningTime;
	const timeoutTime = chasitorIdleTimeout.timeout;

	const user = await read.getUserReader().getByUsername(salesforceBotUsername);
	const msgExtender = await modify.getExtender().extendMessage(message.id as string, user);
	msgExtender.addCustomField('idleTimeoutConfig', {
		idleTimeoutAction,
		idleTimeoutWarningTime: warningTime,
		idleTimeoutTimeoutTime: timeoutTime,
		idleTimeoutMessage: timeoutWarningMessage,
	});
}

async function clearAppTimeout(roomId: string, read: IRead, modify: IModify, persistence: IPersistence, app: IApp, assoc) {
	await updatePersistentData(read, persistence, assoc, { isIdleSessionTimerScheduled: false, idleSessionTimerId: '' });
	await modify.getScheduler().cancelJobByDataQuery({ rid: roomId, taskType: 'sessionTimeout' });
}

async function scheduleAppTimeout(
	roomId: string,
	chasitorIdleTimeout: any,
	read: IRead,
	modify: IModify,
	persistence: IPersistence,
	assoc: RocketChatAssociationRecord,
) {
	const { isIdleSessionTimerScheduled, idleSessionTimerId } = await retrievePersistentData(read, assoc);

	if (isIdleSessionTimerScheduled === true) {
		if (idleSessionTimerId) {
			await modify.getScheduler().cancelJob(idleSessionTimerId);
		}
	}

	const task: IOnetimeSchedule = {
		id: 'idle-session-timeout',
		when: new Date(new Date().getTime() + chasitorIdleTimeout.timeout * 1000),
		data: { rid: roomId, taskType: 'sessionTimeout' },
	};
	const jobId = await modify.getScheduler().scheduleOnce(task);
	await updatePersistentData(read, persistence, assoc, { isIdleSessionTimerScheduled: true, idleSessionTimerId: jobId });
}

/**
 * Clears existing app timeout timer, and instantiates a new app timeout timer
 */
export async function resetAppTimeout(
	roomId: string,
	chasitorIdleTimeout: any,
	read: IRead,
	modify: IModify,
	persistence: IPersistence,
	app: IApp,
	assoc: RocketChatAssociationRecord,
) {
	const sessionTimeoutHandler: string = await getAppSettingValue(read, AppSettingId.TIMEOUT_HANDLER);
	if (sessionTimeoutHandler === 'app') {
		await clearAppTimeout(roomId, read, modify, persistence, app, assoc);
		await scheduleAppTimeout(roomId, chasitorIdleTimeout, read, modify, persistence, assoc);
	}
}

/**
 * Sets the amount of time that a customer has to respond to an agent message before a warning appears and a timer begins a countdown.
 *
 * - The warning disappears (and the timer stops) each time the customer sends a message.
 * - The warning disappears (and the timer resets to 0) each time the agent sends message.
 * - The timer stops when the customer sends a message and starts again from 0 on the next agent's message.
 *
 * The warning value must be shorter than the time-out value (we recommend at least 30 seconds).
 */
export const handleTimeout = async (app: IApp, message: IMessage, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) => {
	if (message.customFields?.idleTimeoutConfig) {
		return;
	}

	const salesforceBotUsername: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_BOT_USERNAME);
	const assoc = getRoomAssoc(message.room.id);
	const { chasitorIdleTimeout, sneakPeekEnabled } = await retrievePersistentData(read, assoc);

	if (chasitorIdleTimeout?.isEnabled) {
		// ------ When agent sends message -----
		// Send new timeout msg and reset previous timeout

		// ------ When customer sends message -----
		// Send timeout msg to cancel previous timeout

		// On Timeout : Close chat
		// On Warning : Show Countdown Popup in Livechat Widget

		const sessionTimeoutHandler: string = await getAppSettingValue(read, AppSettingId.TIMEOUT_HANDLER);

		if (message.sender.username === salesforceBotUsername) {
			// Agent sent message
			if (!message.id) {
				return;
			}

			if (sessionTimeoutHandler === 'app') {
				await scheduleAppTimeout(message.room.id, chasitorIdleTimeout, read, modify, persistence, assoc);
			}

			await modifyWidgetTimer(salesforceBotUsername, message, chasitorIdleTimeout, 'start', read, modify);
			await updateSneakPeekField(salesforceBotUsername, message.room.id, sneakPeekEnabled, read, modify);
		} else {
			// Guest sent message
			if (!message.id) {
				return;
			}

			if (sessionTimeoutHandler === 'app') {
				await clearAppTimeout(message.room.id, read, modify, persistence, app, assoc);
			}

			await modifyWidgetTimer(salesforceBotUsername, message, chasitorIdleTimeout, 'stop', read, modify);
			await updateSneakPeekField(salesforceBotUsername, message.room.id, sneakPeekEnabled, read, modify);
		}
	} else {
		if (!message.id) {
			return;
		}

		await updateSneakPeekField(salesforceBotUsername, message.id, sneakPeekEnabled, read, modify);
	}
};
