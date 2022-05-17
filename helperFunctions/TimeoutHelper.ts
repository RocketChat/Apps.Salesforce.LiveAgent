import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IOnetimeSchedule } from '@rocket.chat/apps-engine/definition/scheduler';
import { AppSettingId } from '../enum/AppSettingId';
import { getRoomAssoc, retrievePersistentData, updatePersistentData } from '../helperFunctions/PersistenceHelpers';
import { getAppSettingValue } from '../lib/Settings';

export const handleTimeout = async (app: IApp, message: IMessage, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) => {
	if (message.room.type !== 'l' || (message.customFields && message.customFields.idleTimeoutConfig)) {
		return;
	}

	const salesforceBotUsername: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_BOT_USERNAME);
	const assoc = getRoomAssoc(message.room.id);
	const { chasitorIdleTimeout, sneakPeekEnabled } = await retrievePersistentData(read, assoc);

	if (chasitorIdleTimeout && chasitorIdleTimeout.isEnabled) {
		/**
		 * Sets the amount of time that a customer has to respond to an agent message before a warning appears and a timer begins a countdown.
		 * The warning disappears (and the timer stops) each time the customer sends a message.
		 * The warning disappears (and the timer resets to 0) each time the agent sends message.
		 * The warning value must be shorter than the time-out value (we recommend at least 30 seconds).
		 */
		const warningTime = chasitorIdleTimeout.warningTime;

		/**
		 * Sets the amount of time that a customer has to respond to an agent message before the session ends.
		 * The timer stops when the customer sends a message and starts again from 0 on the next agent's message.
		 */
		const timeoutTime = chasitorIdleTimeout.timeout;

		// ------ When agent sends message -----
		// Send new timeout msg and reset previous timeout

		// ------ When customer sends message -----
		// Send timeout msg to cancel previous timeout

		// On Timeout : Close chat
		// On Warning : Show Countdown Popup in Livechat Widget

		const timeoutWarningMessage: string = await getAppSettingValue(read, AppSettingId.CUSTOMER_TIMEOUT_WARNING_MESSAGE);
		const sessionTimeoutHandler: string = await getAppSettingValue(read, AppSettingId.TIMEOUT_HANDLER);

		if (message.sender.username === salesforceBotUsername) {
			// Agent sent message
			if (!message.id) {
				return;
			}

			if (sessionTimeoutHandler === 'app') {
				await scheduleTimeOut(message, read, modify, persistence, timeoutTime, app, assoc);
			}

			const user = await read.getUserReader().getByUsername(salesforceBotUsername);
			const msgExtender = modify.getExtender().extendMessage(message.id, user);
			(await msgExtender).addCustomField('idleTimeoutConfig', {
				idleTimeoutAction: 'start',
				idleTimeoutWarningTime: warningTime,
				idleTimeoutTimeoutTime: timeoutTime,
				idleTimeoutMessage: timeoutWarningMessage,
			});
			(await msgExtender).addCustomField('sneakPeekEnabled', sneakPeekEnabled);
			modify.getExtender().finish(await msgExtender);
		} else {
			// Guest sent message

			if (!message.id) {
				return;
			}

			if (sessionTimeoutHandler === 'app') {
				await updatePersistentData(read, persistence, assoc, { isIdleSessionTimerScheduled: false, idleSessionTimerId: '' });
				await modify.getScheduler().cancelJobByDataQuery({ rid: message.room.id, taskType: 'sessionTimeout' });
			}
			const user = await read.getUserReader().getByUsername(salesforceBotUsername);
			const msgExtender = modify.getExtender().extendMessage(message.id, user);
			(await msgExtender).addCustomField('idleTimeoutConfig', {
				idleTimeoutAction: 'stop',
				idleTimeoutWarningTime: warningTime,
				idleTimeoutTimeoutTime: timeoutTime,
				idleTimeoutMessage: timeoutWarningMessage,
			});
			(await msgExtender).addCustomField('sneakPeekEnabled', sneakPeekEnabled);
			modify.getExtender().finish(await msgExtender);
		}
	} else {
		if (!message.id) {
			return;
		}
		const user = await read.getUserReader().getByUsername(salesforceBotUsername);
		const msgExtender = modify.getExtender().extendMessage(message.id, user);
		(await msgExtender).addCustomField('sneakPeekEnabled', sneakPeekEnabled);
		modify.getExtender().finish(await msgExtender);
	}
};

async function scheduleTimeOut(
	message: IMessage,
	read: IRead,
	modify: IModify,
	persistence: IPersistence,
	idleTimeoutTimeoutTime: number,
	app: IApp,
	assoc,
) {
	const rid = message.room.id;
	const { isIdleSessionTimerScheduled, idleSessionTimerId } = await retrievePersistentData(read, assoc);

	if (isIdleSessionTimerScheduled === true) {
		if (idleSessionTimerId) {
			await modify.getScheduler().cancelJob(idleSessionTimerId);
		}
	}

	const task: IOnetimeSchedule = {
		id: 'idle-session-timeout',
		when: new Date(new Date().getTime() + idleTimeoutTimeoutTime * 1000),
		data: { rid, taskType: 'sessionTimeout' },
	};
	const jobId = await modify.getScheduler().scheduleOnce(task);
	await updatePersistentData(read, persistence, assoc, { isIdleSessionTimerScheduled: true, idleSessionTimerId: jobId });
}
